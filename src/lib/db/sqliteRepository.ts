import type { Task, Action, TaskEntry, ActionEntry, DailyLog, NotificationSettings } from "../types";
import type { Repository } from "./repository";
import { Capacitor } from "@capacitor/core";
import { initSqlite, DB_NAME, sqlite } from "./initSqlite";

export class SqliteRepository implements Repository {
    private async getDb() {
        try {
            return await initSqlite();
        } catch (e: any) {
            console.error("[SqliteRepository] Failed to get database:", e);
            throw new Error(`SQLite DB not initialized: ${e.message || e}`);
        }
    }

    private async save() {
        if (Capacitor.getPlatform() === "web") {
            await sqlite.saveToStore(DB_NAME);
        }
    }

    // --- Tasks ---
    async getTasks(userId: string): Promise<Task[]> {
        const db = await this.getDb();
        const res = await db.query(
            `SELECT * FROM tasks WHERE user_id = ? ORDER BY due_date ASC`,
            [userId]
        );
        return (res.values ?? []).map((r: any) => ({
            ...r,
            is_active: r.is_active === 1,
            is_hidden: r.is_hidden === 1,
        }));
    }

    async createTask(task: Task): Promise<void> {
        const db = await this.getDb();
        if (!task.id) task.id = crypto.randomUUID();
        const now = new Date().toISOString();
        await db.run(
            `INSERT INTO tasks (id, user_id, title, task_type, due_date, is_active, is_hidden, priority, volume, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                task.id,
                task.user_id,
                task.title,
                task.task_type,
                task.due_date,
                task.is_active ? 1 : 0,
                task.is_hidden ? 1 : 0,
                task.priority,
                task.volume,
                now
            ]
        );
        await this.save();
    }

    async updateTask(userId: string, taskId: string, patch: Partial<Task>): Promise<void> {
        const db = await this.getDb();
        const sets: string[] = [];
        const values: any[] = [];
        const now = new Date().toISOString();

        for (const [key, val] of Object.entries(patch)) {
            sets.push(`${key} = ?`);
            values.push(typeof val === "boolean" ? (val ? 1 : 0) : val);
        }
        if (sets.length === 0) return;

        sets.push(`updated_at = ?`);
        values.push(now);

        values.push(userId, taskId);
        await db.run(
            `UPDATE tasks SET ${sets.join(", ")} WHERE user_id = ? AND id = ?`,
            values
        );
        await this.save();
    }

    async deleteTask(userId: string, taskId: string): Promise<void> {
        const db = await this.getDb();
        await db.run(`DELETE FROM tasks WHERE user_id = ? AND id = ?`, [userId, taskId]);
        await this.save();
    }

    // --- Actions ---
    async getActions(userId: string): Promise<Action[]> {
        const db = await this.getDb();
        const res = await db.query(
            `SELECT * FROM actions WHERE user_id = ? ORDER BY created_at ASC`,
            [userId]
        );
        return (res.values ?? []).map((r: any) => ({
            ...r,
            is_active: r.is_active === 1,
            is_hidden: r.is_hidden === 1,
        }));
    }

    async createAction(action: Action): Promise<void> {
        const db = await this.getDb();
        if (!action.id) action.id = crypto.randomUUID();
        const now = new Date().toISOString();
        await db.run(
            `INSERT INTO actions (id, user_id, category, kind, is_active, is_hidden, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                action.id,
                action.user_id,
                action.category,
                action.kind,
                action.is_active ? 1 : 0,
                action.is_hidden ? 1 : 0,
                action.created_at || now,
                now
            ]
        );
        await this.save();
    }

    async updateAction(userId: string, actionId: string, patch: Partial<Action>): Promise<void> {
        const db = await this.getDb();
        const sets: string[] = [];
        const values: any[] = [];
        const now = new Date().toISOString();

        for (const [key, val] of Object.entries(patch)) {
            sets.push(`${key} = ?`);
            values.push(typeof val === "boolean" ? (val ? 1 : 0) : val);
        }
        if (sets.length === 0) return;

        sets.push(`updated_at = ?`);
        values.push(now);

        values.push(userId, actionId);
        await db.run(
            `UPDATE actions SET ${sets.join(", ")} WHERE user_id = ? AND id = ?`,
            values
        );
        await this.save();
    }

