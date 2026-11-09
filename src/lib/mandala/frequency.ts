/**
 * 習慣の頻度(毎日 / 週n回 / 曜日指定)。
 * 頻度を変えたときは、変える前の頻度を frequency_history に残し、その期間は前の頻度で数える
 * (docs/mandala-chart.md 決定 #15)。
 */
import type { FrequencyKind, FrequencySegment, Task } from "../types";
import { addDays, weekdayIndex } from "./dates";

export type Frequency = { kind: FrequencyKind; count: number | null; days: number | null };

export const WEEKDAY_NAMES = ["月", "火", "水", "木", "金", "土", "日"] as const;

/** 曜日のビット(月=1, 火=2, … 日=64) */
export function dayBit(weekday: number): number {
  return 1 << weekday;
}

export function currentFrequency(task: Pick<Task, "frequency_kind" | "frequency_count" | "frequency_days">): Frequency {
  return {
    kind: task.frequency_kind ?? "daily",
    count: task.frequency_count ?? null,
    days: task.frequency_days ?? null,
  };
}

/** その日に有効だった頻度(履歴の期間内なら、変える前の頻度) */
export function frequencyAt(
  task: Pick<Task, "frequency_kind" | "frequency_count" | "frequency_days" | "frequency_history">,
  day: string
): Frequency {
  for (const seg of task.frequency_history ?? []) {
    if ((seg.from === null || seg.from <= day) && day <= seg.to) {
      return { kind: seg.kind, count: seg.count, days: seg.days };
    }
  }
  return currentFrequency(task);
}

/** その日が予定の日か。週n回は、どの日でも行ってよいので予定の日として扱う */
export function isScheduledOn(freq: Frequency, day: string): boolean {
  if (freq.kind !== "weekdays") return true;
  return ((freq.days ?? 0) & dayBit(weekdayIndex(day))) !== 0;
}

export function frequencyLabel(freq: Frequency): string {
  if (freq.kind === "weekly_count") return `週${freq.count ?? 1}回`;
  if (freq.kind === "weekdays") {
    const names = WEEKDAY_NAMES.filter((_, i) => ((freq.days ?? 0) & dayBit(i)) !== 0);
    return names.length ? names.join("・") : "曜日未選択";
  }
  return "毎日";
}

export function isValidFrequency(freq: Frequency): boolean {
  if (freq.kind === "weekly_count") return !!freq.count && freq.count >= 1 && freq.count <= 6;
  if (freq.kind === "weekdays") return !!freq.days && freq.days >= 1 && freq.days <= 127;
  return true;
}

function sameFrequency(a: Frequency, b: Frequency): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "weekly_count") return a.count === b.count;
  if (a.kind === "weekdays") return a.days === b.days;
  return true;
}

/**
 * 頻度を変えるときの、tasks への変更。今の頻度は「昨日まで」として履歴に残し、今日から新しい頻度で数える。
 * - 頻度が同じなら null(変更なし)
 * - 今の頻度が今日始まったもの(今日2回目の変更)なら、履歴は増やさず今の頻度だけ置き換える
 */
export function changeFrequencyPatch(
  task: Pick<Task, "frequency_kind" | "frequency_count" | "frequency_days" | "frequency_history">,
  next: Frequency,
  today: string
): Pick<Task, "frequency_kind" | "frequency_count" | "frequency_days" | "frequency_history"> | null {
  const current = currentFrequency(task);
  if (sameFrequency(current, next)) return null;
  const history = [...(task.frequency_history ?? [])];
  const last = history[history.length - 1];
  const currentFrom = last ? addDays(last.to, 1) : null;
  const yesterday = addDays(today, -1);
  if (currentFrom === null || currentFrom <= yesterday) {
    const seg: FrequencySegment = { from: currentFrom, to: yesterday, ...current };
    history.push(seg);
  }
  return {
    frequency_kind: next.kind,
    frequency_count: next.kind === "weekly_count" ? next.count : null,
    frequency_days: next.kind === "weekdays" ? next.days : null,
    frequency_history: history,
  };
}
