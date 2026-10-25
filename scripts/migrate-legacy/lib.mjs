// 旧 Supabase プロジェクト(Habitas 単独)→ Memory Calendar と共通のプロジェクト(habitas スキーマ)への
// データ移行の、純粋なロジック(I/O なし)。run.mjs から使う。テストは lib.test.mjs。

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 移行するテーブル。順序は外部キーの依存順(tasks/actions → entries)。
 * - columns: 新しいスキーマ(habitas.*)にある列。これ以外の列は捨てる。
 * - bools: 旧側で 0/1 や true/false が混在し得る真偽値の列
 * - uuids: uuid であるべき列(違えば、その行は移行せず報告する)
 * - key: 新旧で同じ行かどうかを判断するキー
 * - conflict: 書き込み時の onConflict
 * - nullIfEmpty: 空文字を null にする列(日付など)
 */
export const TABLES = [
  {
    name: "tasks",
    columns: ["id", "user_id", "title", "task_type", "due_date", "is_active", "is_hidden", "priority", "volume", "memo", "remind_on", "remind_hour", "remind_minute", "deleted_at", "created_at", "updated_at"],
    bools: ["is_active", "is_hidden", "remind_on"],
    uuids: ["id"],
    nullIfEmpty: ["due_date", "memo"],
    key: (r) => r.id,
    conflict: "id",
  },
  {
    name: "actions",
    columns: ["id", "user_id", "category", "kind", "is_active", "is_hidden", "deleted_at", "created_at", "updated_at"],
    bools: ["is_active", "is_hidden"],
    uuids: ["id"],
    nullIfEmpty: [],
    key: (r) => r.id,
    conflict: "id",
  },
  {
    name: "task_entries",
    columns: ["id", "user_id", "day", "task_id", "status", "created_at", "updated_at"],
    bools: [],
    uuids: ["id", "task_id"],
    nullIfEmpty: [],
    key: (r) => `${r.day}|${r.task_id}`,
    conflict: "user_id,day,task_id",
  },
  {
    name: "action_entries",
    columns: ["id", "user_id", "day", "action_id", "note", "volume", "deleted_at", "created_at", "updated_at"],
    bools: [],
    uuids: ["id", "action_id"],
    nullIfEmpty: ["note"],
    key: (r) => r.id,
    conflict: "id",
  },
  {
    name: "daily_logs",
    columns: ["id", "user_id", "day", "note", "satisfaction", "task_total", "action_total", "total_score", "task_ratio", "action_ratio", "balance_factor", "fulfillment", "tomorrow_note", "yesterday_achievement", "created_at", "updated_at"],
    bools: [],
    uuids: ["id"],
    nullIfEmpty: ["note", "tomorrow_note", "yesterday_achievement"],
    key: (r) => r.day,
    conflict: "user_id,day",
  },
  {
    name: "notification_settings",
    columns: ["id", "user_id", "habit_remind_on", "habit_remind_hour", "habit_remind_minute", "task_remind_on", "task_remind_hour", "task_remind_minute", "task_remind_timing", "review_remind_on", "review_remind_hour", "review_remind_minute", "volume_unit", "sort_rule", "prioritize_due", "updated_at"],
    bools: ["habit_remind_on", "task_remind_on", "review_remind_on", "prioritize_due"],
    uuids: [],
    nullIfEmpty: [],
    key: () => "settings",
    conflict: "user_id",
  },
];

export const TABLE_BY_NAME = Object.fromEntries(TABLES.map((t) => [t.name, t]));

// ---------------------------------------------------------------- ユーザーの突き合わせ

export function normalizeEmail(email) {
  return typeof email === "string" && email.trim() ? email.trim().toLowerCase() : null;
}

/** そのユーザーの、外部ログインの識別子(`apple:<sub>`、`google:<sub>`)の一覧 */
export function identityKeys(user) {
  const keys = [];
  for (const identity of user?.identities ?? []) {
    const provider = identity.provider;
    if (provider !== "apple" && provider !== "google") continue;
    const sub = identity.identity_data?.sub ?? identity.provider_id ?? null;
    if (sub) keys.push(`${provider}:${sub}`);
  }
  return keys;
}

export function indexUsers(users) {
  const byIdentity = new Map();
  const byEmail = new Map();
  for (const user of users) {
    for (const key of identityKeys(user)) byIdentity.set(key, user);
    const email = normalizeEmail(user.email);
    if (email) byEmail.set(email, user);
  }
  return { byIdentity, byEmail };
}

/**
 * 旧ユーザーに対応する、新プロジェクトのユーザーを探す。
 * 1) Apple/Google の識別子(sub)が一致(Apple の sub はチーム単位、Google の sub はアカウント単位で共通)
 * 2) メールアドレスが一致(「メールを隠す」の中継アドレスも、同じアプリなら同じ値)
 */
