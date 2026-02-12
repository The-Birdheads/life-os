export type Task = {
  id: string;
  user_id: string;
  title: string;
  task_type: "habit" | "oneoff";
  due_date: string | null;
  must_score: number;
  want_score: number;
  is_active: boolean;
};

export type Action = {
  id: string;
  user_id: string;
  title: string;
  category: string;
  want_score: number;
  must_score: number;
  is_active: boolean;
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
