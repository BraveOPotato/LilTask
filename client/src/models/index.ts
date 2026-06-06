// ─── TodoItem ─────────────────────────────────────────────────────────────────
export type RecurrenceType = 'daily' | 'weekly' | 'monthly';

export interface RecurrenceInfo {
  type: RecurrenceType;
  /** How many completions count as "done" per period (default 1) */
  periodTotal: number;
  /** If true, show counter stepper instead of checkbox */
  earlyCompletion: boolean;
}

export interface TodoItemData {
  id: string;
  text: string;
  done: boolean;
  deleted: boolean;
  hlc: string;
  dueDate?: string;        // 'YYYY-MM-DD'
  category?: string;
}

export class TodoItem {
  readonly id: string;
  text: string;
  done: boolean;
  deleted: boolean;
  readonly hlc: string;
  dueDate?: string;
  category?: string;

  constructor(data: TodoItemData) {
    this.id       = data.id;
    this.text     = data.text;
    this.done     = data.done;
    this.deleted  = data.deleted;
    this.hlc      = data.hlc;
    this.dueDate  = data.dueDate;
    this.category = data.category;
  }

  isOverdue(): boolean {
    if (!this.dueDate || this.done) return false;
    return this.dueDate < todayKey();
  }

  isDueToday(): boolean {
    return this.dueDate === todayKey();
  }

  toJSON(): TodoItemData {
    return {
      id: this.id, text: this.text, done: this.done,
      deleted: this.deleted, hlc: this.hlc,
      dueDate: this.dueDate, category: this.category,
    };
  }

  static from(data: TodoItemData): TodoItem {
    return new TodoItem(data);
  }
}

// ─── RecurringTask ───────────────────────────────────────────────────────────
export interface RecurringTaskData {
  id: string;
  text: string;
  type: RecurrenceType;
  periodTotal: number;
  earlyCompletion: boolean;
  createdAt: string;
  /** For weekly: days of week to fire (0=Sun…6=Sat). Empty = every day of week. */
  weekDays?: number[];
  /** For monthly: days of month to fire (1–31). Empty = day 1. */
  monthDays?: number[];
}

export class RecurringTask {
  readonly id: string;
  text: string;
  type: RecurrenceType;
  periodTotal: number;
  earlyCompletion: boolean;
  readonly createdAt: string;
  weekDays: number[];
  monthDays: number[];

  constructor(data: RecurringTaskData) {
    this.id              = data.id;
    this.text            = data.text;
    this.type            = data.type;
    this.periodTotal     = data.periodTotal;
    this.earlyCompletion = data.earlyCompletion;
    this.createdAt       = data.createdAt;
    this.weekDays        = data.weekDays  ?? [];
    this.monthDays       = data.monthDays ?? [];
  }

  getPeriodKey(date?: Date): string {
    return getRecurringPeriodKey(this.type, date);
  }

  isDueOn(date: Date): boolean {
    if (this.type === 'daily') return true;
    if (this.type === 'weekly') {
      const days = this.weekDays.length > 0 ? this.weekDays : [1]; // default Monday
      return days.includes(date.getDay());
    }
    // monthly
    const days = this.monthDays.length > 0 ? this.monthDays : [1];
    return days.includes(date.getDate());
  }

  toJSON(): RecurringTaskData {
    return {
      id: this.id, text: this.text, type: this.type,
      periodTotal: this.periodTotal,
      earlyCompletion: this.earlyCompletion,
      createdAt: this.createdAt,
      weekDays: this.weekDays,
      monthDays: this.monthDays,
    };
  }

  static from(data: RecurringTaskData): RecurringTask {
    return new RecurringTask(data);
  }
}

// ─── TaskList ─────────────────────────────────────────────────────────────────
export interface PluginState {
  categoryGroup: boolean;
  finishRewards: boolean;
}

export const DEFAULT_PLUGINS: PluginState = {
  categoryGroup: false,
  finishRewards: true,
};

export interface TaskListData {
  id: string;
  name: string;
  roomId: string;
  plugins?: PluginState;
  syncEnabled?: boolean;
}

export class TaskList {
  readonly id: string;
  name: string;
  readonly roomId: string;
  plugins: PluginState;
  syncEnabled: boolean;

  constructor(data: TaskListData) {
    this.id          = data.id;
    this.name        = data.name;
    this.roomId      = data.roomId;
    this.plugins     = data.plugins ?? { ...DEFAULT_PLUGINS };
    this.syncEnabled = data.syncEnabled ?? false;
  }

  isPlaceholder(): boolean {
    return this.name === '__placeholder__';
  }

  toJSON(): TaskListData {
    return { id: this.id, name: this.name, roomId: this.roomId, plugins: this.plugins, syncEnabled: this.syncEnabled };
  }

  static from(data: TaskListData): TaskList {
    return new TaskList(data);
  }
}

// ─── Date helpers ────────────────────────────────────────────────────────────
export function todayKey(): string {
  const t = new Date();
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
}

function pad(n: number): string { return String(n).padStart(2, '0'); }

export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function getISOWeek(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function weekKey(date: Date): string {
  const day = date.getDay();
  const monday = new Date(date);
  monday.setDate(date.getDate() - day + (day === 0 ? -6 : 1));
  return `${monday.getFullYear()}-W${String(getISOWeek(monday)).padStart(2, '0')}`;
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

export function getRecurringPeriodKey(type: RecurrenceType, date?: Date): string {
  const d = date ?? new Date();
  if (type === 'daily')   return dateKey(d);
  if (type === 'weekly')  return weekKey(d);
  return monthKey(d);
}

export function isRecurringDueOn(type: RecurrenceType, date: Date): boolean {
  if (type === 'daily')   return true;
  if (type === 'weekly')  return date.getDay() === 1; // Monday
  return date.getDate() === 1;
}
