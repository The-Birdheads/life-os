/**
 * 端末内 SQLite の行と、Supabase(habitas スキーマ)の行の変換。
 * SQLite には JSON の列が無いため TEXT で持ち、サーバーへ送るときに JSON に戻す
 * (文字列のまま送ると、jsonb に「文字列」として保存されてしまう)。
 */

/** テーブルごとの JSON の列と、空のときの値 */
export const JSON_COLUMNS: Record<string, Record<string, unknown>> = {
  tasks: { frequency_history: [] },
  mandala_cells: { paused_periods: [] },
  mandala_reviews: { decisions: [], snapshot: {} },
};

/** マンダラチャート関連のテーブル(どれも id で同期し、削除は deleted_at) */
export const MANDALA_TABLES = ["mandala_charts", "mandala_cells", "mandala_cell_events", "mandala_reviews"] as const;

/** 各テーブルの列(端末内とサーバーで共通のもの)。同期の取り込みで使う */
export const MANDALA_COLUMNS: Record<(typeof MANDALA_TABLES)[number], string[]> = {
  mandala_charts: ["id", "user_id", "title", "start_date", "end_date", "status", "deleted_at", "created_at", "updated_at"],
  mandala_cells: ["id", "user_id", "chart_id", "element_index", "cell_index", "text", "color", "status", "paused_periods", "deleted_at", "created_at", "updated_at"],
  mandala_cell_events: ["id", "user_id", "cell_id", "kind", "note", "task_id", "deleted_at", "created_at", "updated_at"],
  mandala_reviews: ["id", "user_id", "chart_id", "reviewed_at", "good_note", "next_note", "decisions", "snapshot", "deleted_at", "created_at", "updated_at"],
};

/** SQLite の TEXT を JSON に戻す。壊れていれば空の値 */
export function parseJsonColumn<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value !== "string") return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/** JSON を SQLite の TEXT にする */
export function stringifyJsonColumn(value: unknown, fallback: unknown): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value ?? fallback);
}

/** 端末内の行 → サーバーへ送る行 */
export function toRemoteRow(table: string, row: Record<string, any>): Record<string, any> {
  const jsonCols = JSON_COLUMNS[table];
  if (!jsonCols) return row;
  const out = { ...row };
  for (const [col, fallback] of Object.entries(jsonCols)) {
    if (col in out) out[col] = parseJsonColumn(out[col], fallback);
  }
  return out;
}

/** サーバーの値 → 端末内に入れる値 */
export function toLocalValue(table: string, col: string, value: unknown): unknown {
  const jsonCols = JSON_COLUMNS[table];
  if (jsonCols && col in jsonCols) return stringifyJsonColumn(value, jsonCols[col]);
  return value ?? null;
}
