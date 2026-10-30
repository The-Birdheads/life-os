import type {
    Task, Action, TaskEntry, ActionEntry, DailyLog,
    MandalaChart, MandalaCell, MandalaCellEvent, MandalaReview, TaskEntryBounds,
} from "../types";

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
    getDoingTaskEntries(userId: string): Promise<{ task_id: string; day: string }[]>;
    resetTaskEntries(userId: string, taskId: string, statuses: ("done" | "doing")[]): Promise<void>;

    // Action Entries
    getTodayActionEntries(userId: string, day: string): Promise<ActionEntry[]>;
    createActionEntry(entry: ActionEntry): Promise<void>;
    updateActionEntry(userId: string, entryId: string, patch: Partial<ActionEntry>): Promise<void>;
    deleteActionEntry(userId: string, entryId: string): Promise<void>;

    // Daily Logs
    getDailyLog(userId: string, day: string): Promise<DailyLog | null>;
    upsertDailyLog(log: DailyLog): Promise<void>;

    // Mandala Chart
    getActiveChart(userId: string): Promise<MandalaChart | null>;
    upsertChart(chart: MandalaChart): Promise<void>;
    getCells(userId: string, chartId: string): Promise<MandalaCell[]>;
    upsertCell(cell: MandalaCell): Promise<void>;
    addCellEvent(event: Omit<MandalaCellEvent, "id" | "created_at"> & { id?: string }): Promise<void>;
    getCellEvents(userId: string, cellId: string): Promise<MandalaCellEvent[]>;
    /** 自分で並べた順を保存する(ids の順に上から) */
    setTaskOrder(userId: string, ids: string[]): Promise<void>;
    /** 種類ごとの変更の履歴(全部のマス、古い順) */
    getCellEventsByKind(userId: string, kind: MandalaCellEvent["kind"]): Promise<MandalaCellEvent[]>;
    getReviews(userId: string, chartId: string): Promise<MandalaReview[]>;
    createReview(review: Omit<MandalaReview, "id"> & { id?: string }): Promise<void>;
    getTaskEntriesBetween(userId: string, from: string, to: string): Promise<TaskEntry[]>;
    getTaskEntryBounds(userId: string): Promise<TaskEntryBounds[]>;

    // Account Deletion
    deleteAllUserData(userId: string): Promise<void>;
}
