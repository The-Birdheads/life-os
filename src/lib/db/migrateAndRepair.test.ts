/**
 * ログインし直したときの統合(migrate)と、同期での取り直しを、本物の SQLite(sql.js)で確かめる。
 * 以前の統合は、アカウント側の同じ名前のタスクまで1つにまとめ、完了の記録をほかのタスクへ付け替えていた。
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import initSqlJs, { type Database } from "sql.js";

const holder = vi.hoisted(() => ({ db: null as any }));

vi.mock("../db/initSqlite", () => ({
    initSqlite: vi.fn(async () => holder.db),
    sqlite: { saveToStore: vi.fn() },
    DB_NAME: "test-db",
}));
vi.mock("@capacitor/core", () => ({
    Capacitor: { getPlatform: vi.fn(() => "web"), isNativePlatform: vi.fn(() => false) },
}));

import { SqliteRepository } from "./sqliteRepository";

const SCHEMA = `
CREATE TABLE tasks (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL, task_type TEXT NOT NULL, due_date TEXT,
  is_active INTEGER DEFAULT 1, is_hidden INTEGER DEFAULT 0, priority INTEGER DEFAULT 3, volume INTEGER DEFAULT 5, memo TEXT,
  remind_on INTEGER DEFAULT 0, remind_hour INTEGER DEFAULT 8, remind_minute INTEGER DEFAULT 0, updated_at TEXT, deleted_at TEXT,
  frequency_kind TEXT NOT NULL DEFAULT 'daily', frequency_count INTEGER, frequency_days INTEGER, frequency_history TEXT NOT NULL DEFAULT '[]',
  mandala_cell_id TEXT, mandala_linked_at TEXT, ended_at TEXT, sort_order REAL, created_at TEXT);
CREATE TABLE actions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, category TEXT NOT NULL, kind TEXT NOT NULL, is_active INTEGER DEFAULT 1,
  is_hidden INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT, deleted_at TEXT);
CREATE TABLE task_entries (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, day TEXT NOT NULL, task_id TEXT NOT NULL, status TEXT NOT NULL,
  updated_at TEXT, UNIQUE(user_id, day, task_id));
CREATE TABLE action_entries (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, day TEXT NOT NULL, action_id TEXT NOT NULL, note TEXT, volume INTEGER,
  created_at TEXT, updated_at TEXT, deleted_at TEXT);
CREATE TABLE daily_logs (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, day TEXT NOT NULL, updated_at TEXT);
CREATE TABLE notification_settings (id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE, updated_at TEXT);
CREATE TABLE mandala_charts (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, updated_at TEXT);
CREATE TABLE mandala_cells (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, updated_at TEXT);
CREATE TABLE mandala_cell_events (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, cell_id TEXT NOT NULL, kind TEXT NOT NULL, note TEXT NOT NULL DEFAULT '',
  task_id TEXT, deleted_at TEXT, created_at TEXT, updated_at TEXT);
CREATE TABLE mandala_reviews (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, updated_at TEXT);
`;

const T0 = "2026-10-30T00:37:00.000Z";
let SQL: Awaited<ReturnType<typeof initSqlJs>>;
let raw: Database;

beforeAll(async () => {
    SQL = await initSqlJs();
});

beforeEach(() => {
    raw = new SQL.Database();
    raw.exec(SCHEMA);
    holder.db = {
        query: async (sql: string, params: unknown[] = []) => {
            const stmt = raw.prepare(sql);
            stmt.bind(params as any);
            const values: Record<string, unknown>[] = [];
            while (stmt.step()) values.push(stmt.getAsObject());
            stmt.free();
            return { values };
        },
        run: async (sql: string, params: unknown[] = []) => {
            raw.run(sql, params as any);
            return { changes: { changes: raw.getRowsModified() } };
        },
    };
});

afterEach(() => {
    vi.doUnmock("../supabase");
    raw.close();
});

const task = (id: string, user: string, title: string, type = "oneoff") =>
    raw.run(`INSERT INTO tasks (id, user_id, title, task_type, priority, volume, updated_at) VALUES (?, ?, ?, ?, 3, 2, ?)`, [id, user, title, type, T0]);
const entry = (id: string, user: string, day: string, taskId: string, status = "done") =>
    raw.run(`INSERT INTO task_entries (id, user_id, day, task_id, status, updated_at) VALUES (?, ?, ?, ?, ?, ?)`, [id, user, day, taskId, status, T0]);
const rows = (sql: string) => {
    const r = raw.exec(sql)[0];
    return r ? r.values : [];
};

describe("ログインし直したときの統合", () => {
    it("アカウント側の同じ名前のタスクは、まとめずにそのまま残す", async () => {
        task("buy-1", "cloud", "買い物");
        task("buy-2", "cloud", "買い物");
        entry("e1", "cloud", "2026-08-26", "buy-1");
        entry("e2", "cloud", "2026-09-27", "buy-2");

        await new SqliteRepository().migrate("local", "cloud");

        expect(rows(`SELECT id FROM tasks ORDER BY id`)).toEqual([["buy-1"], ["buy-2"]]);
        expect(rows(`SELECT id, task_id FROM task_entries ORDER BY id`)).toEqual([["e1", "buy-1"], ["e2", "buy-2"]]);
    });

    it("ログイン前に作った習慣は、アカウント側の同じ習慣にまとめ、同じ日の記録はアカウント側を残す。タスクはまとめない", async () => {
        task("habit-cloud", "cloud", "読書", "habit");
        entry("c1", "cloud", "2026-11-01", "habit-cloud");
        task("habit-local", "local", "読書", "habit");
        entry("l1", "local", "2026-11-01", "habit-local");
        entry("l2", "local", "2026-11-02", "habit-local");
        task("buy-cloud", "cloud", "買い物");
        task("buy-local", "local", "買い物");
        entry("l3", "local", "2026-11-02", "buy-local");

        await new SqliteRepository().migrate("local", "cloud");

        expect(rows(`SELECT id FROM tasks ORDER BY id`)).toEqual([["buy-cloud"], ["buy-local"], ["habit-cloud"]]);
        expect(rows(`SELECT id, user_id, day, task_id FROM task_entries ORDER BY id`)).toEqual([
            ["c1", "cloud", "2026-11-01", "habit-cloud"],
            ["l2", "cloud", "2026-11-02", "habit-cloud"],
            ["l3", "cloud", "2026-11-02", "buy-local"],
        ]);
        // まとめた記録はサーバーへ送られるよう、更新時刻を新しくする
        expect(rows(`SELECT updated_at > '${T0}' FROM task_entries WHERE id = 'l2'`)).toEqual([[1]]);
    });
});

describe("同期での取り直し", () => {
    const mockSupabase = (remote: Record<string, Record<string, unknown>[]>) => {
        const upserts: { table: string; row: any }[] = [];
        const from = vi.fn((table: string) => ({
            select: () => ({ eq: async () => ({ data: remote[table] ?? [], error: null }) }),
            upsert: async (row: any) => { upserts.push({ table, row }); return { error: null }; },
            insert: async (row: any) => { upserts.push({ table, row }); return { error: null }; },
            update: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
        }));
        vi.doMock("../supabase", () => ({
            supabase: { auth: { getSession: async () => ({ data: { session: { user: { id: "cloud" } } } }) }, from },
        }));
        return upserts;
    };
    const remoteTask = (id: string) => ({ id, user_id: "cloud", title: "買い物", task_type: "oneoff", priority: 3, volume: 2, updated_at: T0, frequency_history: [] });

    it("更新時刻が同じなのに付け替わっている記録は、サーバーのタスクに戻す(サーバーへは送らない)", async () => {
        // 以前の統合で、buy-1 の 8/26 の完了が buy-2 へ付け替わっていた
        task("buy-1", "cloud", "買い物");
        task("buy-2", "cloud", "買い物");
        entry("e1", "cloud", "2026-08-26", "buy-2");
        entry("e2", "cloud", "2026-09-27", "buy-2");
        const upserts = mockSupabase({
            tasks: [remoteTask("buy-1"), remoteTask("buy-2")],
            task_entries: [
                { id: "e1", user_id: "cloud", day: "2026-08-26", task_id: "buy-1", status: "done", updated_at: T0 },
                { id: "e2", user_id: "cloud", day: "2026-09-27", task_id: "buy-2", status: "done", updated_at: T0 },
            ],
        });

        const res = await new SqliteRepository().sync("cloud");

        expect(res.success).toBe(true);
        expect(rows(`SELECT id, task_id FROM task_entries ORDER BY id`)).toEqual([["e1", "buy-1"], ["e2", "buy-2"]]);
        expect(upserts.filter((u) => u.table === "task_entries")).toEqual([]);
    });

    it("同じ日・同じタスクの記録が別の id で端末にあるときは、新しいほうを残す", async () => {
        task("buy-1", "cloud", "買い物");
        // 端末: 古い記録(別の id)
        entry("local-old", "cloud", "2026-11-01", "buy-1", "doing");
        mockSupabase({
            tasks: [remoteTask("buy-1")],
            task_entries: [{ id: "remote-new", user_id: "cloud", day: "2026-11-01", task_id: "buy-1", status: "done", updated_at: "2026-11-02T00:00:00.000Z" }],
        });

        await new SqliteRepository().sync("cloud");

        expect(rows(`SELECT id, status FROM task_entries`)).toEqual([["remote-new", "done"]]);
    });

    it("記録を付け直しても、端末の記録の id は変えない(サーバーへも同じ id で送る)", async () => {
        task("buy-1", "cloud", "買い物");
        entry("e1", "cloud", "2026-11-01", "buy-1", "doing");
        const upserts = mockSupabase({});

        await new SqliteRepository().upsertTaskEntry({ id: "", user_id: "cloud", day: "2026-11-01", task_id: "buy-1", status: "done" });

        expect(rows(`SELECT id, status FROM task_entries`)).toEqual([["e1", "done"]]);
        expect(upserts.map((u) => u.row.id)).toEqual(["e1"]);
    });
});
