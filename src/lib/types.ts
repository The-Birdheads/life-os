export type Task = {
  id: string;
  user_id: string;
  title: string;
  task_type: "habit" | "oneoff";
  due_date: string | null;
  is_active: boolean;
  priority: number;
  volume: number;
};

export type Action = {
  id: string;
  user_id: string;
  category: string;
  title: string;     // 互換で残してOK
  kind: string | null;
  is_active: boolean;
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
};
