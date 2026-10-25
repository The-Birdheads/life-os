#!/usr/bin/env node
// 旧 Supabase プロジェクト(Habitas 単独)のデータを、Memory Calendar と共通のプロジェクト(habitas スキーマ)へ移す。
//
// 使い方(ドライラン。何も書き込まない):
//   LEGACY_URL=... LEGACY_SERVICE_ROLE_KEY=... NEW_URL=... NEW_SERVICE_ROLE_KEY=... \
//     node scripts/migrate-legacy/run.mjs
// 書き込む:        --apply
// 未登録のユーザーを作る:  --create-missing-users(--apply のときだけ作成。ドライランでは「作成予定」と表示)
// 特定のユーザーだけ:      --user <旧プロジェクトでのメールアドレス>
// Apple/Google の識別子の登録 SQL の出力先:  --identities-out <ファイル>(既定: ./migrate-identities.sql)
//   → 書き込み後に `supabase db query --linked -f <ファイル>` で実行する(新ユーザーに識別子を登録し、
//     旧版と同じ Apple/Google アカウントで確実にログインできるようにする)
//
// - service_role キーは環境変数で渡す(コマンド履歴に残らないよう、`read -s` で入力するなどして export する)。
// - 何度実行してもよい。行IDは変えず、移行先に同じ行があれば、updated_at が新しいほうを残す。
// - 詳細は scripts/migrate-legacy/README.md。
import { createClient } from "@supabase/supabase-js";
import {
  TABLES,
  chunk,
  dropOrphans,
  identitySql,
  indexUsers,
  matchUser,
  missingIdentities,
  normalizeEmail,
  planTable,
  transformRow,
} from "./lib.mjs";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const CREATE_MISSING = args.includes("--create-missing-users");
const userArgIndex = args.indexOf("--user");
const ONLY_EMAIL = userArgIndex >= 0 ? normalizeEmail(args[userArgIndex + 1]) : null;
const outArgIndex = args.indexOf("--identities-out");
const IDENTITIES_OUT = outArgIndex >= 0 ? args[outArgIndex + 1] : "./migrate-identities.sql";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`環境変数 ${name} が設定されていません。`);
    process.exit(2);
  }
  return value;
}

const LEGACY_URL = requireEnv("LEGACY_URL");
const LEGACY_KEY = requireEnv("LEGACY_SERVICE_ROLE_KEY");
const NEW_URL = requireEnv("NEW_URL");
const NEW_KEY = requireEnv("NEW_SERVICE_ROLE_KEY");

if (LEGACY_URL.replace(/\/$/, "") === NEW_URL.replace(/\/$/, "")) {
  console.error("LEGACY_URL と NEW_URL が同じです。移行元と移行先を取り違えていないか確認してください。");
  process.exit(2);
}

const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const legacy = createClient(LEGACY_URL, LEGACY_KEY, clientOptions); // 旧: public スキーマ
const newAuth = createClient(NEW_URL, NEW_KEY, clientOptions); // 新: auth / public
const newHabitas = createClient(NEW_URL, NEW_KEY, { ...clientOptions, db: { schema: "habitas" } });

async function listAllUsers(client) {
  const users = [];
  for (let page = 1; ; page++) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`ユーザー一覧の取得に失敗: ${error.message}`);
    users.push(...data.users);
    if (data.users.length < 1000) return users;
  }
}

/**
 * 管理 API の一覧(listUsers)は、identities が null で返ることがある。
 * その場合は、ユーザーごとに個別取得(getUserById)して、identities を補う(同時 8 件まで)。
 */
async function hydrateIdentities(client, users) {
  const pending = users.filter((u) => !Array.isArray(u.identities));
  let next = 0;
  const worker = async () => {
    while (next < pending.length) {
      const user = pending[next++];
      const { data, error } = await client.auth.admin.getUserById(user.id);
      if (error) throw new Error(`ユーザー ${user.id} の取得に失敗: ${error.message}`);
      user.identities = data.user.identities ?? [];
    }
  };
  await Promise.all(Array.from({ length: Math.min(8, pending.length) }, worker));
  return users;
}

async function readAll(client, table, userColumn, userId, orderColumn = "id") {
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from(table)
      .select("*")
      .eq(userColumn, userId)
      .order(orderColumn)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`${table} の読み取りに失敗: ${error.message}`);
    rows.push(...data);
    if (data.length < pageSize) return rows;
  }
}

