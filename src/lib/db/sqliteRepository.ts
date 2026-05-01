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

    /**
     * ベストエフォートでSupabaseへupsert。
     * オフライン・未ログイン時は例外をキャッチして無視し、次のsync()で補完する。
     */
    private async _tryPush(table: string, record: Record<string, any>, onConflict = 'id'): Promise<void> {
        try {
            const { supabase } = await import('../supabase');
            await supabase.from(table).upsert(record, { onConflict });
        } catch (_) { /* offline / 未ログイン時は次の sync() で補完 */ }
    }

    // --- Tasks ---
    async getTasks(userId: string): Promise<Task[]> {
        const db = await this.getDb();
        const res = await db.query(
            `SELECT * FROM tasks WHERE user_id = ? AND deleted_at IS NULL ORDER BY due_date ASC`,
            [userId]
        );
        return (res.values ?? []).map((r: any) => ({
            ...r,
            is_active: r.is_active === 1,
            is_hidden: r.is_hidden === 1,
            remind_on: r.remind_on === 1,
            remind_hour: r.remind_hour ?? 8,
            remind_minute: r.remind_minute ?? 0,
        }));
    }

    async createTask(task: Task): Promise<void> {
        const db = await this.getDb();
        if (!task.id) task.id = crypto.randomUUID();
        const now = new Date().toISOString();
        await db.run(
            `INSERT INTO tasks (id, user_id, title, task_type, due_date, is_active, is_hidden, priority, volume, memo, remind_on, remind_hour, remind_minute, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
                task.memo ?? null,
                task.remind_on ? 1 : 0,
                task.remind_hour ?? 8,
                task.remind_minute ?? 0,
                now
            ]
        );
        await this.save();
        await this._tryPush('tasks', {
            id: task.id, user_id: task.user_id, title: task.title, task_type: task.task_type,
            due_date: task.due_date ?? null, is_active: task.is_active ? 1 : 0, is_hidden: task.is_hidden ? 1 : 0,
            priority: task.priority, volume: task.volume, memo: task.memo ?? null,
            remind_on: task.remind_on ? 1 : 0, remind_hour: task.remind_hour ?? 8, remind_minute: task.remind_minute ?? 0,
            deleted_at: null, updated_at: now,
        });
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
        // 更新後の全カラムを再取得してプッシュ（部分パッチの代わりにフル upsert）
        const rec = (await db.query('SELECT * FROM tasks WHERE id = ? AND user_id = ?', [taskId, userId])).values?.[0];
        if (rec) await this._tryPush('tasks', rec);
    }

    async deleteTask(userId: string, taskId: string): Promise<void> {
        const db = await this.getDb();
        const now = new Date().toISOString();
        await db.run(`UPDATE tasks SET deleted_at = ?, updated_at = ? WHERE user_id = ? AND id = ?`, [now, now, userId, taskId]);
        await this.save();
        try {
            const { supabase } = await import("../supabase");
            await supabase.from("tasks").update({ deleted_at: now, updated_at: now }).eq("user_id", userId).eq("id", taskId);
        } catch (_) { /* オフライン時は無視 */ }
    }

    // --- Actions ---
    async getActions(userId: string): Promise<Action[]> {
        const db = await this.getDb();
        const res = await db.query(
            `SELECT * FROM actions WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at ASC`,
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
        await this._tryPush('actions', {
            id: action.id, user_id: action.user_id, category: action.category, kind: action.kind,
            is_active: action.is_active ? 1 : 0, is_hidden: action.is_hidden ? 1 : 0,
            created_at: action.created_at || now, deleted_at: null, updated_at: now,
        });
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
        const rec = (await db.query('SELECT * FROM actions WHERE id = ? AND user_id = ?', [actionId, userId])).values?.[0];
        if (rec) await this._tryPush('actions', rec);
    }

    async deleteAction(userId: string, actionId: string): Promise<void> {
        const db = await this.getDb();
        const now = new Date().toISOString();
        await db.run(`UPDATE actions SET deleted_at = ?, updated_at = ? WHERE user_id = ? AND id = ?`, [now, now, userId, actionId]);
        await this.save();
        try {
            const { supabase } = await import("../supabase");
            await supabase.from("actions").update({ deleted_at: now, updated_at: now }).eq("user_id", userId).eq("id", actionId);
        } catch (_) { /* オフライン時は無視 */ }
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
        await this._tryPush('task_entries', {
            id: entry.id, user_id: entry.user_id, day: entry.day,
            task_id: entry.task_id, status: entry.status, updated_at: now,
        }, 'user_id,day,task_id');
    }

    // --- Action Entries ---
    async getTodayActionEntries(userId: string, day: string): Promise<ActionEntry[]> {
        const db = await this.getDb();
        const res = await db.query(
            `SELECT * FROM action_entries WHERE user_id = ? AND day = ? AND deleted_at IS NULL ORDER BY created_at ASC`,
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
        await this._tryPush('action_entries', {
            id: entry.id, user_id: entry.user_id, day: entry.day, action_id: entry.action_id,
            note: entry.note ?? null, volume: entry.volume ?? null,
            created_at: entry.created_at || now, deleted_at: null, updated_at: now,
        });
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
        const rec = (await db.query('SELECT * FROM action_entries WHERE id = ? AND user_id = ?', [entryId, userId])).values?.[0];
        if (rec) await this._tryPush('action_entries', rec);
    }

    async deleteActionEntry(userId: string, entryId: string): Promise<void> {
        const db = await this.getDb();
        const now = new Date().toISOString();
        await db.run(`UPDATE action_entries SET deleted_at = ?, updated_at = ? WHERE user_id = ? AND id = ?`, [now, now, userId, entryId]);
        await this.save();
        try {
            const { supabase } = await import("../supabase");
            await supabase.from("action_entries").update({ deleted_at: now, updated_at: now }).eq("user_id", userId).eq("id", entryId);
        } catch (_) { /* オフライン時は無視 */ }
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

        const existing = await db.query(`SELECT id FROM daily_logs WHERE user_id = ? AND day = ?`, [log.user_id, log.day]);

        if (existing.values && existing.values.length > 0) {
            const existingId = existing.values[0].id;
            await db.run(
                `UPDATE daily_logs SET
                 user_id = ?, note = ?, satisfaction = ?, task_total = ?, action_total = ?,
                 total_score = ?, task_ratio = ?, action_ratio = ?, balance_factor = ?,
                 fulfillment = ?, tomorrow_note = ?, yesterday_achievement = ?, updated_at = ?
                 WHERE id = ?`,
                [
                    log.user_id, log.note, log.satisfaction, log.task_total, log.action_total,
                    log.total_score, log.task_ratio, log.action_ratio, log.balance_factor,
                    log.fulfillment, log.tomorrow_note ?? null, log.yesterday_achievement ?? null,
                    now, existingId
                ]
            );
        } else {
            await db.run(
                `INSERT INTO daily_logs
                 (id, user_id, day, note, satisfaction, task_total, action_total, total_score, task_ratio, action_ratio, balance_factor, fulfillment, tomorrow_note, yesterday_achievement, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    log.id, log.user_id, log.day, log.note, log.satisfaction,
                    log.task_total, log.action_total, log.total_score,
                    log.task_ratio, log.action_ratio, log.balance_factor, log.fulfillment,
                    log.tomorrow_note ?? null, log.yesterday_achievement ?? null,
                    now
                ]
            );
        }
        await this.save();
        // 保存後の実際のレコードを再取得してプッシュ（existing の id が log.id と異なる場合があるため）
        const saved = (await db.query('SELECT * FROM daily_logs WHERE user_id = ? AND day = ?', [log.user_id, log.day])).values?.[0];
        if (saved) await this._tryPush('daily_logs', saved, 'user_id,day');
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
            habit_remind_on: !!raw.habit_remind_on,
            habit_remind_hour: raw.habit_remind_hour ?? 18,
            habit_remind_minute: raw.habit_remind_minute ?? 0,
            task_remind_on: !!raw.task_remind_on,
            task_remind_hour: raw.task_remind_hour ?? 10,
            task_remind_minute: raw.task_remind_minute ?? 0,
            review_remind_on: !!raw.review_remind_on,
            review_remind_hour: raw.review_remind_hour ?? 21,
            review_remind_minute: raw.review_remind_minute ?? 0,
            volume_unit: raw.volume_unit ?? '30',
            sort_rule: raw.sort_rule ?? 'priority',
            prioritize_due: !!raw.prioritize_due,
        } as NotificationSettings;
    }

    async upsertNotificationSettings(settings: NotificationSettings): Promise<void> {
        const db = await this.getDb();
        const now = new Date().toISOString();
        const existing = await db.query(`SELECT id FROM notification_settings WHERE user_id = ?`, [settings.user_id]);

        if (existing.values && existing.values.length > 0) {
            await db.run(
                `UPDATE notification_settings SET
                 habit_remind_on = ?, habit_remind_hour = ?, habit_remind_minute = ?,
                 task_remind_on = ?, task_remind_hour = ?, task_remind_minute = ?,
                 task_remind_timing = ?,
                 review_remind_on = ?, review_remind_hour = ?, review_remind_minute = ?,
                 volume_unit = ?, sort_rule = ?, prioritize_due = ?,
                 updated_at = ?
                 WHERE user_id = ?`,
                [
                    settings.habit_remind_on ? 1 : 0, settings.habit_remind_hour, settings.habit_remind_minute ?? 0,
                    settings.task_remind_on ? 1 : 0, settings.task_remind_hour, settings.task_remind_minute ?? 0,
                    settings.task_remind_timing,
                    settings.review_remind_on ? 1 : 0, settings.review_remind_hour, settings.review_remind_minute ?? 0,
                    settings.volume_unit ?? '30', settings.sort_rule ?? 'priority', settings.prioritize_due ? 1 : 0,
                    now, settings.user_id
                ]
            );
        } else {
            await db.run(
                `INSERT INTO notification_settings
                 (id, user_id, habit_remind_on, habit_remind_hour, habit_remind_minute,
                  task_remind_on, task_remind_hour, task_remind_minute, task_remind_timing,
                  review_remind_on, review_remind_hour, review_remind_minute, volume_unit, sort_rule, prioritize_due, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    settings.id || crypto.randomUUID(), settings.user_id,
                    settings.habit_remind_on ? 1 : 0, settings.habit_remind_hour, settings.habit_remind_minute ?? 0,
                    settings.task_remind_on ? 1 : 0, settings.task_remind_hour, settings.task_remind_minute ?? 0,
                    settings.task_remind_timing,
                    settings.review_remind_on ? 1 : 0, settings.review_remind_hour, settings.review_remind_minute ?? 0,
                    settings.volume_unit ?? '30', settings.sort_rule ?? 'priority', settings.prioritize_due ? 1 : 0,
                    now
                ]
            );
        }
        await this.save();
        const savedNs = (await db.query('SELECT * FROM notification_settings WHERE user_id = ?', [settings.user_id])).values?.[0];
        if (savedNs) await this._tryPush('notification_settings', savedNs, 'user_id');
    }

    // --- Account Deletion ---
    async deleteAllUserData(userId: string): Promise<void> {
        const db = await this.getDb();
        // FK依存順に削除（子テーブル → 親テーブル）
        const tables = ['task_entries', 'action_entries', 'daily_logs', 'notification_settings', 'tasks', 'actions'];
        for (const table of tables) {
            await db.run(`DELETE FROM ${table} WHERE user_id = ?`, [userId]);
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
    private _syncInProgress = false;

    async sync(userId: string): Promise<{ success: boolean; message: string }> {
        if (this._syncInProgress) {
            console.warn('[sync] Sync already in progress, skipping');
            return { success: false, message: '同期中です。しばらくお待ちください。' };
        }
        this._syncInProgress = true;
        try {
            const { supabase } = await import("../supabase");

            // セッション確認
            const { data: { session } } = await supabase.auth.getSession();
            console.log("[sync] userId:", userId);
            console.log("[sync] session uid:", session?.user?.id ?? "NO SESSION");
            if (!session) {
                return { success: false, message: "同期エラー: セッションなし" };
            }

            const db = await this.getDb();
            const tables = ["tasks", "actions", "task_entries", "action_entries", "daily_logs", "notification_settings"];

            for (const table of tables) {
                try {
                const localData = (await db.query(`SELECT * FROM ${table} WHERE user_id = ?`, [userId])).values || [];
                const { data: remoteData, error: selectError } = await supabase.from(table).select("*").eq("user_id", userId);
                console.log(`[sync] ${table} — local: ${localData.length}, remote: ${remoteData?.length ?? "ERR"}, error: ${selectError?.message ?? "none"}`);
                if (selectError) throw selectError;

                // notification_settings は user_id が自然キーのため id ではなく user_id でマップを構築する
                const mapKey = (r: any) => table === 'notification_settings' ? r.user_id : r.id;
                const remoteMap = new Map(remoteData?.map(r => [mapKey(r), r]) || []);

                // A. Local to Remote (Push)
                for (const local of localData) {
                    const remote = remoteMap.get(mapKey(local));
                    // updated_at が local の方が新しい場合か、リモートに存在しない場合にプッシュ
                    if (!remote || new Date(local.updated_at) > new Date(remote.updated_at)) {
                        if (table === "task_entries" || table === "daily_logs" || table === "action_entries" || table === "notification_settings") {
                            // 複合キー or user_id キーを持つテーブルは upsert（ON CONFLICT が必要）
                            const onConflict = table === "daily_logs" ? "user_id,day"
                                : table === "task_entries" ? "user_id,day,task_id"
                                : table === "notification_settings" ? "user_id"
                                : "id";
                            const { error: upsertError } = await supabase.from(table).upsert(local, { onConflict });
                            if (upsertError) throw upsertError;
                        } else if (!remote) {
                            // 新規レコード: INSERT
                            const { error: insertError } = await supabase.from(table).insert(local);
                            if (insertError) throw insertError;
                        } else {
                            // 既存レコード: UPDATE（memo=null などの null フィールドも確実に上書きされる）
                            const { error: updateError } = await supabase.from(table).update(local).eq('id', local.id).eq('user_id', userId);
                            if (updateError) throw updateError;
                        }
                    }
                }

                // B. Remote to Local (Pull)
                const { data: latestRemote, error: pullError } = await supabase.from(table).select("*").eq("user_id", userId);
                if (pullError) throw pullError;
                for (const remote of latestRemote || []) {
                    // daily_logs / notification_settings は自然キーで照合する
                    let local: { updated_at: string } | undefined;
                    if (table === "daily_logs") {
                        const dlRes = await db.query(
                            `SELECT updated_at FROM daily_logs WHERE user_id = ? AND day = ?`,
                            [remote.user_id, remote.day]
                        );
                        local = dlRes.values?.[0];
                    } else if (table === "notification_settings") {
                        const nsRes = await db.query(
                            `SELECT updated_at FROM notification_settings WHERE user_id = ?`,
                            [remote.user_id]
                        );
                        local = nsRes.values?.[0];
                    } else {
                        const localRes = await db.query(`SELECT updated_at FROM ${table} WHERE id = ?`, [remote.id]);
                        local = localRes.values?.[0];
                    }

                    if (!local || new Date(remote.updated_at) > new Date(local.updated_at)) {
                        // ソフトデリートのtombstone処理: リモートがdeleted_atを持つ場合はローカルを物理削除
                        if (remote.deleted_at && (table === "tasks" || table === "actions" || table === "action_entries")) {
                            await db.run(`DELETE FROM ${table} WHERE id = ?`, [remote.id]);
                            continue;
                        }

                        if (table === "tasks") {
                            await db.run(`INSERT INTO tasks (id, user_id, title, task_type, due_date, is_active, is_hidden, priority, volume, memo, remind_on, remind_hour, remind_minute, deleted_at, updated_at)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET
                                title=excluded.title, task_type=excluded.task_type, due_date=excluded.due_date,
                                is_active=excluded.is_active, is_hidden=excluded.is_hidden, priority=excluded.priority,
                                volume=excluded.volume, memo=excluded.memo,
                                remind_on=excluded.remind_on, remind_hour=excluded.remind_hour, remind_minute=excluded.remind_minute,
                                deleted_at=excluded.deleted_at, updated_at=excluded.updated_at`,
                                [remote.id, remote.user_id, remote.title, remote.task_type, remote.due_date, remote.is_active, remote.is_hidden, remote.priority, remote.volume, remote.memo ?? null, remote.remind_on ?? 0, remote.remind_hour ?? 8, remote.remind_minute ?? 0, remote.deleted_at ?? null, remote.updated_at]);
                        } else if (table === "actions") {
                            await db.run(`INSERT INTO actions (id, user_id, category, kind, is_active, is_hidden, created_at, deleted_at, updated_at)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET
                                category=excluded.category, kind=excluded.kind, is_active=excluded.is_active,
                                is_hidden=excluded.is_hidden, created_at=excluded.created_at, deleted_at=excluded.deleted_at, updated_at=excluded.updated_at`,
                                [remote.id, remote.user_id, remote.category, remote.kind, remote.is_active, remote.is_hidden, remote.created_at, remote.deleted_at ?? null, remote.updated_at]);
                        } else if (table === "task_entries") {
                            await db.run(`INSERT INTO task_entries (id, user_id, day, task_id, status, updated_at) 
                                VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, day, task_id) DO UPDATE SET status=excluded.status, updated_at=excluded.updated_at`,
                                [remote.id, remote.user_id, remote.day, remote.task_id, remote.status, remote.updated_at]);
                        } else if (table === "action_entries") {
                            await db.run(`INSERT INTO action_entries (id, user_id, day, action_id, note, volume, created_at, deleted_at, updated_at)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET
                                note=excluded.note, volume=excluded.volume, created_at=excluded.created_at, deleted_at=excluded.deleted_at, updated_at=excluded.updated_at`,
                                [remote.id, remote.user_id, remote.day, remote.action_id, remote.note, remote.volume, remote.created_at, remote.deleted_at ?? null, remote.updated_at]);
                        } else if (table === "daily_logs") {
                            const existing = await db.query(`SELECT id FROM daily_logs WHERE user_id = ? AND day = ?`, [remote.user_id, remote.day]);
                            if (existing.values && existing.values.length > 0) {
                                await db.run(`UPDATE daily_logs SET
                                    note=?, satisfaction=?, task_total=?, action_total=?, total_score=?,
                                    task_ratio=?, action_ratio=?, balance_factor=?, fulfillment=?,
                                    tomorrow_note=?, yesterday_achievement=?, updated_at=?
                                    WHERE user_id=? AND day=?`,
                                    [remote.note, remote.satisfaction, remote.task_total, remote.action_total, remote.total_score, remote.task_ratio, remote.action_ratio, remote.balance_factor, remote.fulfillment, remote.tomorrow_note ?? null, remote.yesterday_achievement ?? null, remote.updated_at, remote.user_id, remote.day]);
                            } else {
                                await db.run(`INSERT INTO daily_logs (id, user_id, day, note, satisfaction, task_total, action_total, total_score, task_ratio, action_ratio, balance_factor, fulfillment, tomorrow_note, yesterday_achievement, updated_at)
                                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                                    [remote.id, remote.user_id, remote.day, remote.note, remote.satisfaction, remote.task_total, remote.action_total, remote.total_score, remote.task_ratio, remote.action_ratio, remote.balance_factor, remote.fulfillment, remote.tomorrow_note ?? null, remote.yesterday_achievement ?? null, remote.updated_at]);
                            }
                        } else if (table === "notification_settings") {
                            const existing = await db.query(`SELECT id FROM notification_settings WHERE user_id = ?`, [remote.user_id]);
                            if (existing.values && existing.values.length > 0) {
                                await db.run(`UPDATE notification_settings SET
                                    habit_remind_on=?, habit_remind_hour=?, habit_remind_minute=?,
                                    task_remind_on=?, task_remind_hour=?, task_remind_minute=?,
                                    task_remind_timing=?,
                                    review_remind_on=?, review_remind_hour=?, review_remind_minute=?,
                                    volume_unit=?, sort_rule=?, prioritize_due=?,
                                    updated_at=?
                                    WHERE user_id=?`,
                                    [remote.habit_remind_on ? 1 : 0, remote.habit_remind_hour, remote.habit_remind_minute ?? 0,
                                     remote.task_remind_on ? 1 : 0, remote.task_remind_hour, remote.task_remind_minute ?? 0,
                                     remote.task_remind_timing,
                                     remote.review_remind_on ? 1 : 0, remote.review_remind_hour, remote.review_remind_minute ?? 0,
                                     remote.volume_unit ?? '30', remote.sort_rule ?? 'priority', remote.prioritize_due ? 1 : 0,
                                     remote.updated_at, remote.user_id]);
                            } else {
                                await db.run(`INSERT INTO notification_settings
                                    (id, user_id, habit_remind_on, habit_remind_hour, habit_remind_minute,
                                     task_remind_on, task_remind_hour, task_remind_minute, task_remind_timing,
                                     review_remind_on, review_remind_hour, review_remind_minute, volume_unit, sort_rule, prioritize_due, updated_at)
                                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                                    [remote.id, remote.user_id,
                                     remote.habit_remind_on ? 1 : 0, remote.habit_remind_hour, remote.habit_remind_minute ?? 0,
                                     remote.task_remind_on ? 1 : 0, remote.task_remind_hour, remote.task_remind_minute ?? 0,
                                     remote.task_remind_timing,
                                     remote.review_remind_on ? 1 : 0, remote.review_remind_hour, remote.review_remind_minute ?? 0,
                                     remote.volume_unit ?? '30', remote.sort_rule ?? 'priority', remote.prioritize_due ? 1 : 0,
                                     remote.updated_at]);
                            }
                        }
                    }
                }
                } catch (tableErr: any) {
                    // カラム未追加などのスキーマ不一致エラーはそのテーブルをスキップしてログに残す
                    console.warn(`[sync] Skipping table "${table}" due to error: ${tableErr?.message ?? tableErr}`);
                }
            }

            await this.save();
            // 同期成功時刻を記録（次回のINITIAL_SESSIONクールダウン判定に使用）
            try {
                const { Preferences } = await import('@capacitor/preferences');
                await Preferences.set({ key: `last_sync_at_${userId}`, value: new Date().toISOString() });
            } catch (_) { /* Preferences 失敗は無視 */ }
            return { success: true, message: "同期が完了しました" };
        } catch (err: any) {
            console.error("Sync error:", err);
            return { success: false, message: `同期エラー: ${err.message}` };
        } finally {
            this._syncInProgress = false;
        }
    }
}
