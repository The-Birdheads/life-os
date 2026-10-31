import type {
    Task, Action, TaskEntry, ActionEntry, DailyLog, NotificationSettings,
    MandalaChart, MandalaCell, MandalaCellEvent, MandalaReview, TaskEntryBounds,
} from "../types";
import type { Repository } from "./repository";
import { Capacitor } from "@capacitor/core";
import { initSqlite, DB_NAME, sqlite } from "./initSqlite";
import { MANDALA_COLUMNS, MANDALA_TABLES, parseJsonColumn, stringifyJsonColumn, toLocalValue, toRemoteRow } from "./rowCodec";

export class SqliteRepository implements Repository {
    private async getDb() {
        try {
            return await initSqlite();
        } catch (e: any) {
            console.error("[SqliteRepository] Failed to get database:", e);
            throw new Error(`SQLite DB not initialized: ${e.message || e}`);
        }
    }

    /**
     * Web 版 SQLite(jeep-sqlite)は、saveToStore を呼ばない限りメモリ上にしか保持されない。
     * iOS も jeep-sqlite を使っている(initSqlite.ts の isWebOrIos)ため、web と同様に保存する。
     * (以前は web のみだったため、iOS では起動時のスナップショット以降の端末内の変更が、
     *  アプリを終了すると失われていた。ログイン中はクラウドから復元されるが、
     *  未ログイン・オフライン中の記録は失われる。)
     * 保存に失敗しても、記録の操作自体は失敗させない。
     */
    private async save() {
        const platform = Capacitor.getPlatform();
        if (platform !== "web" && platform !== "ios") return;
        try {
            await sqlite.saveToStore(DB_NAME);
        } catch (e) {
            console.warn("[SqliteRepository] saveToStore failed:", e);
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
            frequency_kind: r.frequency_kind ?? "daily",
            frequency_history: parseJsonColumn(r.frequency_history, []),
        }));
    }

    async createTask(task: Task): Promise<void> {
        const db = await this.getDb();
        if (!task.id) task.id = crypto.randomUUID();
        const now = new Date().toISOString();
        await db.run(
            `INSERT INTO tasks (id, user_id, title, task_type, due_date, is_active, is_hidden, priority, volume, memo, remind_on, remind_hour, remind_minute,
              frequency_kind, frequency_count, frequency_days, frequency_history, mandala_cell_id, mandala_linked_at, ended_at, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
                task.frequency_kind ?? "daily",
                task.frequency_count ?? null,
                task.frequency_days ?? null,
                stringifyJsonColumn(task.frequency_history, []),
                task.mandala_cell_id ?? null,
                task.mandala_linked_at ?? null,
                task.ended_at ?? null,
                task.sort_order ?? null,
                now,
                now
            ]
        );
        await this.save();
        await this._tryPush('tasks', {
            id: task.id, user_id: task.user_id, title: task.title, task_type: task.task_type,
            due_date: task.due_date ?? null, is_active: task.is_active ? 1 : 0, is_hidden: task.is_hidden ? 1 : 0,
            priority: task.priority, volume: task.volume, memo: task.memo ?? null,
            remind_on: task.remind_on ? 1 : 0, remind_hour: task.remind_hour ?? 8, remind_minute: task.remind_minute ?? 0,
            frequency_kind: task.frequency_kind ?? "daily", frequency_count: task.frequency_count ?? null,
            frequency_days: task.frequency_days ?? null, frequency_history: task.frequency_history ?? [],
            mandala_cell_id: task.mandala_cell_id ?? null, mandala_linked_at: task.mandala_linked_at ?? null,
            ended_at: task.ended_at ?? null, sort_order: task.sort_order ?? null,
            created_at: now, deleted_at: null, updated_at: now,
        });
    }

    async updateTask(userId: string, taskId: string, patch: Partial<Task>): Promise<void> {
        const db = await this.getDb();
        const sets: string[] = [];
        const values: any[] = [];
        const now = new Date().toISOString();

        for (const [key, val] of Object.entries(patch)) {
            sets.push(`${key} = ?`);
            values.push(
                typeof val === "boolean" ? (val ? 1 : 0)
                    : key === "frequency_history" ? stringifyJsonColumn(val, [])
                    : val
            );
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
        if (rec) await this._tryPush('tasks', toRemoteRow('tasks', rec));
    }

    /** 自分で並べた順を保存する(ids の順に 1, 2, 3…)。順が変わったものだけ書き換えて送る */
    async setTaskOrder(userId: string, ids: string[]): Promise<void> {
        const db = await this.getDb();
        const now = new Date().toISOString();
        const changed: string[] = [];
        for (let i = 0; i < ids.length; i++) {
            const res = await db.run(
                `UPDATE tasks SET sort_order = ?, updated_at = ? WHERE user_id = ? AND id = ? AND (sort_order IS NULL OR sort_order != ?)`,
                [i + 1, now, userId, ids[i], i + 1]
            );
            if ((res.changes?.changes ?? 0) > 0) changed.push(ids[i]);
        }
        if (changed.length === 0) return;
        await this.save();
        for (const id of changed) {
            const rec = (await db.query('SELECT * FROM tasks WHERE id = ? AND user_id = ?', [id, userId])).values?.[0];
            if (rec) await this._tryPush('tasks', toRemoteRow('tasks', rec));
        }
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

    /** 対応中の記録(status = 'doing')。対応中にした日ごと */
    async getDoingTaskEntries(userId: string): Promise<{ task_id: string; day: string }[]> {
        const db = await this.getDb();
        const res = await db.query(
            `SELECT task_id, day FROM task_entries WHERE user_id = ? AND status = 'doing'`,
            [userId]
        );
        return (res.values ?? []) as { task_id: string; day: string }[];
    }

    /** タスクの記録のうち、指定した状態(完了・対応中)のものを、すべて未完了に戻す */
    async resetTaskEntries(userId: string, taskId: string, statuses: ("done" | "doing")[]): Promise<void> {
        if (statuses.length === 0) return;
        const db = await this.getDb();
        const res = await db.query(
            `SELECT id, day FROM task_entries WHERE user_id = ? AND task_id = ? AND status IN (${statuses.map(() => "?").join(", ")})`,
            [userId, taskId, ...statuses]
        );
        for (const r of (res.values ?? []) as { id: string; day: string }[]) {
            await this.upsertTaskEntry({ id: r.id, user_id: userId, day: r.day, task_id: taskId, status: "todo" } as TaskEntry);
        }
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
            sort_rule: raw.sort_rule ?? 'manual',
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
                    settings.volume_unit ?? '30', settings.sort_rule ?? 'manual', settings.prioritize_due ? 1 : 0,
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
                    settings.volume_unit ?? '30', settings.sort_rule ?? 'manual', settings.prioritize_due ? 1 : 0,
                    now
                ]
            );
        }
        await this.save();
        const savedNs = (await db.query('SELECT * FROM notification_settings WHERE user_id = ?', [settings.user_id])).values?.[0];
        if (savedNs) await this._tryPush('notification_settings', savedNs, 'user_id');
    }

    // --- Mandala Chart ---
    /**
     * マンダラチャート関連の行を保存する(id で上書き)。JSON の列は TEXT にして持つ。
     * created_at は最初に作ったときだけ入れ、updated_at は保存のたびに更新する。
     */
    private async upsertMandalaRow(table: (typeof MANDALA_TABLES)[number], row: Record<string, any>): Promise<void> {
        const db = await this.getDb();
        const now = new Date().toISOString();
        const record: Record<string, any> = { ...row, created_at: row.created_at ?? now, updated_at: now };
        record.deleted_at ??= null;
        const cols = MANDALA_COLUMNS[table];
        await db.run(
            `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})
             ON CONFLICT(id) DO UPDATE SET ${cols.filter((c) => c !== "id" && c !== "created_at").map((c) => `${c}=excluded.${c}`).join(", ")}`,
            cols.map((c) => toLocalValue(table, c, record[c]))
        );
        await this.save();
        const saved = (await db.query(`SELECT * FROM ${table} WHERE id = ?`, [record.id])).values?.[0];
        if (saved) await this._tryPush(table, toRemoteRow(table, saved));
    }

    /** 使用中のチャート(1枚)。複数ある場合(別の端末で同時に作ったとき)は、最後に更新したもの */
    async getActiveChart(userId: string): Promise<MandalaChart | null> {
        const db = await this.getDb();
        const res = await db.query(
            `SELECT * FROM mandala_charts WHERE user_id = ? AND status = 'active' AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 1`,
            [userId]
        );
        return (res.values?.[0] as MandalaChart | undefined) ?? null;
    }

    async getFinishedCharts(userId: string): Promise<MandalaChart[]> {
        const db = await this.getDb();
        const res = await db.query(
            `SELECT * FROM mandala_charts WHERE user_id = ? AND status = 'finished' AND deleted_at IS NULL ORDER BY updated_at DESC`,
            [userId]
        );
        return (res.values ?? []) as MandalaChart[];
    }

    async upsertChart(chart: MandalaChart): Promise<void> {
        if (!chart.id) chart.id = crypto.randomUUID();
        await this.upsertMandalaRow("mandala_charts", chart);
    }

    async getCells(userId: string, chartId: string): Promise<MandalaCell[]> {
        const db = await this.getDb();
        const res = await db.query(
            `SELECT * FROM mandala_cells WHERE user_id = ? AND chart_id = ? AND deleted_at IS NULL`,
            [userId, chartId]
        );
        return (res.values ?? []).map((r: any) => ({ ...r, paused_periods: parseJsonColumn(r.paused_periods, []) }));
    }

    async upsertCell(cell: MandalaCell): Promise<void> {
        if (!cell.id) cell.id = crypto.randomUUID();
        await this.upsertMandalaRow("mandala_cells", cell);
    }

    async addCellEvent(event: Omit<MandalaCellEvent, "id" | "created_at"> & { id?: string }): Promise<void> {
        await this.upsertMandalaRow("mandala_cell_events", { ...event, id: event.id ?? crypto.randomUUID() });
    }

    async getCellEvents(userId: string, cellId: string): Promise<MandalaCellEvent[]> {
        const db = await this.getDb();
        const res = await db.query(
            `SELECT * FROM mandala_cell_events WHERE user_id = ? AND cell_id = ? AND deleted_at IS NULL ORDER BY created_at ASC`,
            [userId, cellId]
        );
        return (res.values ?? []) as MandalaCellEvent[];
    }

    async getCellEventsByKind(userId: string, kind: MandalaCellEvent["kind"]): Promise<MandalaCellEvent[]> {
        const db = await this.getDb();
        const res = await db.query(
            `SELECT * FROM mandala_cell_events WHERE user_id = ? AND kind = ? AND deleted_at IS NULL ORDER BY created_at ASC`,
            [userId, kind]
        );
        return (res.values ?? []) as MandalaCellEvent[];
    }

    async getReviews(userId: string, chartId: string): Promise<MandalaReview[]> {
        const db = await this.getDb();
        const res = await db.query(
            `SELECT * FROM mandala_reviews WHERE user_id = ? AND chart_id = ? AND deleted_at IS NULL ORDER BY reviewed_at ASC`,
            [userId, chartId]
        );
        return (res.values ?? []).map((r: any) => ({
            ...r,
            decisions: parseJsonColumn(r.decisions, []),
            snapshot: parseJsonColumn(r.snapshot, {}),
        }));
    }

    /** 見直しの記録は、保存後は変更しない */
    async createReview(review: Omit<MandalaReview, "id"> & { id?: string }): Promise<void> {
        await this.upsertMandalaRow("mandala_reviews", { ...review, id: review.id ?? crypto.randomUUID() });
    }

    /** 期間内(from〜to、両端を含む)の実施記録。進み具合の計算に使う */
    async getTaskEntriesBetween(userId: string, from: string, to: string): Promise<TaskEntry[]> {
        const db = await this.getDb();
        const res = await db.query(
            `SELECT * FROM task_entries WHERE user_id = ? AND day >= ? AND day <= ?`,
            [userId, from, to]
        );
        return (res.values ?? []) as TaskEntry[];
    }

    /** 習慣・タスクごと、状態(完了・対応中・×)ごとの、いちばん早い日と遅い日。推移タブで使う */
    async getTaskEntryBounds(userId: string): Promise<TaskEntryBounds[]> {
        const db = await this.getDb();
        const res = await db.query(
            `SELECT task_id, status, MIN(day) AS first, MAX(day) AS last FROM task_entries
             WHERE user_id = ? AND status IN ('done', 'doing', 'missed') GROUP BY task_id, status`,
            [userId]
        );
        return (res.values ?? []) as TaskEntryBounds[];
    }

    // --- Account Deletion ---
    async deleteAllUserData(userId: string): Promise<void> {
        const db = await this.getDb();
        // FK依存順に削除（子テーブル → 親テーブル）
        const tables = [
            'task_entries', 'action_entries', 'daily_logs', 'notification_settings', 'tasks', 'actions',
            'mandala_reviews', 'mandala_cell_events', 'mandala_cells', 'mandala_charts',
        ];
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
            const tables = ['tasks', 'actions', 'task_entries', 'action_entries', 'daily_logs', ...MANDALA_TABLES];
            for (const table of tables) {
                await db.run(`UPDATE ${table} SET user_id = ? WHERE user_id = ?`, [newUserId, oldUserId]);
            }

            // notification_settings(ユーザー設定・通知設定)も付け替える。user_id が UNIQUE のため、
            // 付け替え先に既にあるときは付け替え先を優先し、古い方は削除する
            const existingSettings = await db.query(`SELECT id FROM notification_settings WHERE user_id = ?`, [newUserId]);
            if (existingSettings.values && existingSettings.values.length > 0) {
                await db.run(`DELETE FROM notification_settings WHERE user_id = ?`, [oldUserId]);
            } else {
                await db.run(`UPDATE notification_settings SET user_id = ? WHERE user_id = ?`, [newUserId, oldUserId]);
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

                // 履歴データをマスターへ統合(マスへのひもづけは、マスターに無ければ引き継ぐ)
                for (const oldId of otherIds) {
                    await db.run(`UPDATE task_entries SET task_id = ? WHERE task_id = ?`, [masterId, oldId]);
                    await db.run(
                        `UPDATE tasks SET
                           mandala_cell_id = COALESCE(mandala_cell_id, (SELECT mandala_cell_id FROM tasks WHERE id = ?)),
                           mandala_linked_at = COALESCE(mandala_linked_at, (SELECT mandala_linked_at FROM tasks WHERE id = ?))
                         WHERE id = ?`,
                        [oldId, oldId, masterId]
                    );
                    await db.run(`UPDATE mandala_cell_events SET task_id = ? WHERE task_id = ?`, [masterId, oldId]);
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
            // サーバーの外部キーの順(チャート → マス → 習慣・タスク → … → マスの変更の履歴・見直しの記録)
            const tables = [
                "mandala_charts", "mandala_cells",
                "tasks", "actions", "task_entries", "action_entries", "daily_logs", "notification_settings",
                "mandala_cell_events", "mandala_reviews",
            ];
            const isMandalaTable = (t: string) => (MANDALA_TABLES as readonly string[]).includes(t);

            for (const table of tables) {
                try {
                const localData = (await db.query(`SELECT * FROM ${table} WHERE user_id = ?`, [userId])).values || [];
                const { data: remoteData, error: selectError } = await supabase.from(table).select("*").eq("user_id", userId);
                console.log(`[sync] ${table} — local: ${localData.length}, remote: ${remoteData?.length ?? "ERR"}, error: ${selectError?.message ?? "none"}`);
                if (selectError) throw selectError;

                // notification_settings は user_id が自然キーのため id ではなく user_id でマップを構築する
                const mapKey = (r: any) => table === 'notification_settings' ? r.user_id : r.id;
                const remoteMap = new Map(remoteData?.map(r => [mapKey(r), r]) || []);

                // 1行の失敗(例: 削除済みタスクを参照する実施記録の外部キー違反)で、
                // テーブル全体の同期が止まらないよう、行ごとに失敗を数えて続行する
                let pushFailed = 0;
                let pullFailed = 0;
                let firstRowError: string | undefined;
                const onRowError = (e: any) => { firstRowError ??= e?.message ?? String(e); };

                // A. Local to Remote (Push)
                for (const local of localData) {
                    try {
                    const remote = remoteMap.get(mapKey(local));
                    // updated_at が local の方が新しい場合か、リモートに存在しない場合にプッシュ
                    if (!remote || new Date(local.updated_at) > new Date(remote.updated_at)) {
                        // JSON の列(端末内は TEXT)を JSON に戻して送る
                        const payload = toRemoteRow(table, local);
                        // 作った日時がまだ埋まっていない端末の行で、サーバーの値を消さない
                        if (table === "tasks" && payload.created_at == null) delete payload.created_at;
                        if (table === "task_entries" || table === "daily_logs" || table === "action_entries" || table === "notification_settings" || isMandalaTable(table)) {
                            // 複合キー or user_id キーを持つテーブルは upsert（ON CONFLICT が必要）
                            const onConflict = table === "daily_logs" ? "user_id,day"
                                : table === "task_entries" ? "user_id,day,task_id"
                                : table === "notification_settings" ? "user_id"
                                : "id";
                            const { error: upsertError } = await supabase.from(table).upsert(payload, { onConflict });
                            if (upsertError) throw upsertError;
                        } else if (!remote) {
                            // 新規レコード: INSERT
                            const { error: insertError } = await supabase.from(table).insert(payload);
                            if (insertError) throw insertError;
                        } else {
                            // 既存レコード: UPDATE（memo=null などの null フィールドも確実に上書きされる）
                            const { error: updateError } = await supabase.from(table).update(payload).eq('id', local.id).eq('user_id', userId);
                            if (updateError) throw updateError;
                        }
                    }
                    } catch (rowErr) {
                        pushFailed++;
                        onRowError(rowErr);
                    }
                }

                // B. Remote to Local (Pull)
                const { data: latestRemote, error: pullError } = await supabase.from(table).select("*").eq("user_id", userId);
                if (pullError) throw pullError;
                for (const remote of latestRemote || []) {
                    try {
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

                    // 作った日時は、更新が無くても端末に無ければ埋める(created_at の列を足す前からある習慣・タスク)
                    if (table === "tasks" && local && remote.created_at) {
                        await db.run(`UPDATE tasks SET created_at = ? WHERE id = ? AND created_at IS NULL`, [remote.created_at, remote.id]);
                    }

                    if (!local || new Date(remote.updated_at) > new Date(local.updated_at)) {
                        // ソフトデリートのtombstone処理: リモートがdeleted_atを持つ場合はローカルを物理削除
                        if (remote.deleted_at && (table === "tasks" || table === "actions" || table === "action_entries")) {
                            await db.run(`DELETE FROM ${table} WHERE id = ?`, [remote.id]);
                            continue;
                        }

                        if (isMandalaTable(table)) {
                            // マンダラチャート関連は、削除済み(deleted_at)の行も残して同じ列で取り込む
                            const cols = MANDALA_COLUMNS[table as keyof typeof MANDALA_COLUMNS];
                            await db.run(
                                `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})
                                 ON CONFLICT(id) DO UPDATE SET ${cols.filter((c) => c !== "id").map((c) => `${c}=excluded.${c}`).join(", ")}`,
                                cols.map((c) => toLocalValue(table, c, remote[c]))
                            );
                        } else if (table === "tasks") {
                            await db.run(`INSERT INTO tasks (id, user_id, title, task_type, due_date, is_active, is_hidden, priority, volume, memo, remind_on, remind_hour, remind_minute,
                                frequency_kind, frequency_count, frequency_days, frequency_history, mandala_cell_id, mandala_linked_at, ended_at, sort_order, created_at, deleted_at, updated_at)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET
                                title=excluded.title, task_type=excluded.task_type, due_date=excluded.due_date,
                                is_active=excluded.is_active, is_hidden=excluded.is_hidden, priority=excluded.priority,
                                volume=excluded.volume, memo=excluded.memo,
                                remind_on=excluded.remind_on, remind_hour=excluded.remind_hour, remind_minute=excluded.remind_minute,
                                frequency_kind=excluded.frequency_kind, frequency_count=excluded.frequency_count,
                                frequency_days=excluded.frequency_days, frequency_history=excluded.frequency_history,
                                mandala_cell_id=excluded.mandala_cell_id, mandala_linked_at=excluded.mandala_linked_at,
                                ended_at=excluded.ended_at, sort_order=excluded.sort_order,
                                created_at=COALESCE(excluded.created_at, tasks.created_at),
                                deleted_at=excluded.deleted_at, updated_at=excluded.updated_at`,
                                [remote.id, remote.user_id, remote.title, remote.task_type, remote.due_date, remote.is_active, remote.is_hidden, remote.priority, remote.volume, remote.memo ?? null, remote.remind_on ?? 0, remote.remind_hour ?? 8, remote.remind_minute ?? 0,
                                 remote.frequency_kind ?? "daily", remote.frequency_count ?? null, remote.frequency_days ?? null,
                                 toLocalValue("tasks", "frequency_history", remote.frequency_history),
                                 remote.mandala_cell_id ?? null, remote.mandala_linked_at ?? null, remote.ended_at ?? null,
                                 remote.sort_order ?? null, remote.created_at ?? null, remote.deleted_at ?? null, remote.updated_at]);
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
                    } catch (rowErr) {
                        pullFailed++;
                        onRowError(rowErr);
                    }
                }
                if (pushFailed > 0 || pullFailed > 0) {
                    console.warn(`[sync] ${table} — skipped rows: push ${pushFailed}, pull ${pullFailed} (first error: ${firstRowError})`);
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
