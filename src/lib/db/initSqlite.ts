import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { CapacitorSQLiteWeb } from '@capacitor-community/sqlite/dist/esm/web';

const isWebOrIos = Capacitor.getPlatform() === 'web' || Capacitor.getPlatform() === 'ios';
const sqlitePlugin = isWebOrIos ? new CapacitorSQLiteWeb() : CapacitorSQLite;

export const sqlite = new SQLiteConnection(sqlitePlugin);

export const DB_NAME = "lifeos_db";

let initPromise: Promise<SQLiteDBConnection> | null = null;

export function initSqlite(): Promise<SQLiteDBConnection> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      console.log("[initSqlite] Starting initialization...");

      // Web環境(jeep-sqlite)向けのセットアップ
      if (Capacitor.getPlatform() === 'web' || Capacitor.getPlatform() === 'ios') {
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

      let message = err.message || JSON.stringify(err);
      if (message.includes("UNIMPLEMENTED")) {
        message = "Capacitor plugin not synced. Please run 'npx cap sync ios' on your Mac terminal and rebuild in Xcode.";
      }
      
      const enhancedError = new Error(message);
      (enhancedError as any).code = err.code || "UNKNOWN";
      throw enhancedError;
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
        memo TEXT,
        remind_on INTEGER DEFAULT 0,
        remind_hour INTEGER DEFAULT 8,
        remind_minute INTEGER DEFAULT 0,
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
        habit_remind_minute INTEGER DEFAULT 0,
        task_remind_on INTEGER DEFAULT 1,
        task_remind_hour INTEGER DEFAULT 10,
        task_remind_minute INTEGER DEFAULT 0,
        task_remind_timing TEXT DEFAULT '[1,2,3]',
        review_remind_on INTEGER DEFAULT 1,
        review_remind_hour INTEGER DEFAULT 21,
        review_remind_minute INTEGER DEFAULT 0,
        volume_unit TEXT DEFAULT '30',
        sort_rule TEXT DEFAULT 'priority',
        prioritize_due INTEGER DEFAULT 0,
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

    // 3. tasks.memo カラムの追加（v4マイグレーション）
    try {
      const tasksInfo = await db.query(`PRAGMA table_info(tasks);`);
      const tasksColumns = tasksInfo.values || [];
      if (!tasksColumns.some((c: any) => c.name === 'memo')) {
        console.log('Adding memo column to tasks...');
        await db.execute(`ALTER TABLE tasks ADD COLUMN memo TEXT;`);
      }
    } catch (e) {
      console.warn('Migration/Check failed for tasks.memo', e);
    }

    // 5. tasks の remind カラム追加（v6マイグレーション）
    try {
      const tasksInfo2 = await db.query(`PRAGMA table_info(tasks);`);
      const tasksColumns2 = (tasksInfo2.values || []).map((c: any) => c.name);
      const remindCols = [
        { name: 'remind_on',     def: '0' },
        { name: 'remind_hour',   def: '8' },
        { name: 'remind_minute', def: '0' },
      ];
      for (const col of remindCols) {
        if (!tasksColumns2.includes(col.name)) {
          console.log(`Adding ${col.name} column to tasks...`);
          await db.execute(`ALTER TABLE tasks ADD COLUMN ${col.name} INTEGER DEFAULT ${col.def};`);
        }
      }
    } catch (e) {
      console.warn('Migration/Check failed for tasks remind columns', e);
    }

    // 4. notification_settings の分カラム追加（v5マイグレーション）
    try {
      const nsInfo = await db.query(`PRAGMA table_info(notification_settings);`);
      const nsColumns = (nsInfo.values || []).map((c: any) => c.name);
      const minuteCols = [
        { name: 'habit_remind_minute', default: 0 },
        { name: 'task_remind_minute',  default: 0 },
        { name: 'review_remind_minute', default: 0 },
      ];
      for (const col of minuteCols) {
        if (!nsColumns.includes(col.name)) {
          console.log(`Adding ${col.name} column to notification_settings...`);
          await db.execute(`ALTER TABLE notification_settings ADD COLUMN ${col.name} INTEGER DEFAULT ${col.default};`);
        }
      }
    } catch (e) {
      console.warn('Migration/Check failed for notification_settings minute columns', e);
    }

    // 6. notification_settings の volume_unit カラム追加（v7マイグレーション）
    try {
      const nsInfo2 = await db.query(`PRAGMA table_info(notification_settings);`);
      const nsColumns2 = (nsInfo2.values || []).map((c: any) => c.name);
      if (!nsColumns2.includes('volume_unit')) {
        console.log('Adding volume_unit column to notification_settings...');
        await db.execute(`ALTER TABLE notification_settings ADD COLUMN volume_unit TEXT DEFAULT '30';`);
      }
    } catch (e) {
      console.warn('Migration/Check failed for notification_settings.volume_unit', e);
    }

    // 7. daily_logs の tomorrow_note / yesterday_achievement カラム追加（v8マイグレーション）
    try {
      const dlInfo = await db.query(`PRAGMA table_info(daily_logs);`);
      const dlColumns = (dlInfo.values || []).map((c: any) => c.name);
      if (!dlColumns.includes('tomorrow_note')) {
        console.log('Adding tomorrow_note column to daily_logs...');
        await db.execute(`ALTER TABLE daily_logs ADD COLUMN tomorrow_note TEXT;`);
      }
      if (!dlColumns.includes('yesterday_achievement')) {
        console.log('Adding yesterday_achievement column to daily_logs...');
        await db.execute(`ALTER TABLE daily_logs ADD COLUMN yesterday_achievement TEXT;`);
      }
    } catch (e) {
      console.warn('Migration/Check failed for daily_logs new columns', e);
    }

    // 8. tasks / actions / action_entries に deleted_at カラム追加（v9マイグレーション・ソフトデリート）
    try {
      for (const t of ['tasks', 'actions', 'action_entries']) {
        const info = await db.query(`PRAGMA table_info(${t});`);
        const cols = (info.values || []).map((c: any) => c.name);
        if (!cols.includes('deleted_at')) {
          console.log(`Adding deleted_at column to ${t}...`);
          await db.execute(`ALTER TABLE ${t} ADD COLUMN deleted_at TEXT;`);
        }
      }
    } catch (e) {
      console.warn('Migration/Check failed for deleted_at columns', e);
    }

    // 9. notification_settings の sort_rule / prioritize_due カラム追加（v10マイグレーション）
    try {
      const nsInfo3 = await db.query(`PRAGMA table_info(notification_settings);`);
      const nsColumns3 = (nsInfo3.values || []).map((c: any) => c.name);
      if (!nsColumns3.includes('sort_rule')) {
        console.log('Adding sort_rule column to notification_settings...');
        await db.execute(`ALTER TABLE notification_settings ADD COLUMN sort_rule TEXT DEFAULT 'priority';`);
      }
      if (!nsColumns3.includes('prioritize_due')) {
        console.log('Adding prioritize_due column to notification_settings...');
        await db.execute(`ALTER TABLE notification_settings ADD COLUMN prioritize_due INTEGER DEFAULT 0;`);
      }
    } catch (e) {
      console.warn('Migration/Check failed for notification_settings sort columns', e);
    }

    await db.execute("PRAGMA user_version = 10;");

    // Web版では明示的に保存が必要
    if (Capacitor.getPlatform() === 'web' || Capacitor.getPlatform() === 'ios') {
      await sqlite.saveToStore(DB_NAME);
      console.log("SQLite state saved to store.");
    }

    console.log("Tables created/verified.");
  } catch (e) {
    console.error("Error creating tables", e);
    throw e;
  }
}
