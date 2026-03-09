import type { Task, Action, TaskEntry, ActionEntry, DailyLog } from "../types";

export interface Repository {
    // Tasks
    getTasks(userId: string): Promise<Task[]>;
    createTask(task: Task): Promise<void>;
    updateTask(userId: string, taskId: string, patch: Partial<Task>): Promise<void>;
    deleteTask(userId: string, taskId: string): Promise<void>;

    // Actions
    getActions(userId: string): Promise<Action[]>;
    createAction(action: Action): Promise<void>;
    updateAction(userId: string, actionId: string, patch: Partial<Action>): Promise<void>;
    deleteAction(userId: string, actionId: string): Promise<void>;

    // Task Entries
    getTodayTaskEntries(userId: string, day: string): Promise<TaskEntry[]>;
    getDoneTaskEntryIds(userId: string): Promise<string[]>;
    upsertTaskEntry(entry: TaskEntry): Promise<void>;

    // Action Entries
    getTodayActionEntries(userId: string, day: string): Promise<ActionEntry[]>;
    createActionEntry(entry: ActionEntry): Promise<void>;
    updateActionEntry(userId: string, entryId: string, patch: Partial<ActionEntry>): Promise<void>;
    deleteActionEntry(userId: string, entryId: string): Promise<void>;

    // Daily Logs
    getDailyLog(userId: string, day: string): Promise<DailyLog | null>;
    upsertDailyLog(log: DailyLog): Promise<void>;
}
