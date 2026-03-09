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

    it('migrate should swap user_id and trigger deduplication', async () => {
        mockRun.mockResolvedValue({ changes: { changes: 1 } });
        mockQuery.mockResolvedValue({ values: [] }); // 重複なしの場合

        await repository.migrate('old-id', 'new-id');

        expect(mockRun).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE tasks SET user_id = ? WHERE user_id = ?'),
            ['new-id', 'old-id']
        );
    });
});
