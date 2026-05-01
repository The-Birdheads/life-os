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
