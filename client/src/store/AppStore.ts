import { createStore, decodeUpdates } from '../crdt/store';
import type { CRDTStore } from '../crdt/store';
import { TaskList, TodoItem, RecurringTask, DEFAULT_PLUGINS } from '../models';
import type { PluginState, RecurrenceType } from '../models';

export type SyncStatus = 'synced' | 'syncing' | 'error' | 'offline';

// ─── Themes ──────────────────────────────────────────────────────────────────
export interface ThemeDef {
  id: string;
  label: string;
  dark: boolean;
  swatch: [string, string, string];
}

export const THEMES: ThemeDef[] = [
  { id: 'dark-violet',  label: 'Violet Night',   dark: true,  swatch: ['#0f0f11', '#7c6aff', '#a855f7'] },
  { id: 'dark-slate',   label: 'GitHub Dark',    dark: true,  swatch: ['#0d1117', '#58a6ff', '#79c0ff'] },
  { id: 'dark-rose',    label: 'Rose Dark',      dark: true,  swatch: ['#100c10', '#e05c9a', '#f07ac0'] },
  { id: 'dark-forest',  label: 'Ember Dark',     dark: true,  swatch: ['#0f0b08', '#f97316', '#fb923c'] },
  { id: 'light-clean',  label: 'Clean Light',    dark: false, swatch: ['#f8f8fc', '#6655ee', '#9933ff'] },
  { id: 'light-warm',   label: 'Warm Parchment', dark: false, swatch: ['#fdf8f0', '#c05a10', '#e07030'] },
  { id: 'light-sky',    label: 'Sky Blue',       dark: false, swatch: ['#f0f6ff', '#1a72e8', '#4090ff'] },
];

// ─── List Templates ──────────────────────────────────────────────────────────
export interface ListTemplate {
  id: string;
  icon: string;
  name: string;
  desc: string;
  plugins: PluginState;
  defaultName: string;
}

export const LIST_TEMPLATES: ListTemplate[] = [
  { id: 'personal', icon: '✅', name: 'Personal Todos', desc: 'Track personal tasks with celebratory finish.', plugins: { categoryGroup: false, finishRewards: true }, defaultName: 'Personal Todos' },
  { id: 'grocery',  icon: '🛒', name: 'Grocery List',   desc: 'Smart category grouping for shopping trips.',   plugins: { categoryGroup: true,  finishRewards: true }, defaultName: 'Grocery List' },
  { id: 'blank',    icon: '📋', name: 'Blank List',     desc: 'Start fresh with no plugins enabled.',          plugins: { categoryGroup: false, finishRewards: false }, defaultName: '' },
];

// ─── Plugin Definitions ──────────────────────────────────────────────────────
export const PLUGIN_DEFS = [
  { id: 'categoryGroup' as const, icon: '🏷️', name: 'Category Grouper', desc: 'Groups similar items (great for grocery lists).' },
  { id: 'finishRewards' as const, icon: '🎉', name: 'Finish Rewards',    desc: 'Celebratory emoji when you complete every task!' },
];

// ─── Subscriber type ─────────────────────────────────────────────────────────
type Listener = () => void;

// ─── AppStore ────────────────────────────────────────────────────────────────
class AppStore {
  // Lists
  private _lists: Map<string, TaskList> = new Map();
  private _activeListId: string | null = null;

  // CRDT stores per list
  private _crdtStores: Map<string, CRDTStore> = new Map();

  // Recurring
  // { listId → RecurringTask[] }
  private _recurring: Map<string, RecurringTask[]> = new Map();
  // { listId → { recId:periodKey → count } }
  private _recCompletions: Map<string, Record<string, number>> = new Map();
  // { listId → { recId:dateKey → true | recId:all → fromKey } }
  private _recDeletions: Map<string, Record<string, string>> = new Map();

  // Sync
  private _syncStatus: SyncStatus = 'offline';
  private _syncTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private _isPulling = false;
  private _workerUrl = 'https://liltask-sync.abdullahalkafajy.workers.dev/';
  private _offlineMode = false;

  // Theme
  private _theme = 'dark-violet';

  // Listeners
  private _listeners = new Set<Listener>();

  constructor() {
    this._load();
    this._applyTheme(this._theme);
  }

