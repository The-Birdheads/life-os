/** 習慣の頻度。daily=毎日 / weekly_count=週n回 / weekdays=曜日指定 */
export type FrequencyKind = "daily" | "weekly_count" | "weekdays";

/** 変える前の頻度。from〜to(YYYY-MM-DD、両端を含む)の期間は、この頻度で数える */
export type FrequencySegment = {
  from: string | null;
  to: string;
  kind: FrequencyKind;
  count: number | null;
  days: number | null;
};

export type Task = {
  id: string;
  user_id: string;
  title: string;
  task_type: "habit" | "oneoff";
  due_date: string | null;
  is_active: boolean;
  is_hidden: boolean;
  priority: number;
  volume: number;
  memo?: string | null;
  remind_on?: boolean;
  remind_hour?: number;
  remind_minute?: number;
  /** 習慣の頻度(タスクでは daily のまま) */
  frequency_kind?: FrequencyKind;
  /** 週n回の n(1〜6) */
  frequency_count?: number | null;
  /** 曜日指定(ビット: 月=1, 火=2, 水=4, 木=8, 金=16, 土=32, 日=64) */
  frequency_days?: number | null;
  /** 変える前の頻度の履歴(古い順) */
  frequency_history?: FrequencySegment[];
  /** ひもづいたマンダラチャートのマス(行動目標) */
  mandala_cell_id?: string | null;
  /** マスにひもづけた日(YYYY-MM-DD)。この日より前は、マスの進み具合に数えない */
  mandala_linked_at?: string | null;
  /** 見直しなどで終了した日(YYYY-MM-DD)。終了した習慣も記録は残す */
  ended_at?: string | null;
};

export type MandalaChartStatus = "active" | "finished";

export type MandalaChart = {
  id: string;
  user_id: string;
  /** 大目標 */
  title: string;
  start_date: string | null;
  /** 期限(任意) */
  end_date: string | null;
  status: MandalaChartStatus;
  created_at?: string;
  updated_at?: string;
};

export type MandalaCellStatus = "active" | "paused" | "achieved";

export type PausedPeriod = { from: string; to: string | null };

export type MandalaCell = {
  id: string;
  user_id: string;
  chart_id: string;
  /** 要素の位置 0〜7 */
  element_index: number;
  /** null = 要素のマス / 0〜7 = 行動目標のマス */
  cell_index: number | null;
  text: string;
  /** 要素の色(要素のマスだけ) */
  color: string | null;
  status: MandalaCellStatus;
  /** 休止した期間。この期間は進み具合に数えない */
  paused_periods: PausedPeriod[];
  created_at?: string;
  updated_at?: string;
};

export type MandalaCellEventKind =
  | "created" | "edited" | "linked" | "unlinked" | "lowered" | "changed"
  | "paused" | "resumed" | "achieved" | "removed";

export type MandalaCellEvent = {
  id: string;
  user_id: string;
  cell_id: string;
  kind: MandalaCellEventKind;
  note: string;
  task_id: string | null;
  created_at: string;
};

export type MandalaReview = {
  id: string;
  user_id: string;
  chart_id: string;
  reviewed_at: string;
  good_note: string | null;
  next_note: string | null;
  /** 決めたこと(表示用の文言) */
  decisions: string[];
  /** 見直す前のチャートと、当時の進み具合(src/lib/mandala の ReviewSnapshot) */
  snapshot: Record<string, unknown>;
  created_at?: string;
};

export type Action = {
  id: string;
  user_id: string;
  category: string;
  kind: string;
  is_active: boolean;
  is_hidden: boolean;
  created_at: string;
};

export type TaskEntry = {
  id: string;
  user_id: string;
  day: string; // YYYY-MM-DD
  task_id: string;
  status: "todo" | "doing" | "done";
};

export type ActionEntry = {
  id: string;
  user_id: string;
  day: string;
  action_id: string;
  note: string | null;     // 詳細
  volume: number | null;   // 1-10
  created_at: string;
};

export type DailyLog = {
  id: string;
  user_id: string;
  day: string;
  note: string | null;
  satisfaction: number | null;

  task_total: number;
  action_total: number;
  total_score: number;
  task_ratio: number;
  action_ratio: number;
  balance_factor: number;
  fulfillment: number;

  /** 翌日への目標（任意） */
  tomorrow_note: string | null;
  /** 前日の目標の達成度: "done" | "partial" | "failed" | null */
  yesterday_achievement: string | null;
};

export type NotificationSettings = {
  id: string; // Primary key e.g. "settings_" + user_id
  user_id: string;
  habit_remind_on: boolean;
  habit_remind_hour: number;
  habit_remind_minute: number;
  task_remind_on: boolean;
  task_remind_hour: number;
  task_remind_minute: number;
  task_remind_timing: string; // JSON array of numbers e.g. "[1,2,3]"
  review_remind_on: boolean;
  review_remind_hour: number;
  review_remind_minute: number;
  volume_unit: string; // '15' | '30' | '60' | 'none'
  sort_rule: string; // 'priority' | 'volume_desc' | 'volume_asc'
  prioritize_due: boolean;
  updated_at: string;
};
