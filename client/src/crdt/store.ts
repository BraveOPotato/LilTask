// ─── Hybrid Logical Clock ────────────────────────────────────────────────────
let _lastMs = 0;
let _seq = 0;

function hlcNow(): string {
  const ms = Date.now();
  if (ms > _lastMs) { _lastMs = ms; _seq = 0; } else { _seq++; }
  return `${_lastMs}.${String(_seq).padStart(6, '0')}`;
}

function advanceClock(hlc: string): void {
  const ms = parseInt(hlc, 10) || 0;
  if (ms > _lastMs) _lastMs = ms;
}

// ─── Wire format ─────────────────────────────────────────────────────────────
const te = new TextEncoder();
const td = new TextDecoder();

export interface CRDTRecord {
  id: string;
  text: string;
  done: boolean;
  deleted: boolean;
  hlc: string;
  dueDate?: string;       // 'YYYY-MM-DD'
  category?: string;
}

interface SetDelta   { op: 'set';      record: CRDTRecord }
interface SnapDelta  { op: 'snapshot'; records: CRDTRecord[] }
type Delta = SetDelta | SnapDelta;

export function encodeUpdate(delta: Delta): Uint8Array {
  const json = te.encode(JSON.stringify(delta));
  const out  = new Uint8Array(4 + json.byteLength);
  new DataView(out.buffer).setUint32(0, json.byteLength, false);
  out.set(json, 4);
  return out;
}

export function decodeUpdates(buf: ArrayBuffer): Delta[] {
  const data = new Uint8Array(buf);
  const dv   = new DataView(buf);
  const out: Delta[] = [];
  let o = 0;
  while (o + 4 <= data.byteLength) {
    const len = dv.getUint32(o, false); o += 4;
    if (o + len > data.byteLength) break;
    if (len > 0) {
      try { out.push(JSON.parse(td.decode(data.slice(o, o + len))) as Delta); } catch {}
    }
    o += len;
  }
  return out;
}

// ─── Store ───────────────────────────────────────────────────────────────────
export type StoreObserver = (todos: CRDTRecord[], delta: Delta | null) => void;

export interface CRDTStore {
  addTodo(text: string, dueDate?: string): { encoded: Uint8Array };
  toggleTodo(id: string): { encoded: Uint8Array } | null;
  editTodo(id: string, text: string, dueDate?: string): { encoded: Uint8Array } | null;
  deleteTodo(id: string): { encoded: Uint8Array } | null;
  reorder(orderedIds: string[]): void;
  applyUpdate(deltaOrArray: Delta | Delta[]): void;
  getState(): CRDTRecord[];
  encodeFullState(): Uint8Array;
  observe(fn: StoreObserver): () => void;
}

export function createStore(): CRDTStore {
  const state = new Map<string, CRDTRecord>();
  const observers = new Set<StoreObserver>();

  function sorted(): CRDTRecord[] {
    return [...state.values()]
      .filter(t => !t.deleted)
      .sort((a, b) => (a.hlc < b.hlc ? -1 : 1));
  }

  function notify(delta: Delta | null): void {
    const todos = sorted();
    for (const fn of observers) fn(todos, delta);
  }

  function mergeOne(rec: CRDTRecord): boolean {
    const e = state.get(rec.id);
    if (!e || rec.hlc > e.hlc) { state.set(rec.id, rec); return true; }
    return false;
  }

  function mutate(rec: CRDTRecord): { encoded: Uint8Array } {
    state.set(rec.id, rec);
    const delta: SetDelta = { op: 'set', record: rec };
    notify(delta);
    return { encoded: encodeUpdate(delta) };
  }

  function uuid(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  return {
    addTodo(text, dueDate) {
      return mutate({ id: uuid(), text, done: false, deleted: false, hlc: hlcNow(), dueDate });
    },
    toggleTodo(id) {
      const e = state.get(id);
      if (!e || e.deleted) return null;
      return mutate({ ...e, done: !e.done, hlc: hlcNow() });
    },
    editTodo(id, text, dueDate) {
      const e = state.get(id);
      if (!e || e.deleted) return null;
      return mutate({ ...e, text, dueDate, hlc: hlcNow() });
    },
    deleteTodo(id) {
      const e = state.get(id);
      if (!e) return null;
      return mutate({ ...e, deleted: true, hlc: hlcNow() });
    },
    reorder(orderedIds) {
      // Re-stamp HLCs in sequence to force desired sort order
      orderedIds.forEach((id, i) => {
        const e = state.get(id);
        if (!e || e.deleted) return;
        // small stagger so each gets unique HLC
        const hlc = `${Date.now() + i}.${String(i).padStart(6, '0')}`;
        state.set(id, { ...e, hlc });
      });
      notify(null);
    },
    applyUpdate(deltaOrArray) {
      const deltas = Array.isArray(deltaOrArray) ? deltaOrArray : [deltaOrArray];
      let changed = false;
      for (const d of deltas) {
        if (d?.op === 'set' && d.record?.id) {
          advanceClock(d.record.hlc);
          if (mergeOne(d.record)) changed = true;
        } else if (d?.op === 'snapshot' && Array.isArray(d.records)) {
          for (const r of d.records) {
            advanceClock(r.hlc);
            if (mergeOne(r)) changed = true;
          }
        }
      }
      if (changed) notify(null);
    },
    getState: sorted,
    encodeFullState() {
      return encodeUpdate({ op: 'snapshot', records: [...state.values()] });
    },
    observe(fn) { observers.add(fn); return () => observers.delete(fn); },
  };
}