  // ── Subscription ────────────────────────────────────────────────────────────
  subscribe(fn: Listener): () => void {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }
  private _notify(): void {
    for (const fn of this._listeners) fn();
  }

  // ── Persistence ─────────────────────────────────────────────────────────────
  private _save(): void {
    const listsObj: Record<string, object> = {};
    this._lists.forEach((l, id) => { listsObj[id] = l.toJSON(); });
    localStorage.setItem('liltask_lists', JSON.stringify(listsObj));
    localStorage.setItem('liltask_active', this._activeListId ?? '');
  }

  private _load(): void {
    try {
      const raw = JSON.parse(localStorage.getItem('liltask_lists') || '{}');
      Object.entries(raw).forEach(([id, data]: [string, any]) => {
        this._lists.set(id, TaskList.from({ ...data, id }));
      });
    } catch { this._lists = new Map(); }

    this._activeListId = localStorage.getItem('liltask_active') || null;
    this._theme        = localStorage.getItem('liltask_theme') || 'dark-violet';
    this._offlineMode  = localStorage.getItem('liltask_offline_mode') === 'true';
    this._workerUrl    = localStorage.getItem('liltask_worker_url') || this._workerUrl;
  }

  // ── CRDT store access ───────────────────────────────────────────────────────
  getOrCreateCRDT(listId: string): CRDTStore {
    if (this._crdtStores.has(listId)) return this._crdtStores.get(listId)!;

    const store = createStore();
    this._crdtStores.set(listId, store);

    // Hydrate from localStorage
    const stored = localStorage.getItem('liltask_ydoc_' + listId);
    if (stored) {
      try {
        const arr = Uint8Array.from(JSON.parse(stored));
        store.applyUpdate(decodeUpdates(arr.buffer));
      } catch {}
    }

    // Observe → persist + sync + notify
    store.observe(() => {
      const state = store.encodeFullState();
      localStorage.setItem('liltask_ydoc_' + listId, JSON.stringify(Array.from(state)));
      this._scheduleSync(listId);
      this._notify();
    });

    return store;
  }

  // ── List accessors ──────────────────────────────────────────────────────────
  get lists(): TaskList[] {
    return [...this._lists.values()].filter(l => !l.isPlaceholder());
  }

  get activeListId(): string | null { return this._activeListId; }

  get activeList(): TaskList | null {
    return this._activeListId ? (this._lists.get(this._activeListId) ?? null) : null;
  }

  getTodos(listId?: string): TodoItem[] {
    const id = listId ?? this._activeListId;
    if (!id) return [];
    return this.getOrCreateCRDT(id)
      .getState()
      .map(r => new TodoItem(r as Parameters<typeof TodoItem.from>[0]));
  }

  // ── List mutations ──────────────────────────────────────────────────────────
  createList(name: string, roomId?: string, plugins?: PluginState): string {
    const id     = this._genId();
    const rid    = roomId ?? this._genId(16);
    const list   = new TaskList({ id, name: name || 'Untitled', roomId: rid, plugins });
    this._lists.set(id, list);
    this.getOrCreateCRDT(id); // init
    this._save();
    this._notify();
    return id;
  }

  renameList(listId: string, name: string): void {
    const l = this._lists.get(listId);
    if (!l) return;
    l.name = name;
    this._save();
    this._notify();
  }

  deleteList(listId: string): void {
    this._lists.delete(listId);
    this._crdtStores.delete(listId);
    localStorage.removeItem('liltask_ydoc_' + listId);
    if (this._activeListId === listId) {
      this._activeListId = this._lists.size > 0 ? [...this._lists.keys()][0] : null;
    }
    this._save();
    this._notify();
  }

  switchList(listId: string): void {
    this._activeListId = listId;
    this._save();
    this._pullUpdate(listId);
    this._notify();
  }

  ensureDefaultList(): void {
    if (this._lists.size === 0 || [...this._lists.values()].every(l => l.isPlaceholder())) {
      // Caller should open new-list modal; create placeholder so app doesn't crash
      const id = this.createList('__placeholder__');
      this._activeListId = id;
      this._save();
    } else if (!this._activeListId || !this._lists.has(this._activeListId)) {
      this._activeListId = [...this._lists.keys()][0];
      this._save();
    }
  }

