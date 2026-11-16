/**
 * 目標の進みを数えるための、完了の記録のまとめ方(回数の数え方は tally.ts)。
 * 保存はせず、完了の記録(task_entries)から毎回計算する。
 */
import type { PausedPeriod, Task, TaskEntry } from "../types";
import { daysBetween, weekStart } from "./dates";
import { frequencyAt } from "./frequency";

export type Period = { from: string; to: string };

/** 完了の記録を、習慣・タスクごとの完了日の集合にする */
export function doneDaysByTask(entries: Pick<TaskEntry, "task_id" | "day" | "status">[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const e of entries) {
    if (e.status !== "done") continue;
    let set = map.get(e.task_id);
    if (!set) map.set(e.task_id, (set = new Set()));
    set.add(e.day);
  }
  return map;
}

export function isPausedOn(day: string, periods: PausedPeriod[] | undefined): boolean {
  return (periods ?? []).some((p) => p.from <= day && (p.to === null || day <= p.to));
}

/** 今も続けている習慣・タスクか(終了・非表示にしたものは除く。回数は、終えたものも数える) */
export function isCounted(task: Pick<Task, "ended_at" | "is_hidden">): boolean {
  return !task.ended_at && !task.is_hidden;
}

/** 今週(月曜〜今日)の、週n回の習慣の回数 */
export function weekCountStatus(
  task: Pick<Task, "frequency_kind" | "frequency_count" | "frequency_days" | "frequency_history">,
  doneDays: Set<string> | undefined,
  today: string
): { done: number; target: number } {
  const freq = frequencyAt(task, today);
  const done = daysBetween(weekStart(today), today).filter((d) => doneDays?.has(d)).length;
  return { done, target: freq.kind === "weekly_count" ? freq.count ?? 1 : 0 };
}