/** 同じキーの行が複数あれば、updated_at が新しい1件だけを残す */
function dedupe(table, rows) {
  const byKey = new Map();
  for (const row of rows) {
    const key = table.key(row);
    const existing = byKey.get(key);
    if (!existing || Date.parse(row.updated_at ?? 0) > Date.parse(existing.updated_at ?? 0)) byKey.set(key, row);
  }
  return [...byKey.values()];
}

function emailOf(user) {
  return user.email ?? "(メールなし)";
}

async function main() {
  console.log(`モード: ${APPLY ? "【書き込み】" : "ドライラン(書き込みません)"}${CREATE_MISSING ? " / 未登録ユーザーを作成" : ""}`);
  console.log(`移行元: ${LEGACY_URL}\n移行先: ${NEW_URL}\n`);

  // LEGACY_USERS_FILE: 旧ユーザー一覧(auth.admin.listUsers の users の形の JSON)を、ファイルで渡す(テスト用)
  const rawLegacyUsers = process.env.LEGACY_USERS_FILE
    ? JSON.parse((await import("node:fs")).readFileSync(process.env.LEGACY_USERS_FILE, "utf8"))
    : await hydrateIdentities(legacy, await listAllUsers(legacy));
  const legacyUsers = rawLegacyUsers.filter(
    (u) => !ONLY_EMAIL || normalizeEmail(u.email) === ONLY_EMAIL
  );
  const newUsers = await hydrateIdentities(newAuth, await listAllUsers(newAuth));
  const newIndex = indexUsers(newUsers);
  console.log(`旧ユーザー: ${legacyUsers.length} 人 / 新プロジェクトの既存ユーザー: ${newUsers.length} 人\n`);

  const report = { migrated: 0, unmapped: [], noData: [], errors: [], skippedRows: [] };
  const identityStatements = [];

  for (const legacyUser of legacyUsers) {
    const label = `${emailOf(legacyUser)} (${legacyUser.id})`;
    try {
      // --- 1. ユーザーの突き合わせ
      let target = null;
      let via = null;
      const match = matchUser(legacyUser, newIndex);
      if (match) {
        target = match.user;
        via = match.via;
      }
      console.log(`■ ${label}`);

      // --- 2. 旧データの読み取り(件数の確認用に、変換前の行を先に読む)
      const rawRows = {};
      for (const table of TABLES) rawRows[table.name] = await readAll(legacy, table.name, "user_id", legacyUser.id);
      const legacyProfiles = await readAll(legacy, "user_profiles", "user_id", legacyUser.id, "user_id");
      const totalRows = Object.values(rawRows).reduce((n, rows) => n + rows.length, 0);
      const noAds = legacyProfiles.some((p) => p.no_ads === true);

      // --- 2b. 対応するユーザーがいなければ、(指定があれば)作成する。移行するデータが無い人は作らない
      if (!target) {
        if (!CREATE_MISSING || !legacyUser.email) {
          console.log("   → 新プロジェクトに対応するユーザーがいません(スキップ)。--create-missing-users で作成できます\n");
          report.unmapped.push(label);
          continue;
        }
        if (totalRows === 0) {
          console.log("   → 移行するデータが無いため、ユーザーを作成しません(スキップ)\n");
          report.noData.push(label);
          continue;
        }
        if (APPLY) {
          const { data, error } = await newAuth.auth.admin.createUser({
            email: legacyUser.email,
            email_confirm: true,
            user_metadata: { migrated_from_legacy_id: legacyUser.id },
          });
          if (error) throw new Error(`ユーザーの作成に失敗: ${error.message}`);
          target = { ...data.user, identities: data.user.identities ?? [] };
          via = "created";
        } else {
          via = "would-create";
        }
      }
      console.log(`   → 対応: ${target ? `${emailOf(target)} (${target.id})` : "(新規に作成予定)"}  [${via}]`);
      const newUserId = target?.id ?? "00000000-0000-0000-0000-000000000000";

      // --- 2c. Apple/Google の識別子(新ユーザーに無いものを、あとで登録する SQL にする)
      const identities = missingIdentities(legacyUser, target);
      for (const identity of identities) {
        console.log(`   識別子の登録${APPLY ? "" : "予定"}: ${identity.provider} (${identity.provider_id.slice(0, 8)}...)`);
        if (APPLY && target) identityStatements.push(identitySql(target.id, identity));
      }

      // --- 2d. 変換
      const sources = {};
      for (const table of TABLES) {
        const converted = [];
        for (const row of rawRows[table.name]) {
          const result = transformRow(table, row, newUserId);
          if (result.error) report.skippedRows.push(`${label} ${table.name} ${row.id ?? ""}: ${result.error}`);
          else converted.push(result.row);
        }
        sources[table.name] = dedupe(table, converted);
      }

      // --- 3. 移行先の既存データと比べて、計画を作る
      const plans = {};
      const targets = {};
      for (const table of TABLES) {
        targets[table.name] = target ? await readAll(newHabitas, table.name, "user_id", target.id) : [];
        plans[table.name] = planTable(table, sources[table.name], targets[table.name]);
      }
      const validTaskIds = new Set([...sources.tasks, ...targets.tasks].map((r) => r.id));
      const validActionIds = new Set([...sources.actions, ...targets.actions].map((r) => r.id));
      for (const [entries, valid] of [["task_entries", validTaskIds], ["action_entries", validActionIds]]) {
        for (const kind of ["insert", "update"]) {
          const { kept, orphans } = dropOrphans(entries, plans[entries][kind], valid);
          plans[entries][kind] = kept;
          for (const o of orphans) report.skippedRows.push(`${label} ${entries} ${o.id}: 参照先がありません`);
        }
      }

      for (const table of TABLES) {
        const p = plans[table.name];
        console.log(`   ${table.name.padEnd(22)} 追加 ${String(p.insert.length).padStart(4)} / 更新 ${String(p.update.length).padStart(4)} / 変更なし ${String(p.skip.length).padStart(4)}`);
      }
      console.log(`   広告オフ(no_ads): ${noAds ? "あり" : "なし"}`);

      // --- 4. 書き込み
      if (APPLY && target) {
        for (const table of TABLES) {
          const rows = [...plans[table.name].insert, ...plans[table.name].update];
          for (const part of chunk(rows, 500)) {
            const { error } = await newHabitas.from(table.name).upsert(part, { onConflict: table.conflict });
            if (error) throw new Error(`${table.name} の書き込みに失敗: ${error.message}`);
          }
        }
        if (noAds) {
          const { error } = await newHabitas
            .from("user_profiles")
            .upsert({ user_id: target.id, no_ads: true }, { onConflict: "user_id" });
          if (error) throw new Error(`user_profiles の書き込みに失敗: ${error.message}`);
        }
        const { error: usageError } = await newAuth
          .from("app_usage")
          .upsert({ user_id: target.id, app: "habitas" }, { onConflict: "user_id,app", ignoreDuplicates: true });
        if (usageError) throw new Error(`app_usage の登録に失敗: ${usageError.message}`);
        console.log("   ✔ 書き込み完了");
      }
      report.migrated++;
      console.log("");
    } catch (e) {
      console.error(`   ✖ エラー: ${e.message}\n`);
      report.errors.push(`${label}: ${e.message}`);
    }
  }

  console.log("──────── 結果 ────────");
  console.log(`${APPLY ? "移行した" : "移行できる"}ユーザー: ${report.migrated} 人`);
  if (report.noData.length) console.log(`移行するデータが無く、ユーザーを作らなかった: ${report.noData.length} 人\n  - ${report.noData.join("\n  - ")}`);
  if (APPLY && identityStatements.length) {
    const { writeFileSync } = await import("node:fs");
    writeFileSync(IDENTITIES_OUT, `${identityStatements.join("\n")}\n`, "utf8");
    console.log(`\nApple/Google の識別子の登録 SQL を ${IDENTITIES_OUT} に書き出しました(${identityStatements.length} 件)。次のコマンドで実行してください(新プロジェクトにリンクした状態で):\n  supabase db query --linked -f ${IDENTITIES_OUT}`);
  }
  if (report.unmapped.length) console.log(`対応するユーザーがいない: ${report.unmapped.length} 人\n  - ${report.unmapped.join("\n  - ")}`);
  if (report.skippedRows.length) console.log(`移行しなかった行: ${report.skippedRows.length} 件\n  - ${report.skippedRows.slice(0, 20).join("\n  - ")}${report.skippedRows.length > 20 ? "\n  ...(以降省略)" : ""}`);
  if (report.errors.length) {
    console.log(`エラー: ${report.errors.length} 件\n  - ${report.errors.join("\n  - ")}`);
    process.exit(1);
  }
  if (!APPLY) console.log("\n(ドライランです。書き込むには --apply を付けて、もう一度実行します)");
}

main().catch((e) => {
  console.error("致命的なエラー:", e.message);
  process.exit(1);
});