  joinRoom(roomId: string, name: string, plugins?: PluginState): string {
    // Check existing
    const existing = [...this._lists.values()].find(l => l.roomId === roomId);
    if (existing) { this.switchList(existing.id); return existing.id; }
    const id = this.createList(name, roomId, plugins);
    this._activeListId = id;
    this._save();
    this._pullUpdate(id);
    return id;
  }

  // ── Todo mutations ──────────────────────────────────────────────────────────
  addTodo(text: string, dueDate?: string): void {
    if (!this._activeListId || !text.trim()) return;
    this.getOrCreateCRDT(this._activeListId).addTodo(text.trim(), dueDate);
  }

  toggleTodo(listId: string, todoId: string): void {
    this.getOrCreateCRDT(listId).toggleTodo(todoId);
    this._checkFinishReward(listId);
  }

  deleteTodo(listId: string, todoId: string): void {
    this.getOrCreateCRDT(listId).deleteTodo(todoId);
  }

  editTodo(listId: string, todoId: string, text: string, dueDate?: string): void {
    this.getOrCreateCRDT(listId).editTodo(todoId, text, dueDate);
  }

  reorderTodos(listId: string, orderedIds: string[]): void {
    this.getOrCreateCRDT(listId).reorder(orderedIds);
  }

  // ── Plugins ─────────────────────────────────────────────────────────────────
  getPlugins(listId?: string): PluginState {
    if (listId) {
      const list = this._lists.get(listId);
      if (list) return { ...list.plugins };
    }
    return { ...DEFAULT_PLUGINS };
  }

  setPlugins(listId: string, plugins: PluginState): void {
    const list = this._lists.get(listId);
    if (!list) return;
    list.plugins = plugins;
    this._save();
    this._notify();
  }

  togglePlugin(listId: string, pluginId: keyof PluginState): void {
    const list = this._lists.get(listId);
    if (!list) return;
    list.plugins[pluginId] = !list.plugins[pluginId];
    this._save();
    this._notify();
  }

  // ── Recurring tasks ─────────────────────────────────────────────────────────
  private _recurringKey(listId: string) { return 'liltask_recurring_' + listId; }
  private _recCompKey(listId: string)   { return 'liltask_rec_completions_' + listId; }
  private _recDelKey(listId: string)    { return 'liltask_rec_deletions_' + listId; }

  getRecurring(listId?: string): RecurringTask[] {
    const id = listId ?? this._activeListId ?? '';
    if (!this._recurring.has(id)) {
      try {
        const raw = JSON.parse(localStorage.getItem(this._recurringKey(id)) || '[]');
        this._recurring.set(id, raw.map(RecurringTask.from));
      } catch { this._recurring.set(id, []); }
    }
    return this._recurring.get(id)!;
  }

  private _saveRecurring(listId: string): void {
    const arr = this.getRecurring(listId);
    localStorage.setItem(this._recurringKey(listId), JSON.stringify(arr.map(r => r.toJSON())));
  }

  addRecurring(text: string, type: RecurrenceType, periodTotal = 1, earlyCompletion = false, weekDays: number[] = [], monthDays: number[] = []): void {
    const id = this._activeListId ?? '';
    const recs = this.getRecurring(id);
    const newId = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    recs.push(new RecurringTask({
      id: newId,
      text, type, periodTotal, earlyCompletion,
      createdAt: new Date().toISOString(),
      weekDays,
      monthDays,
    }));
    this._saveRecurring(id);
    this._notify();
  }

  /** Fully remove a recurring task from the list (used by manage modal). */
  deleteRecurringPermanently(recId: string): void {
    const id = this._activeListId ?? '';
    const recs = this.getRecurring(id).filter(r => r.id !== recId);
    this._recurring.set(id, recs);
    this._saveRecurring(id);
    this._notify();
  }

  deleteRecurringAllFuture(recId: string, fromKey: string): void {
    const id = this._activeListId ?? '';
    const dels = this._loadRecDeletions(id);
    dels[recId + ':all'] = fromKey;
    this._saveRecDeletions(id, dels);
    this._notify();
  }

  deleteRecurringOnce(recId: string, dateKey: string): void {
    const id = this._activeListId ?? '';
    const dels = this._loadRecDeletions(id);
    dels[recId + ':' + dateKey] = 'true';
    this._saveRecDeletions(id, dels);
    this._notify();
  }

