import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SqliteRepository } from './sqliteRepository';

const { mockDb, mockSqliteConnection, mockQuery, mockRun, mockSaveToStore } = vi.hoisted(() => {
    const query = vi.fn();
    const run = vi.fn();
    const saveToStore = vi.fn();
    return {
        mockQuery: query,
        mockRun: run,
        mockSaveToStore: saveToStore,
        mockDb: { query, run },
        mockSqliteConnection: { saveToStore },
    };
});

vi.mock('../db/initSqlite', () => ({
    initSqlite: vi.fn(async () => mockDb),
    sqlite: mockSqliteConnection,
    DB_NAME: 'test-db',
}));

// Web版の saveToStore などのモック
vi.mock('@capacitor-community/sqlite', () => ({
    SQLiteConnection: vi.fn(() => ({
        saveToStore: mockSaveToStore,
    })),
}));

vi.mock('@capacitor/core', () => ({
    Capacitor: {
        getPlatform: vi.fn(() => 'web'),
        isNativePlatform: vi.fn(() => false),
    },
}));

describe('SqliteRepository', () => {
    let repository: SqliteRepository;

    beforeEach(() => {
        vi.clearAllMocks();
        repository = new SqliteRepository();
    });

    it('createTask should call run with correct SQL', async () => {
        mockRun.mockResolvedValue({ changes: { changes: 1 } });

        const task = {
            id: 'test-id',
            user_id: 'user-1',
            title: 'Test Task',
            task_type: 'daily' as any,
            due_date: '2024-03-06',
            is_active: true,
            is_hidden: false,
            priority: 1,
            volume: 1,
        };

        await repository.createTask(task);

        expect(mockRun).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO tasks'),
            expect.arrayContaining(['test-id', 'user-1', 'Test Task'])
        );
    });

    it('persists the in-memory database to the store after a write on iOS (jeep-sqlite) as well as on web', async () => {
        const { Capacitor } = await import('@capacitor/core');
        mockRun.mockResolvedValue({ changes: { changes: 1 } });
        const task = {
            id: 't1', user_id: 'user-1', title: 'T', task_type: 'habit' as any, due_date: null,
            is_active: true, is_hidden: false, priority: 1, volume: 1,
        };

        (Capacitor.getPlatform as any).mockReturnValue('ios');
        mockSaveToStore.mockClear();
        await repository.createTask(task);
        expect(mockSaveToStore).toHaveBeenCalledWith('test-db');

        (Capacitor.getPlatform as any).mockReturnValue('android');
        mockSaveToStore.mockClear();
        await repository.createTask({ ...task, id: 't2' });
        expect(mockSaveToStore).not.toHaveBeenCalled();

        (Capacitor.getPlatform as any).mockReturnValue('web');
    });

    it('does not fail a write when saving to the store fails', async () => {
        mockRun.mockResolvedValue({ changes: { changes: 1 } });
        mockSaveToStore.mockRejectedValueOnce(new Error('idb error'));
        vi.spyOn(console, 'warn').mockImplementation(() => {});

        await expect(repository.createTask({
            id: 't3', user_id: 'user-1', title: 'T', task_type: 'habit' as any, due_date: null,
            is_active: true, is_hidden: false, priority: 1, volume: 1,
        })).resolves.toBeUndefined();
    });

    it('migrate should also move notification_settings to the new user (or drop the old one if the new user already has settings)', async () => {
        mockRun.mockResolvedValue({ changes: { changes: 1 } });
        mockQuery.mockResolvedValue({ values: [] });

        await repository.migrate('old-id', 'new-id');
        expect(mockRun).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE notification_settings SET user_id = ? WHERE user_id = ?'),
            ['new-id', 'old-id']
        );

        mockRun.mockClear();
        mockQuery.mockImplementation(async (sql: string) =>
            sql.includes('FROM notification_settings') ? { values: [{ id: 'settings_new' }] } : { values: [] }
        );

        await repository.migrate('old-id', 'new-id');
        expect(mockRun).toHaveBeenCalledWith(
            expect.stringContaining('DELETE FROM notification_settings WHERE user_id = ?'),
            ['old-id']
        );
        expect(mockRun).not.toHaveBeenCalledWith(
            expect.stringContaining('UPDATE notification_settings SET user_id'),
            expect.anything()
        );
    });

    it('migrate should swap user_id and trigger deduplication', async () => {
        mockRun.mockResolvedValue({ changes: { changes: 1 } });
        mockQuery.mockResolvedValue({ values: [] }); // 重複なしの場合

        await repository.migrate('old-id', 'new-id');

        expect(mockRun).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE tasks SET user_id = ? WHERE user_id = ?'),
            ['new-id', 'old-id']
        );
    });

    it('sync keeps pulling the remaining rows when one row fails (e.g. an entry of a deleted task)', async () => {
        const entries = ['e1', 'e2-of-deleted-task', 'e3'].map((id, i) => ({
            id, user_id: 'user-1', day: `2026-10-0${i + 1}`, task_id: `task-${id}`, status: 'done', updated_at: '2026-10-24T00:00:00Z',
        }));
        const from = vi.fn((table: string) => ({
            select: () => ({ eq: async () => ({ data: table === 'task_entries' ? entries : [], error: null }) }),
        }));
        vi.doMock('../supabase', () => ({
            supabase: { auth: { getSession: async () => ({ data: { session: { user: { id: 'user-1' } } } }) }, from },
        }));
        mockQuery.mockResolvedValue({ values: [] }); // 端末内は空(新しい端末・初回ログイン)
        mockRun.mockImplementation(async (sql: string, params: unknown[]) => {
            if (sql.includes('INSERT INTO task_entries') && params[0] === 'e2-of-deleted-task') {
                throw new Error('FOREIGN KEY constraint failed');
            }
            return { changes: { changes: 1 } };
        });
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const result = await repository.sync('user-1');

        expect(result.success).toBe(true);
        const insertedIds = mockRun.mock.calls
            .filter(([sql]) => String(sql).includes('INSERT INTO task_entries'))
            .map(([, params]) => (params as unknown[])[0]);
        expect(insertedIds).toEqual(['e1', 'e2-of-deleted-task', 'e3']);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('task_entries — skipped rows: push 0, pull 1'));
        warn.mockRestore();
        vi.doUnmock('../supabase');
    });
});
