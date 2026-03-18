import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';

export const sqlite = new SQLiteConnection(CapacitorSQLite);

export const DB_NAME = "lifeos_db";

let initPromise: Promise<SQLiteDBConnection> | null = null;

export function initSqlite(): Promise<SQLiteDBConnection> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      console.log("[initSqlite] Starting initialization...");

      // Web環境(jeep-sqlite)向けのセットアップ
      if (Capacitor.getPlatform() === 'web') {
        let jeepEl = document.querySelector('jeep-sqlite');
        if (jeepEl == null) {
          jeepEl = document.createElement('jeep-sqlite');
          document.body.appendChild(jeepEl);
        }
        await customElements.whenDefined('jeep-sqlite');
        await sqlite.initWebStore();
      }

      console.log("[initSqlite] Checking connections...");
      const isConnection = await sqlite.checkConnectionsConsistency();
      const isConnected = (await sqlite.isConnection(DB_NAME, false)).result;

      let db: SQLiteDBConnection;
      if (isConnection.result && isConnected) {
        console.log("[initSqlite] Retrieving existing connection...");
        db = await sqlite.retrieveConnection(DB_NAME, false);
      } else {
        console.log("[initSqlite] Creating new connection...");
        db = await sqlite.createConnection(DB_NAME, false, "no-encryption", 1, false);
      }

      console.log("[initSqlite] Opening database...");
      await db.open();

      console.log("[initSqlite] Verifying/Creating tables...");
      await createTables(db);

      console.log("[initSqlite] SQLite initialized successfully.");
      return db;
    } catch (err: any) {
      console.error("[initSqlite] CRITICAL ERROR during initialization:", err);
      initPromise = null; // リセットして次回呼び出し時にリトライ可能にする
      throw err;
    }
  })();

  return initPromise;
}

async function createTables(db: SQLiteDBConnection) {
  const schema = `
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        task_type TEXT NOT NULL,
        due_date TEXT,
        is_active INTEGER DEFAULT 1,
        is_hidden INTEGER DEFAULT 0,
        priority INTEGER DEFAULT 3,
        volume INTEGER DEFAULT 5,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS actions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        category TEXT NOT NULL,
        kind TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        is_hidden INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS task_entries (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        day TEXT NOT NULL,
        task_id TEXT NOT NULL,
        status TEXT NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, day, task_id),
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS action_entries (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        day TEXT NOT NULL,
        action_id TEXT NOT NULL,
        note TEXT,
        volume INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (action_id) REFERENCES actions(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS daily_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        day TEXT NOT NULL UNIQUE,
        note TEXT,
        satisfaction INTEGER,
        task_total INTEGER DEFAULT 0,
        action_total INTEGER DEFAULT 0,
        total_score INTEGER DEFAULT 0,
        task_ratio REAL DEFAULT 0,
        action_ratio REAL DEFAULT 0,
        balance_factor REAL DEFAULT 0,
        fulfillment REAL DEFAULT 0,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS notification_settings (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        habit_remind_on INTEGER DEFAULT 1,
        habit_remind_hour INTEGER DEFAULT 18,
        task_remind_on INTEGER DEFAULT 1,
        task_remind_hour INTEGER DEFAULT 10,
        task_remind_timing TEXT DEFAULT '[1,2,3]',
        review_remind_on INTEGER DEFAULT 1,
        review_remind_hour INTEGER DEFAULT 21,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `;

  try {
    const versionRes = await db.query("PRAGMA user_version;");
    const currentVersion = versionRes.values?.[0]?.user_version || 0;

    if (currentVersion < 2) {
      console.log("Migrating database to version 2...");
      await db.execute("DROP TABLE IF EXISTS task_entries;");
    }

    // 1. 最新のスキーマを確認
    await db.execute(schema);

    // 2. updated_at カラムの欠落を補完
    const tables = ['tasks', 'actions', 'task_entries', 'action_entries', 'daily_logs', 'notification_settings'];
    for (const table of tables) {
      try {
        const info = await db.query(`PRAGMA table_info(${table});`);
        const columns = info.values || [];
        if (!columns.some((c: any) => c.name === 'updated_at')) {
          console.log(`Adding updated_at column to ${table}...`);
          // Web版のSQLiteでは DEFAULT に CURRENT_TIMESTAMP のような関数を指定できない場合があるため、
          // text型として追加してから個別に更新する
          await db.execute(`ALTER TABLE ${table} ADD COLUMN updated_at TEXT;`);
          await db.execute(`UPDATE ${table} SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL;`);
        }
      } catch (e) {
        console.warn(`Migration/Check failed for table ${table}`, e);
      }
    }

    await db.execute("PRAGMA user_version = 3;");

    // Web版では明示的に保存が必要
    if (Capacitor.getPlatform() === 'web') {
      await sqlite.saveToStore(DB_NAME);
      console.log("SQLite state saved to store.");
    }

    console.log("Tables created/verified.");
  } catch (e) {
    console.error("Error creating tables", e);
    throw e;
  }
}