  isRecurringDeleted(recId: string, dateKey: string): boolean {
    const id = this._activeListId ?? '';
    const dels = this._loadRecDeletions(id);
    if (dels[recId + ':' + dateKey]) return true;
    const allFrom = dels[recId + ':all'];
    if (allFrom) return dateKey >= allFrom;
    return false;
  }

  getRecurringCompletionCount(recId: string, periodKey: string): number {
    const id = this._activeListId ?? '';
    const comps = this._loadRecCompletions(id);
    return comps[recId + ':' + periodKey] ?? 0;
  }

  isRecurringDone(rec: RecurringTask, periodKey: string): boolean {
    return this.getRecurringCompletionCount(rec.id, periodKey) >= rec.periodTotal;
  }

  toggleRecurringCompletion(rec: RecurringTask, periodKey: string): void {
    const id = this._activeListId ?? '';
    const comps = this._loadRecCompletions(id);
    const key = rec.id + ':' + periodKey;
    const current = comps[key] ?? 0;
    if (current >= rec.periodTotal) {
      comps[key] = 0; // reset
    } else {
      comps[key] = current + 1;
    }
    this._saveRecCompletions(id, comps);
    this._notify();
    // Check finish reward
    if (comps[key] >= rec.periodTotal) this._checkFinishReward(id);
  }

  private _loadRecCompletions(listId: string): Record<string, number> {
    if (!this._recCompletions.has(listId)) {
      try {
        this._recCompletions.set(listId, JSON.parse(localStorage.getItem(this._recCompKey(listId)) || '{}'));
      } catch { this._recCompletions.set(listId, {}); }
    }
    return this._recCompletions.get(listId)!;
  }

  private _saveRecCompletions(listId: string, data: Record<string, number>): void {
    this._recCompletions.set(listId, data);
    localStorage.setItem(this._recCompKey(listId), JSON.stringify(data));
  }

  private _loadRecDeletions(listId: string): Record<string, string> {
    if (!this._recDeletions.has(listId)) {
      try {
        this._recDeletions.set(listId, JSON.parse(localStorage.getItem(this._recDelKey(listId)) || '{}'));
      } catch { this._recDeletions.set(listId, {}); }
    }
    return this._recDeletions.get(listId)!;
  }

  private _saveRecDeletions(listId: string, data: Record<string, string>): void {
    this._recDeletions.set(listId, data);
    localStorage.setItem(this._recDelKey(listId), JSON.stringify(data));
  }

  getActiveRecurring(date?: Date): RecurringTask[] {
    const id = this._activeListId ?? '';
    const d  = date ?? new Date();
    const dk = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    return this.getRecurring(id).filter(r => {
      if (this.isRecurringDeleted(r.id, dk)) return false;
      return r.isDueOn(d);
    });
  }

  getRecurringProgress(): { done: number; total: number } {
    const recs = this.getActiveRecurring();
    let done = 0, total = 0;
    recs.forEach(r => {
      const pk = r.getPeriodKey();
      total += r.periodTotal;
      done  += Math.min(this.getRecurringCompletionCount(r.id, pk), r.periodTotal);
    });
    return { done, total };
  }

  // ── Celebration ─────────────────────────────────────────────────────────────
  private _celebrateListeners = new Set<() => void>();

  onCelebrate(fn: () => void): () => void {
    this._celebrateListeners.add(fn);
    return () => this._celebrateListeners.delete(fn);
  }

  private _checkFinishReward(listId: string): void {
    const list = this._lists.get(listId);
    if (!list?.plugins.finishRewards) return;
    const todos = this.getTodos(listId);
    if (todos.length === 0) return;
    const allDone = todos.every(t => t.done);
    if (allDone) for (const fn of this._celebrateListeners) fn();
  }

  // ── Themes ──────────────────────────────────────────────────────────────────
  get theme(): string { return this._theme; }

  setTheme(id: string): void {
    this._theme = id;
    localStorage.setItem('liltask_theme', id);
    this._applyTheme(id);
    this._notify();
  }

  private _applyTheme(id: string): void {
    document.documentElement.setAttribute('data-theme', id);
  }

