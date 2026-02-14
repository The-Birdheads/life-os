import type { Action, Task } from "../types";

type Result = {
  tasks: Task[];
  actions: Action[];
};

export async function fetchBase(params: {
  supabase: any;
  userId: string;
}): Promise<Result> {
  const { supabase, userId } = params;

  const { data: tasks, error: tErr } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .order("due_date", { ascending: true, nullsFirst: false });

  if (tErr) throw tErr;

  const { data: actions, error: aErr } = await supabase
    .from("actions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (aErr) throw aErr;

  return {
    tasks: (tasks ?? []) as any,
    actions: (actions ?? []) as any,
  };
}