    async deleteAction(userId: string, actionId: string): Promise<void> {
        const db = await this.getDb();
        await db.run(`DELETE FROM actions WHERE user_id = ? AND id = ?`, [userId, actionId]);
        await this.save();
    }

    // --- Task Entries ---
    async getTodayTaskEntries(userId: string, day: string): Promise<TaskEntry[]> {
        const db = await this.getDb();
        const res = await db.query(
            `SELECT * FROM task_entries WHERE user_id = ? AND day = ?`,
            [userId, day]
        );
        return res.values as TaskEntry[] ?? [];
    }

    async getDoneTaskEntryIds(userId: string): Promise<string[]> {
        const db = await this.getDb();
        const res = await db.query(
            `SELECT task_id FROM task_entries WHERE user_id = ? AND status = 'done'`,
            [userId]
        );
        return (res.values ?? []).map((r: any) => r.task_id);
    }

    async upsertTaskEntry(entry: TaskEntry): Promise<void> {
        const db = await this.getDb();
        if (!entry.id) entry.id = crypto.randomUUID();
        const now = new Date().toISOString();
        await db.run(
            `INSERT INTO task_entries (id, user_id, day, task_id, status, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, day, task_id) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at`,
            [entry.id, entry.user_id, entry.day, entry.task_id, entry.status, now]
        );
        await this.save();
    }

    // --- Action Entries ---
    async getTodayActionEntries(userId: string, day: string): Promise<ActionEntry[]> {
        const db = await this.getDb();
        const res = await db.query(
            `SELECT * FROM action_entries WHERE user_id = ? AND day = ? ORDER BY created_at ASC`,
            [userId, day]
        );
        return res.values as ActionEntry[] ?? [];
    }

