// crdt.mjs — LWW-Map CRDT replacing Yjs (~3KB vs ~100KB)
// Wire format: JSON payloads in same 4-byte-length-framed chunks as worker.js
// worker.js needs zero changes.

let _lastMs = 0, _seq = 0;
function hlcNow() {
    const ms = Date.now();
    if (ms > _lastMs) { _lastMs = ms; _seq = 0; } else { _seq++; }
    return `${_lastMs}.${String(_seq).padStart(6, '0')}`;
}

function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    // Fallback for non-secure contexts (plain HTTP)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}



const te = new TextEncoder(), td = new TextDecoder();

/** Encode a delta → framed Uint8Array (POST body) */
export function encodeUpdate(delta) {
    const json = te.encode(JSON.stringify(delta));
    const out  = new Uint8Array(4 + json.byteLength);
    new DataView(out.buffer).setUint32(0, json.byteLength, false);
    out.set(json, 4);
    return out;
}

/** Decode framed ArrayBuffer (GET response) → array of delta objects */
export function decodeUpdates(buf) {
    const data = new Uint8Array(buf), dv = new DataView(buf), deltas = [];
    let o = 0;
    while (o + 4 <= data.byteLength) {
        const len = dv.getUint32(o, false); o += 4;
        if (o + len > data.byteLength) break;
        if (len > 0) try { deltas.push(JSON.parse(td.decode(data.slice(o, o + len)))); } catch {}
        o += len;
    }
    return deltas;
}

/**
 * createStore()
 *
 * Mutations return { encoded: Uint8Array } — POST that to the worker.
 * applyUpdate() handles incoming remote deltas — do NOT re-POST.
 * observe(fn) → fn(todos[], delta|null) on every change; returns unsubscribe fn.
 */
export function createStore() {
    const state = new Map(), observers = new Set();

    function notify(delta) {
        const todos = [...state.values()]
        .filter(t => !t.deleted)
        .sort((a, b) => (a.hlc < b.hlc ? -1 : 1));
        for (const fn of observers) fn(todos, delta);
    }

    function mergeOne(rec) {
        const e = state.get(rec.id);
        if (!e || rec.hlc > e.hlc) { state.set(rec.id, rec); return true; }
        return false;
    }

    function mutate(rec) {
        state.set(rec.id, rec);
        const delta = { op: 'set', record: rec };
        notify(delta);
        return { delta, encoded: encodeUpdate(delta) };
    }

    function observe(fn)        { observers.add(fn); return () => observers.delete(fn); }
    function getState()         { return [...state.values()].filter(t => !t.deleted).sort((a,b) => a.hlc < b.hlc ? -1 : 1); }
    function encodeFullState()  { return encodeUpdate({ op: 'snapshot', records: [...state.values()] }); }

    function addTodo(text)      { return mutate({ id: generateUUID(), text, done: false, deleted: false, hlc: hlcNow() }); }
    function toggleTodo(id)     { const e = state.get(id); if (!e || e.deleted) return null; return mutate({ ...e, done: !e.done, hlc: hlcNow() }); }
    function editTodo(id, text) { const e = state.get(id); if (!e || e.deleted) return null; return mutate({ ...e, text, hlc: hlcNow() }); }
    function deleteTodo(id)     { const e = state.get(id); if (!e) return null; return mutate({ ...e, deleted: true, hlc: hlcNow() }); }

    function applyUpdate(deltaOrArray) {
        const deltas = Array.isArray(deltaOrArray) ? deltaOrArray : [deltaOrArray];
        let changed = false;
        for (const d of deltas) {
            if (d?.op === 'set' && d.record?.id) {
                _lastMs = Math.max(_lastMs, parseInt(d.record.hlc, 10) || 0);
                if (mergeOne(d.record)) changed = true;
            } else if (d?.op === 'snapshot' && Array.isArray(d.records)) {
                for (const r of d.records) {
                    _lastMs = Math.max(_lastMs, parseInt(r.hlc, 10) || 0);
                    if (mergeOne(r)) changed = true;
                }
            }
        }
        if (changed) notify(null);
    }

    return { addTodo, toggleTodo, editTodo, deleteTodo, applyUpdate, getState, observe, encodeFullState };
}
