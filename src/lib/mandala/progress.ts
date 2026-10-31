/**
 * 進み具合の計算(docs/mandala-chart.md 4-6)。保存はせず、完了の記録(task_entries)から毎回計算する。
 *
 * - 数えるのは、表示中の期間のうち、マスにひもづけた日以降だけ(決定 #5)。ただし、ひもづける前の日でも完了を記録した日は数える
 * - 頻度はその日に有効だった頻度で数える(決定 #15)
 * - 予定のない曜日の完了は数えない(決定 #16)
 * - マスを休止していた日は数えない(決定 #17)
 */
import type { MandalaCell, PausedPeriod, Task, TaskEntry } from "../types";
import { daysBetween, maxDay, minDay, weekStart } from "./dates";
import { frequencyAt, isScheduledOn } from "./frequency";

export type Period = { from: string; to: string };

export type Progress = {
  /** 数えた完了の回数 */
  done: number;
  /** 期間内の目標の回数(週n回は日割りのため小数になることがある) */
  target: number;
  /** 0〜100。目標が無い(数える日が無い)ときは null */
  rate: number | null;
};

const EMPTY: Progress = { done: 0, target: 0, rate: null };

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

function toRate(credit: number, target: number): number | null {
  return target > 0 ? Math.round((credit / target) * 100) : null;
}

/**
 * 習慣の進み具合。
 * countFrom: これより前の日は数えない(マスにひもづけた日)。paused: 数えない期間(マスの休止)
 */
export function habitProgress(
  task: Pick<Task, "frequency_kind" | "frequency_count" | "frequency_days" | "frequency_history" | "ended_at">,
  doneDays: Set<string> | undefined,
  period: Period,
  options: { countFrom?: string | null; paused?: PausedPeriod[] } = {}
): Progress {
  const start = period.from;
  const end = minDay(period.to, task.ended_at);
  if (!end || start > end) return EMPTY;

  const done = doneDays ?? new Set<string>();
  const countFrom = maxDay(period.from, options.countFrom);
  let target = 0;
  let credit = 0;
  let doneCount = 0;
  // 週n回は週ごとに、目標を日割りで積み、目標を超えた分は数えない
  const weeks = new Map<string, { target: number; done: number }>();

  for (const day of daysBetween(start, end)) {
    // ひもづけた日より前は、完了を記録した日だけ数える(深夜に作って前日分を付けたときなど)
    if (countFrom && day < countFrom && !done.has(day)) continue;
    if (isPausedOn(day, options.paused)) continue;
    const freq = frequencyAt(task, day);
    if (freq.kind === "weekly_count") {
      const key = weekStart(day);
      const w = weeks.get(key) ?? { target: 0, done: 0 };
      w.target += (freq.count ?? 1) / 7;
      if (done.has(day)) w.done += 1;
      weeks.set(key, w);
    } else if (isScheduledOn(freq, day)) {
      target += 1;
      if (done.has(day)) {
        credit += 1;
        doneCount += 1;
      }
    }
  }
  for (const w of weeks.values()) {
    target += w.target;
    credit += Math.min(w.done, w.target);
    doneCount += w.done;
  }
  return { done: doneCount, target: Math.round(target * 10) / 10, rate: toRate(credit, target) };
}

/** タスク(単発)の進み具合。完了していれば 100%、していなければ 0% */
export function oneoffProgress(doneDays: Set<string> | undefined): Progress {
  const done = (doneDays?.size ?? 0) > 0;
  return { done: done ? 1 : 0, target: 1, rate: done ? 100 : 0 };
}

/** 進み具合に数える習慣・タスクか(終了・非表示・削除したものは数えない) */
export function isCounted(task: Pick<Task, "ended_at" | "is_hidden">): boolean {
  return !task.ended_at && !task.is_hidden;
}

export function taskProgress(
  task: Task,
  doneDays: Set<string> | undefined,
  period: Period,
  paused?: PausedPeriod[]
): Progress {
  if (task.task_type === "oneoff") return oneoffProgress(doneDays);
  return habitProgress(task, doneDays, period, { countFrom: task.mandala_linked_at, paused });
}

export function average(rates: (number | null)[]): number | null {
  const valid = rates.filter((r): r is number => r !== null);
  return valid.length ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : null;
}

/**
 * 行動目標のマスの進み具合。
 * 空のマス・休止中のマスは null(平均に入れない)、達成のマスは 100、それ以外はひもづいた習慣・タスクの平均
 */
export function cellRate(
  cell: Pick<MandalaCell, "text" | "status" | "paused_periods">,
  linkedTasks: Task[],
  doneByTask: Map<string, Set<string>>,
  period: Period
): number | null {
  if (!cell.text.trim() || cell.status === "paused") return null;
  if (cell.status === "achieved") return 100;
  return average(
    linkedTasks.filter(isCounted).map((t) => taskProgress(t, doneByTask.get(t.id), period, cell.paused_periods).rate)
  );
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