    async createActionEntry(entry: ActionEntry): Promise<void> {
        const db = await this.getDb();
        if (!entry.id) entry.id = crypto.randomUUID();
        const now = new Date().toISOString();
        await db.run(
            `INSERT INTO action_entries (id, user_id, day, action_id, note, volume, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                entry.id,
                entry.user_id,
                entry.day,
                entry.action_id,
                entry.note,
                entry.volume,
                entry.created_at || now,
                now
            ]
        );
        await this.save();
    }

    async updateActionEntry(userId: string, entryId: string, patch: Partial<ActionEntry>): Promise<void> {
        const db = await this.getDb();
        const sets: string[] = [];
        const values: any[] = [];
        const now = new Date().toISOString();

        for (const [key, val] of Object.entries(patch)) {
            sets.push(`${key} = ?`);
            values.push(typeof val === "boolean" ? (val ? 1 : 0) : val);
        }
        if (sets.length === 0) return;

        sets.push(`updated_at = ?`);
        values.push(now);

        values.push(userId, entryId);
        await db.run(
            `UPDATE action_entries SET ${sets.join(", ")} WHERE user_id = ? AND id = ?`,
            values
        );
        await this.save();
    }

    async deleteActionEntry(userId: string, entryId: string): Promise<void> {
        const db = await this.getDb();
        await db.run(`DELETE FROM action_entries WHERE user_id = ? AND id = ?`, [userId, entryId]);
        await this.save();
    }

    // --- Daily Logs ---
    async getDailyLog(userId: string, day: string): Promise<DailyLog | null> {
        const db = await this.getDb();
        const res = await db.query(
            `SELECT * FROM daily_logs WHERE user_id = ? AND day = ?`,
            [userId, day]
        );
        if (!res.values || res.values.length === 0) return null;
        return res.values[0] as DailyLog;
    }

    async upsertDailyLog(log: DailyLog): Promise<void> {
        const db = await this.getDb();
        if (!log.id) log.id = crypto.randomUUID();
        const now = new Date().toISOString();

        const existing = await db.query(`SELECT id FROM daily_logs WHERE day = ?`, [log.day]);

        if (existing.values && existing.values.length > 0) {
            const existingId = existing.values[0].id;
            await db.run(
                `UPDATE daily_logs SET 
                 user_id = ?, note = ?, satisfaction = ?, task_total = ?, action_total = ?, 
                 total_score = ?, task_ratio = ?, action_ratio = ?, balance_factor = ?, 
                 fulfillment = ?, updated_at = ?
                 WHERE id = ?`,
                [
                    log.user_id, log.note, log.satisfaction, log.task_total, log.action_total,
                    log.total_score, log.task_ratio, log.action_ratio, log.balance_factor,
                    log.fulfillment, now, existingId
                ]
            );
        } else {
            await db.run(
                `INSERT INTO daily_logs 
                 (id, user_id, day, note, satisfaction, task_total, action_total, total_score, task_ratio, action_ratio, balance_factor, fulfillment, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    log.id, log.user_id, log.day, log.note, log.satisfaction,
                    log.task_total, log.action_total, log.total_score,
                    log.task_ratio, log.action_ratio, log.balance_factor, log.fulfillment,
                    now
                ]
            );
        }
        await this.save();
    }

    // --- Notification Settings ---
    async getNotificationSettings(userId: string): Promise<NotificationSettings | null> {
        const db = await this.getDb();
        const res = await db.query(
            `SELECT * FROM notification_settings WHERE user_id = ?`,
            [userId]
        );
        if (!res.values || res.values.length === 0) return null;
        const raw = res.values[0];
        return {
            ...raw,
            habit_remind_on: raw.habit_remind_on === 1,
            task_remind_on: raw.task_remind_on === 1,
            review_remind_on: raw.review_remind_on === 1,
        } as NotificationSettings;
    }

    async upsertNotificationSettings(settings: NotificationSettings): Promise<void> {
        const db = await this.getDb();
        const now = new Date().toISOString();
        const existing = await db.query(`SELECT id FROM notification_settings WHERE user_id = ?`, [settings.user_id]);

        if (existing.values && existing.values.length > 0) {
            await db.run(
                `UPDATE notification_settings SET 
                 habit_remind_on = ?, habit_remind_hour = ?, task_remind_on = ?, task_remind_hour = ?, 
                 task_remind_timing = ?, review_remind_on = ?, review_remind_hour = ?, updated_at = ?
                 WHERE user_id = ?`,
                [
                    settings.habit_remind_on ? 1 : 0, settings.habit_remind_hour,
                    settings.task_remind_on ? 1 : 0, settings.task_remind_hour,
                    settings.task_remind_timing,
                    settings.review_remind_on ? 1 : 0, settings.review_remind_hour,
                    now, settings.user_id
                ]
            );
        } else {
            await db.run(
                `INSERT INTO notification_settings 
                 (id, user_id, habit_remind_on, habit_remind_hour, task_remind_on, task_remind_hour, task_remind_timing, review_remind_on, review_remind_hour, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    settings.id || crypto.randomUUID(), settings.user_id,
                    settings.habit_remind_on ? 1 : 0, settings.habit_remind_hour,
                    settings.task_remind_on ? 1 : 0, settings.task_remind_hour,
                    settings.task_remind_timing,
                    settings.review_remind_on ? 1 : 0, settings.review_remind_hour,
                    now
                ]
            );
        }
        await this.save();
    }

    // --- Data Migration & Deduplication ---
    async migrate(oldUserId: string, newUserId: string): Promise<void> {
        const db = await this.getDb();
        try {
            // 1. 全テーブルのIDを付け替え
            const tables = ['tasks', 'actions', 'task_entries', 'action_entries', 'daily_logs'];
            for (const table of tables) {
                await db.run(`UPDATE ${table} SET user_id = ? WHERE user_id = ?`, [newUserId, oldUserId]);
            }

            // 2. Deduplication (Tasks)
            // 同名・同設定のタスクを取得
            const resTasks = await db.query(
                `SELECT title, task_type, priority, volume, COUNT(*) as c 
                 FROM tasks WHERE user_id = ? 
                 GROUP BY title, task_type, priority, volume HAVING c > 1`,
                [newUserId]
            );

            for (const dup of resTasks.values || []) {
                const sameTasks = await db.query(
                    `SELECT id, updated_at FROM tasks 
                     WHERE user_id = ? AND title = ? AND task_type = ? AND priority = ? AND volume = ? 
                     ORDER BY updated_at DESC`,
                    [newUserId, dup.title, dup.task_type, dup.priority, dup.volume]
                );

                if (!sameTasks.values || sameTasks.values.length < 2) continue;

                const masterId = sameTasks.values[0].id;
                const otherIds = sameTasks.values.slice(1).map((r: any) => r.id);

                // 履歴データをマスターへ統合
                for (const oldId of otherIds) {
                    await db.run(`UPDATE task_entries SET task_id = ? WHERE task_id = ?`, [masterId, oldId]);
                    await db.run(`DELETE FROM tasks WHERE id = ?`, [oldId]);
                }
            }

            // 3. Deduplication (Actions)
            const resActions = await db.query(
                `SELECT category, kind, COUNT(*) as c 
                 FROM actions WHERE user_id = ? 
                 GROUP BY category, kind HAVING c > 1`,
                [newUserId]
            );

            for (const dup of resActions.values || []) {
                const sameActions = await db.query(
                    `SELECT id, updated_at FROM actions 
                     WHERE user_id = ? AND category = ? AND kind = ? 
                     ORDER BY updated_at DESC`,
                    [newUserId, dup.category, dup.kind]
                );

                if (!sameActions.values || sameActions.values.length < 2) continue;

                const masterId = sameActions.values[0].id;
                const otherIds = sameActions.values.slice(1).map((r: any) => r.id);

                for (const oldId of otherIds) {
                    await db.run(`UPDATE action_entries SET action_id = ? WHERE action_id = ?`, [masterId, oldId]);
                    await db.run(`DELETE FROM actions WHERE id = ?`, [oldId]);
                }
            }

            await this.save();
        } catch (e) {
            console.error("Migration error:", e);
            throw e;
        }
    }

    // --- Cloud Sync ---
    async sync(userId: string): Promise<{ success: boolean; message: string }> {
        try {
            const { supabase } = await import("../supabase");
            const db = await this.getDb();
            // 1. 各テーブルのデータを取得
            const tables = ["tasks", "actions", "task_entries", "action_entries", "daily_logs", "notification_settings"];

            for (const table of tables) {
                const localData = (await db.query(`SELECT * FROM ${table} WHERE user_id = ?`, [userId])).values || [];
                const { data: remoteData, error: selectError } = await supabase.from(table).select("*").eq("user_id", userId);
                if (selectError) throw selectError;

                const remoteMap = new Map(remoteData?.map(r => [r.id, r]) || []);

                // A. Local to Remote (Push)
                for (const local of localData) {
                    const remote = remoteMap.get(local.id);
                    // updated_at が local の方が新しい場合か、リモートに存在しない場合に upsert
                    if (!remote || new Date(local.updated_at) > new Date(remote.updated_at)) {
                        const { error: upsertError } = await supabase.from(table).upsert(local);
                        if (upsertError) throw upsertError;
                    }
                }

                // B. Remote to Local (Pull)
                const { data: latestRemote, error: pullError } = await supabase.from(table).select("*").eq("user_id", userId);
                if (pullError) throw pullError;
                for (const remote of latestRemote || []) {
                    const localRes = await db.query(`SELECT updated_at FROM ${table} WHERE id = ?`, [remote.id]);
                    const local = localRes.values?.[0];

                    if (!local || new Date(remote.updated_at) > new Date(local.updated_at)) {
                        if (table === "tasks") {
                            await db.run(`INSERT INTO tasks (id, user_id, title, task_type, due_date, is_active, is_hidden, priority, volume, updated_at) 
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET 
                                title=excluded.title, task_type=excluded.task_type, due_date=excluded.due_date, 
                                is_active=excluded.is_active, is_hidden=excluded.is_hidden, priority=excluded.priority, 
                                volume=excluded.volume, updated_at=excluded.updated_at`,
                                [remote.id, remote.user_id, remote.title, remote.task_type, remote.due_date, remote.is_active, remote.is_hidden, remote.priority, remote.volume, remote.updated_at]);
                        } else if (table === "actions") {
                            await db.run(`INSERT INTO actions (id, user_id, category, kind, is_active, is_hidden, created_at, updated_at) 
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET 
                                category=excluded.category, kind=excluded.kind, is_active=excluded.is_active, 
                                is_hidden=excluded.is_hidden, created_at=excluded.created_at, updated_at=excluded.updated_at`,
                                [remote.id, remote.user_id, remote.category, remote.kind, remote.is_active, remote.is_hidden, remote.created_at, remote.updated_at]);
                        } else if (table === "task_entries") {
                            await db.run(`INSERT INTO task_entries (id, user_id, day, task_id, status, updated_at) 
                                VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, day, task_id) DO UPDATE SET status=excluded.status, updated_at=excluded.updated_at`,
                                [remote.id, remote.user_id, remote.day, remote.task_id, remote.status, remote.updated_at]);
                        } else if (table === "action_entries") {
                            await db.run(`INSERT INTO action_entries (id, user_id, day, action_id, note, volume, created_at, updated_at) 
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET 
                                note=excluded.note, volume=excluded.volume, created_at=excluded.created_at, updated_at=excluded.updated_at`,
                                [remote.id, remote.user_id, remote.day, remote.action_id, remote.note, remote.volume, remote.created_at, remote.updated_at]);
                        } else if (table === "daily_logs") {
                            const existing = await db.query(`SELECT id FROM daily_logs WHERE day = ?`, [remote.day]);
                            if (existing.values && existing.values.length > 0) {
                                await db.run(`UPDATE daily_logs SET 
                                    user_id=?, note=?, satisfaction=?, task_total=?, action_total=?, total_score=?, 
                                    task_ratio=?, action_ratio=?, balance_factor=?, fulfillment=?, updated_at=?
                                    WHERE day=?`,
                                    [remote.user_id, remote.note, remote.satisfaction, remote.task_total, remote.action_total, remote.total_score, remote.task_ratio, remote.action_ratio, remote.balance_factor, remote.fulfillment, remote.updated_at, remote.day]);
                            } else {
                                await db.run(`INSERT INTO daily_logs (id, user_id, day, note, satisfaction, task_total, action_total, total_score, task_ratio, action_ratio, balance_factor, fulfillment, updated_at) 
                                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                                    [remote.id, remote.user_id, remote.day, remote.note, remote.satisfaction, remote.task_total, remote.action_total, remote.total_score, remote.task_ratio, remote.action_ratio, remote.balance_factor, remote.fulfillment, remote.updated_at]);
                            }
                        } else if (table === "notification_settings") {
                            const existing = await db.query(`SELECT id FROM notification_settings WHERE user_id = ?`, [remote.user_id]);
                            if (existing.values && existing.values.length > 0) {
                                await db.run(`UPDATE notification_settings SET 
                                    habit_remind_on=?, habit_remind_hour=?, task_remind_on=?, task_remind_hour=?, 
                                    task_remind_timing=?, review_remind_on=?, review_remind_hour=?, updated_at=?
                                    WHERE user_id=?`,
                                    [remote.habit_remind_on, remote.habit_remind_hour, remote.task_remind_on, remote.task_remind_hour, remote.task_remind_timing, remote.review_remind_on, remote.review_remind_hour, remote.updated_at, remote.user_id]);
                            } else {
                                await db.run(`INSERT INTO notification_settings (id, user_id, habit_remind_on, habit_remind_hour, task_remind_on, task_remind_hour, task_remind_timing, review_remind_on, review_remind_hour, updated_at) 
                                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                                    [remote.id, remote.user_id, remote.habit_remind_on, remote.habit_remind_hour, remote.task_remind_on, remote.task_remind_hour, remote.task_remind_timing, remote.review_remind_on, remote.review_remind_hour, remote.updated_at]);
                            }
                        }
                    }
                }
            }

            // 同期語のDeduplication（他のデバイスからの重複をクリーンアップ）
            await this.migrate(userId, userId);
            await this.save();
            return { success: true, message: "同期が完了しました" };
        } catch (err: any) {
            console.error("Sync error:", err);
            return { success: false, message: `同期エラー: ${err.message}` };
        }
    }
}