export function matchUser(legacyUser, newIndex) {
  for (const key of identityKeys(legacyUser)) {
    const found = newIndex.byIdentity.get(key);
    if (found) return { user: found, via: key.split(":")[0] + "-sub" };
  }
  const email = normalizeEmail(legacyUser.email);
  if (email) {
    const found = newIndex.byEmail.get(email);
    if (found) return { user: found, via: "email" };
  }
  return null;
}

// ---------------------------------------------------------------- 行の変換・計画

function toBool(value) {
  if (value === true || value === 1 || value === "1" || value === "true" || value === "t") return true;
  return false;
}

/**
 * 旧の行を、新スキーマの行に変換する。
 * 戻り値: { row } または { error: "理由" }(その行は移行しない)
 */
export function transformRow(table, legacyRow, newUserId) {
  const row = {};
  for (const column of table.columns) {
    if (column in legacyRow && legacyRow[column] !== undefined) row[column] = legacyRow[column];
  }
  row.user_id = newUserId;

  for (const column of table.bools) {
    if (column in row && row[column] !== null) row[column] = toBool(row[column]);
  }
  for (const column of table.nullIfEmpty) {
    if (row[column] === "") row[column] = null;
  }
  for (const column of table.uuids) {
    if (typeof row[column] !== "string" || !UUID_RE.test(row[column])) {
      return { error: `${column} が uuid ではありません: ${JSON.stringify(row[column])}` };
    }
  }
  if (table.name === "notification_settings" && typeof row.id !== "string") {
    row.id = `settings_${newUserId}`;
  }
  // 新側で not null の列が欠けた行は、書き込めない
  if (table.name === "tasks" && (!row.title || !row.task_type)) return { error: "title/task_type がありません" };
  if (table.name === "task_entries" && (!row.day || !row.status)) return { error: "day/status がありません" };
  return { row };
}

function time(value) {
  const t = value ? Date.parse(value) : NaN;
  return Number.isNaN(t) ? 0 : t;
}

/**
 * 移行元の行(変換済み)と、移行先の既存の行を比べて、書き込み計画を作る。
 * - 移行先に無い → insert
 * - 移行先にある → 移行元の updated_at が新しいときだけ update(移行先の新しいデータは上書きしない)
 * - それ以外 → skip
 */
export function planTable(table, sourceRows, targetRows) {
  const targetByKey = new Map(targetRows.map((r) => [table.key(r), r]));
  const plan = { insert: [], update: [], skip: [] };
  for (const row of sourceRows) {
    const existing = targetByKey.get(table.key(row));
    if (!existing) plan.insert.push(row);
    else if (time(row.updated_at) > time(existing.updated_at)) plan.update.push(row);
    else plan.skip.push(row);
  }
  return plan;
}

/**
 * task_entries / action_entries のうち、参照先(tasks / actions)が存在しない行を取り除く
 * (新側では外部キーがあり、書き込めないため)。
 * validTaskIds / validActionIds: 移行元と移行先を合わせた、存在する id の集合
 */
export function dropOrphans(entriesTableName, rows, validIds) {
  const refColumn = entriesTableName === "task_entries" ? "task_id" : "action_id";
  const kept = [];
  const orphans = [];
  for (const row of rows) (validIds.has(row[refColumn]) ? kept : orphans).push(row);
  return { kept, orphans };
}

export function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) chunks.push(array.slice(i, i + size));
  return chunks;
}

// ---------------------------------------------------------------- 識別子(identities)の引き継ぎ

/**
 * 新ユーザーにまだ無い、旧ユーザーの Apple/Google の識別子を返す。
 * 新ユーザーにこれを登録しておくと、旧版と同じ Apple/Google アカウントでログインしたとき、
 * メールの自動連携に頼らず、確実にそのユーザー(= 移行済みのデータ)としてログインできる。
 */
export function missingIdentities(legacyUser, targetUser) {
  const have = new Set(identityKeys(targetUser ?? {}));
  const missing = [];
  for (const identity of legacyUser?.identities ?? []) {
    if (identity.provider !== "apple" && identity.provider !== "google") continue;
    const sub = identity.identity_data?.sub ?? identity.provider_id ?? null;
    if (!sub || have.has(`${identity.provider}:${sub}`)) continue;
    missing.push({
      provider: identity.provider,
      provider_id: String(sub),
      identity_data: { ...(identity.identity_data ?? {}), sub: String(sub) },
    });
  }
  return missing;
}

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

/** auth.identities への登録 SQL(冪等)。`supabase db query --linked -f` で実行する。 */
export function identitySql(userId, identity) {
  return (
    "insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at) values " +
    `(${sqlString(identity.provider_id)}, ${sqlString(userId)}, ${sqlString(JSON.stringify(identity.identity_data))}::jsonb, ${sqlString(identity.provider)}, null, now(), now()) ` +
    "on conflict (provider_id, provider) do nothing;"
  );
}
