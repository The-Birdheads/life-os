import '@testing-library/jest-dom';
import { vi } from 'vitest';

// モックの共通設定が必要な場合はここに記述
// 例: Capacitor プラグインのモックなど
vi.mock('@capacitor/core', () => ({
    Capacitor: {
        getPlatform: () => 'web',
        isNativePlatform: () => false,
    },
}));

vi.mock('@capacitor-community/sqlite', () => ({
    SQLiteConnection: vi.fn(),
    CapacitorSQLite: {},
}));
