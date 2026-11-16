/**
 * 目標の進み(docs/mandala-chart.md)を「やった回数」で数える。
 * 予定と比べた割合(％)は出さない。休んでも減らず、やった分だけ増える。
 *
 * - 数えるのは、チャートを始めた日から今日まで(新しく作り直したら、そこから数え直す)
 * - 習慣・タスクの完了、マイルールの ○ を、それぞれ1回と数える(同じ日に2つやれば2回)
 * - マスを休止していた日は数えない
 * - 終えた・非表示にした習慣も、ひもづいたままなら、それまでの回数を数える(やった分は消さない)
 */
import type { MandalaCell, PausedPeriod, Task } from "../types";
import type { ElementModel } from "./chart";
import { addDays, daysBetween, weekStart } from "./dates";
import { isPausedOn, type Period } from "./progress";

export type Tally = {
  /** 完了の回数 */
  count: number;
  /** 完了した日(足あと用) */
  days: Set<string>;
  /** 最後にやった日 */
  last: string | null;
};

const empty = (): Tally => ({ count: 0, days: new Set(), last: null });

/** 1つの習慣・タスクの、期間内の完了(休止中の日は除く) */
export function taskTally(doneDays: Set<string> | undefined, period: Period, paused?: PausedPeriod[]): Tally {
  const t = empty();
  for (const d of doneDays ?? []) {
    if (d < period.from || d > period.to || isPausedOn(d, paused)) continue;
    t.count += 1;
    t.days.add(d);
    if (!t.last || d > t.last) t.last = d;
  }
  return t;
}

/** 回数は足し、日はまとめる */
export function mergeTallies(list: Tally[]): Tally {
  const t = empty();
  for (const x of list) {
    t.count += x.count;
    for (const d of x.days) t.days.add(d);
    if (x.last && (!t.last || x.last > t.last)) t.last = x.last;
  }
  return t;
}

/** 行動目標のマスの回数。空のマスは null */
export function cellTally(
  cell: Pick<MandalaCell, "text" | "paused_periods"> | null,
  linkedTasks: Task[],
  doneByTask: Map<string, Set<string>>,
  period: Period
): Tally | null {
  if (!cell || !cell.text.trim()) return null;
  return mergeTallies(linkedTasks.map((t) => taskTally(doneByTask.get(t.id), period, cell.paused_periods)));
}

export function actionTally(
  cell: MandalaCell | null,
  byCell: Map<string, Task[]>,
  doneByTask: Map<string, Set<string>>,
  period: Period
): Tally | null {
  return cell ? cellTally(cell, byCell.get(cell.id) ?? [], doneByTask, period) : null;
}

/** 要素の回数(行動目標の回数の合計)。名前の無い要素は null */
export function elementTally(
  element: ElementModel,
  byCell: Map<string, Task[]>,
  doneByTask: Map<string, Set<string>>,
  period: Period
): Tally | null {
  if (!element.name.trim()) return null;
  return mergeTallies(
    element.actions.map((c) => actionTally(c, byCell, doneByTask, period)).filter((t): t is Tally => t !== null)
  );
}

/**
 * 色の段階(0=まだ, 1=1回〜, 2=10回〜, 3=30回〜)。回数が増えるほど濃くなり、休んでも薄くならない。
 * 節目は、習慣の履歴の節目(10・30回…)とそろえている。達成にしたマスはいちばん濃くする
 */
export const LEVEL_STEPS = [1, 10, 30] as const;

export function countLevel(count: number, achieved = false): 0 | 1 | 2 | 3 {
  if (achieved || count >= LEVEL_STEPS[2]) return 3;
  if (count >= LEVEL_STEPS[1]) return 2;
  if (count >= LEVEL_STEPS[0]) return 1;
  return 0;
}

/** 段階の色(背景・文字・枠) */
export function levelTint(color: string, level: 0 | 1 | 2 | 3): { bg: string; fg: string; border: string } {
  switch (level) {
    case 0: return { bg: "#E2E8F0", fg: "#334155", border: "#CBD5E1" };
    case 1: return { bg: `${color}1F`, fg: "#0F172A", border: `${color}59` };
    case 2: return { bg: `${color}66`, fg: "#0F172A", border: color };
    default: return { bg: color, fg: "#FFFFFF", border: color };
  }
}

export function countText(count: number): string {
  return count > 0 ? `${count}回` : "まだ";
}

/** その日を含む週(月〜日)の日付 */
export function weekDays(today: string): string[] {
  const from = weekStart(today);
  return daysBetween(from, addDays(from, 6));
}

/** 今週やった日の数 */
export function weekDoneDays(t: Tally | null, today: string): number {
  if (!t) return 0;
  return weekDays(today).filter((d) => d <= today && t.days.has(d)).length;
}

/** 最後にやった日を「今日 / 昨日 / ◯日前」で */
export function lastDoneText(last: string | null, today: string): string {
  if (!last) return "まだ";
  const n = daysBetween(last, today).length - 1;
  if (n <= 0) return "今日";
  if (n === 1) return "昨日";
  return `${n}日前`;
}

/** チャートを始めた日から、その日までの期間 */
export function chartPeriod(day: string, startDate: string | null | undefined): Period {
  return { from: startDate && startDate <= day ? startDate : day, to: day };
}