  // ── Sync ────────────────────────────────────────────────────────────────────
  get syncStatus(): SyncStatus { return this._syncStatus; }
  get offlineMode(): boolean   { return this._offlineMode; }
  get workerUrl(): string      { return this._workerUrl; }

  setOfflineMode(val: boolean): void {
    this._offlineMode = val;
    localStorage.setItem('liltask_offline_mode', val ? 'true' : 'false');
    this._syncStatus = val ? 'offline' : 'synced';
    this._notify();
  }

  setWorkerUrl(url: string): void {
    this._workerUrl = url;
    localStorage.setItem('liltask_worker_url', url);
    this._notify();
  }

  private _effectiveWorkerUrl(): string {
    return this._workerUrl.replace(/\/+$/, '');
  }

  private _setSyncStatus(s: SyncStatus): void {
    this._syncStatus = s;
    this._notify();
  }

  private _scheduleSync(listId: string): void {
    if (this._isPulling) return;
    clearTimeout(this._syncTimers.get(listId));
    this._syncTimers.set(listId, setTimeout(() => this._pushUpdate(listId), 800));
  }

  private async _pushUpdate(listId: string): Promise<void> {
    if (this._offlineMode) return;
    const list = this._lists.get(listId);
    const url  = this._effectiveWorkerUrl();
    if (!list || url.includes('YOUR_WORKER')) return;
    const store  = this.getOrCreateCRDT(listId);
    const framed = store.encodeFullState();
    if (!framed || framed.length <= 4) return;
    try {
      this._setSyncStatus('syncing');
      const r = await fetch(url + '/' + list.roomId, {
        method: 'POST', body: framed.buffer as ArrayBuffer,
        headers: { 'Content-Type': 'application/octet-stream' },
      });
      this._setSyncStatus(r.ok ? 'synced' : 'error');
    } catch { this._setSyncStatus('error'); }
  }

  private async _pullUpdate(listId: string): Promise<void> {
    if (this._offlineMode) return;
    const list = this._lists.get(listId);
    const url  = this._effectiveWorkerUrl();
    if (!list || url.includes('YOUR_WORKER')) return;
    try {
      const r = await fetch(url + '/' + list.roomId);
      if (r.status === 204) return;
      if (r.ok) {
        const buf    = await r.arrayBuffer();
        const store  = this.getOrCreateCRDT(listId);
        const deltas = decodeUpdates(buf);
        if (deltas.length > 0) {
          this._isPulling = true;
          store.applyUpdate(deltas);
          this._isPulling = false;
        }
        this._setSyncStatus('synced');
      }
    } catch { this._setSyncStatus('error'); }
  }

  startPolling(): void {
    setInterval(() => {
      if (this._activeListId) this._pullUpdate(this._activeListId);
    }, 10_000);
  }

  // ── Share URL ────────────────────────────────────────────────────────────────
  buildShareUrl(listId: string): string {
    const list = this._lists.get(listId);
    if (!list) return '';
    const encodedName   = encodeURIComponent(list.name);
    const pluginsB64    = btoa(JSON.stringify(list.plugins));
    return `${location.origin}${location.pathname}#room:${list.roomId}:${encodedName}:${pluginsB64}`;
  }

  parseRoomFromURL(): { roomId: string; name: string; plugins?: PluginState } | null {
    const hash = location.hash.slice(1);
    if (!hash.startsWith('room:')) return null;
    const rest      = hash.slice(5);
    const colonIdx  = rest.indexOf(':');
    if (colonIdx === -1) return { roomId: rest, name: 'Shared List' };
    const roomId    = rest.slice(0, colonIdx);
    const remainder = rest.slice(colonIdx + 1);
    const colonIdx2 = remainder.indexOf(':');
    if (colonIdx2 !== -1) {
      const name      = decodeURIComponent(remainder.slice(0, colonIdx2));
      const pluginsB64 = remainder.slice(colonIdx2 + 1);
      let plugins: PluginState | undefined;
      try { plugins = JSON.parse(atob(pluginsB64)); } catch {}
      return { roomId, name, plugins };
    }
    return { roomId, name: decodeURIComponent(remainder) };
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  private _genId(len = 10): string {
    return Math.random().toString(36).slice(2, 2 + len) +
      Math.random().toString(36).slice(2, 2 + Math.max(0, len - 10));
  }
}

// Singleton
export const appStore = new AppStore();
