/**
 * テストデータ投入スクリプト（週ビュー対応版）
 *
 * 使い方:
 *   npx tsx scripts/seed.ts --date 2026-03-30 --userId <supabase_user_id>
 *
 * 環境変数（.env に記載）:
 *   VITE_SUPABASE_URL=https://xxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ...   ← Dashboard > Settings > API > service_role
 */

import { createClient } from "@supabase/supabase-js";
import * as crypto from "crypto";

// ── 引数パース ──────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (k: string) => { const i = args.indexOf(k); return i !== -1 ? args[i + 1] : undefined; };

const targetDate = getArg("--date") ?? new Date().toISOString().slice(0, 10);
const userId = getArg("--userId");

if (!userId) {
  console.error("Usage: npx tsx scripts/seed.ts --date YYYY-MM-DD --userId <uuid>");
  process.exit(1);
}

// ── Supabase（service_role で RLS バイパス）──────────────────────
const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!supabaseUrl || !serviceRoleKey) {
  console.error("VITE_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を .env に設定してください");
  process.exit(1);
}
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── ユーティリティ ───────────────────────────────────────────────
const uid = () => crypto.randomUUID();
const now = new Date().toISOString();

/** 基準日から n 日後の日付文字列 */
const addDays = (base: string, n: number): string => {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

/** 7日分の日付（6日前 → 当日）*/
const DAYS = Array.from({ length: 7 }, (_, i) => addDays(targetDate, i - 6));
const tomorrow = addDays(targetDate, 1);

/** 再現性のある疑似乱数（0–1）*/
const rng = (seed: number) => { const x = Math.sin(seed + 1) * 10000; return x - Math.floor(x); };

/** 配列を決定論的にシャッフル（Fisher-Yates） */
function shuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng(seed + i) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ================================================================
// マスターデータ定義
// ================================================================

// 習慣（3件）priority: 1〜5、volume: 1=30分
const habits = [
  { id: uid(), user_id: userId, title: "毎朝ストレッチ", task_type: "habit", is_active: true, is_hidden: false, priority: 3, volume: 1,  due_date: null, updated_at: now }, // 30分・健康維持
  { id: uid(), user_id: userId, title: "英語学習 30 分", task_type: "habit", is_active: true, is_hidden: false, priority: 4, volume: 1,  due_date: null, updated_at: now }, // 30分・自己成長
  { id: uid(), user_id: userId, title: "水を 2L 飲む",   task_type: "habit", is_active: true, is_hidden: false, priority: 3, volume: 1,  due_date: null, updated_at: now }, // 30分未満だが継続重要
];

// タスク（完了可能 12件）priority: 1〜5、volume: 1=30分
const completableTasks = [
  { id: uid(), user_id: userId, title: "月次レポートの作成",       task_type: "oneoff", is_active: true, is_hidden: false, priority: 4, volume: 4,  due_date: DAYS[0], updated_at: now }, // 2時間
  { id: uid(), user_id: userId, title: "読書ノートの整理",         task_type: "oneoff", is_active: true, is_hidden: false, priority: 2, volume: 1,  due_date: DAYS[0], updated_at: now }, // 30分
  { id: uid(), user_id: userId, title: "プロジェクト計画書の更新", task_type: "oneoff", is_active: true, is_hidden: false, priority: 4, volume: 3,  due_date: DAYS[1], updated_at: now }, // 1.5時間
  { id: uid(), user_id: userId, title: "チームミーティングの準備", task_type: "oneoff", is_active: true, is_hidden: false, priority: 3, volume: 2,  due_date: DAYS[1], updated_at: now }, // 1時間
  { id: uid(), user_id: userId, title: "クライアントへのメール返信", task_type: "oneoff", is_active: true, is_hidden: false, priority: 4, volume: 1, due_date: DAYS[2], updated_at: now }, // 30分・緊急
  { id: uid(), user_id: userId, title: "週次振り返りのまとめ",     task_type: "oneoff", is_active: true, is_hidden: false, priority: 3, volume: 2,  due_date: DAYS[2], updated_at: now }, // 1時間
  { id: uid(), user_id: userId, title: "データのバックアップ",     task_type: "oneoff", is_active: true, is_hidden: false, priority: 2, volume: 1,  due_date: DAYS[3], updated_at: now }, // 30分
  { id: uid(), user_id: userId, title: "友人への連絡",             task_type: "oneoff", is_active: true, is_hidden: false, priority: 2, volume: 1,  due_date: DAYS[3], updated_at: now }, // 30分
  { id: uid(), user_id: userId, title: "ジムの予約",               task_type: "oneoff", is_active: true, is_hidden: false, priority: 2, volume: 1,  due_date: DAYS[4], updated_at: now }, // 30分未満
  { id: uid(), user_id: userId, title: "書類の整理整頓",           task_type: "oneoff", is_active: true, is_hidden: false, priority: 2, volume: 2,  due_date: DAYS[4], updated_at: now }, // 1時間
  { id: uid(), user_id: userId, title: "食材の買い出し",           task_type: "oneoff", is_active: true, is_hidden: false, priority: 3, volume: 2,  due_date: DAYS[5], updated_at: now }, // 1時間
  { id: uid(), user_id: userId, title: "ブログ記事の下書き",       task_type: "oneoff", is_active: true, is_hidden: false, priority: 2, volume: 3,  due_date: DAYS[5], updated_at: now }, // 1.5時間
];

// 指定日に未実施のタスク（2件）
const undoneTask1 = { id: uid(), user_id: userId, title: "プレゼン資料の仕上げ", task_type: "oneoff", is_active: true, is_hidden: false, priority: 5, volume: 4, due_date: null,    updated_at: now }; // 2時間・最重要
const undoneTask2 = { id: uid(), user_id: userId, title: "部屋の片付け",         task_type: "oneoff", is_active: true, is_hidden: false, priority: 2, volume: 3, due_date: tomorrow, updated_at: now }; // 1.5時間・翌日期限

const allTasks = [...habits, ...completableTasks, undoneTask1, undoneTask2];

// 行動カテゴリ（3種）
const actions = [
  { id: uid(), user_id: userId, category: "学習", kind: "読書", is_active: true, is_hidden: false, created_at: now, updated_at: now },
  { id: uid(), user_id: userId, category: "運動", kind: "ジョギング", is_active: true, is_hidden: false, created_at: now, updated_at: now },
  { id: uid(), user_id: userId, category: "趣味", kind: "音楽鑑賞", is_active: true, is_hidden: false, created_at: now, updated_at: now },
];

// [note, volume]  volume: 1=30分
const ACTION_NOTE_POOL: [string, number][][] = [
  // 読書
  [["ビジネス書を 20 ページ読んだ", 1], ["技術書を 1 章読んだ（約 1 時間）", 2], ["小説を読んでリラックス",           1]],
  // ジョギング
  [["公園を 3km ジョギング",          1], ["5km 走り切った",                    2], ["朝のランニング 4km",              1]],
  // 音楽鑑賞
  [["お気に入りのアルバムを 1 枚通しで聴いた", 2], ["新しいプレイリストを発見", 1], ["音楽でリフレッシュ",            1]],
];

const REVIEW_NOTE_POOL = [
  "今日は集中できた一日だった。タスクを効率よくこなせた。",
  "少し疲れ気味だが重要なタスクは完了できた。明日に向けて英気を養う。",
  "ストレッチを継続中。体が軽くなってきた気がする。",
  "英語学習が習慣になってきた。毎日続けることの大切さを実感。",
  "集中力が高い日だった。大きなタスクも一つひとつ片付けられた。",
  "行動ログも充実。健康的な生活リズムを保てている。",
  "週の締めに向けて残タスクを整理した。明日につなげていく。",
];

// ================================================================
// エントリ生成
// ================================================================

const taskEntries: any[] = [];
const actionEntries: any[] = [];
const dailyLogs: any[] = [];

// 完了可能タスクを決定論的シャッフルし、6日前〜前日へ 2件ずつ割り当て
const shuffledCompleted = shuffle(completableTasks, 42);
// shuffledCompleted[0,1] → DAYS[0], [2,3] → DAYS[1], ... [10,11] → DAYS[5]

DAYS.forEach((day, dayIdx) => {
  const isToday = day === targetDate;

  // ── 習慣エントリ（1〜3件をランダムに done）──────────────────────
  const habitDoneCount = Math.floor(rng(dayIdx * 13 + 1) * 3) + 1; // 1–3
  habits.slice(0, habitDoneCount).forEach(h => {
    taskEntries.push({ id: uid(), user_id: userId, day, task_id: h.id, status: "done", updated_at: now });
  });

  // ── タスクエントリ ────────────────────────────────────────────
  if (!isToday) {
    // 過去6日：割り当て済みタスク 2件を done
    const base = dayIdx * 2; // 0,2,4,6,8,10
    [shuffledCompleted[base], shuffledCompleted[base + 1]].forEach(task => {
      if (task) taskEntries.push({ id: uid(), user_id: userId, day, task_id: task.id, status: "done", updated_at: now });
    });
  }
  // 指定日：完了タスクエントリは追加しない（2件が pending のまま残る）

  // ── 行動エントリ（1〜3件）───────────────────────────────────────
  const actionCount = Math.floor(rng(dayIdx * 7 + 5) * 3) + 1; // 1–3
  for (let i = 0; i < actionCount; i++) {
    const aIdx = i % actions.length;
    const noteIdx = Math.floor(rng(dayIdx * 5 + i * 3) * 3);
    const [note, volume] = ACTION_NOTE_POOL[aIdx][noteIdx];
    actionEntries.push({
      id: uid(), user_id: userId, day,
      action_id: actions[aIdx].id,
      note,
      volume,
      created_at: now, updated_at: now,
    });
  }

  // ── 振り返りログ ─────────────────────────────────────────────
  const fulfillment = Math.floor(rng(dayIdx * 3 + 2) * 31) + 65; // 65–95
  const taskDone = isToday ? 0 : 2;
  const satisfaction = fulfillment >= 85 ? 5 : fulfillment >= 75 ? 4 : fulfillment >= 65 ? 3 : 2;

  dailyLogs.push({
    id: uid(), user_id: userId, day,
    note: REVIEW_NOTE_POOL[dayIdx % REVIEW_NOTE_POOL.length],
    satisfaction,
    task_total: taskDone + habitDoneCount,
    action_total: actionCount,
    total_score: fulfillment,
    task_ratio: 0.6,
    action_ratio: 0.4,
    balance_factor: 0.9,
    fulfillment,
    updated_at: now,
  });
});

// ================================================================
// 投入処理
// ================================================================

async function run() {
  console.log(`\n📅 対象期間 : ${DAYS[0]} 〜 ${DAYS[6]}`);
  console.log(`👤 ユーザーID: ${userId}\n`);

  // 既存データを全削除
  for (const table of ["task_entries", "action_entries", "daily_logs", "notification_settings", "tasks", "actions"]) {
    const { error } = await supabase.from(table).delete().eq("user_id", userId);
    if (error) console.warn(`  ⚠ ${table} 削除エラー:`, error.message);
    else console.log(`  🗑  ${table} クリア済み`);
  }
  console.log("");

  const inserts: [string, any[], number][] = [
    ["tasks", allTasks, allTasks.length],
    ["actions", actions, actions.length],
    ["task_entries", taskEntries, taskEntries.length],
    ["action_entries", actionEntries, actionEntries.length],
    ["daily_logs", dailyLogs, dailyLogs.length],
  ];

  for (const [table, data, count] of inserts) {
    const { error } = await supabase.from(table).insert(data);
    if (error) console.error(`  ❌ ${table}:`, error.message);
    else console.log(`  ✅ ${table}: ${count} 件 挿入`);
  }

  console.log("\n✅ 完了!\n");
  console.log("── データ内容 ──────────────────────────────────");
  console.log(`  習慣      : ${habits.length} 件（毎日 1〜3 件 done）`);
  console.log(`  タスク    : ${completableTasks.length + 2} 件`);
  console.log(`    ├ 完了  : ${completableTasks.length} 件（6日前〜前日に各 2件ずつ消化）`);
  console.log(`    └ 未実施: 2 件（指定日に残存）`);
  console.log(`              └ 1 件は翌日 ${tomorrow} が期限`);
  console.log(`  行動ログ  : ${actionEntries.length} 件（7日分、各日 1〜3 件）`);
  console.log(`  振り返り  : ${dailyLogs.length} 件（充実度 65〜95）`);
  console.log("────────────────────────────────────────────────\n");
}

run().catch(console.error);
