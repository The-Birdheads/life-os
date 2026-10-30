/**
 * その日に、チャートのどこをどれだけ進めたか(振り返りタブの演出に使う)。
 * 進み具合は目標タブと同じく「その日までの直近7日」で数え、その日の完了を入れる前と入れた後を比べる。
 */
import type { MandalaCell, Task } from "../types";
import { type ChartModel } from "./chart";
import { addDays } from "./dates";
import { average, cellRate, type Period } from "./progress";

export type CellStep = {
  element: number;
  /** 行動目標の番号(0〜7) */
  index: number;
  cell: MandalaCell;
  before: number | null;
  after: number | null;
  /** その日に完了した、ひもづいた習慣・タスク */
  doneTasks: Task[];
  /** その日に、マスを直接達成にした */
  achieved: boolean;
};

export type ElementStep = { index: number; before: number | null; after: number | null };

export type DayProgress = {
  day: string;
  period: Period;
  /** 要素ごとの前後(8つ、番号順) */
  elements: ElementStep[];
  /** 進めた行動目標(チャートの並び順) */
  cells: CellStep[];
};

/** その日までの直近7日 */
export function periodEndingOn(day: string): Period {
  return { from: addDays(day, -6), to: day };
}

/** その日の完了を除いた記録 */
function withoutDay(doneByTask: Map<string, Set<string>>, day: string): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const [id, days] of doneByTask) {
    const rest = new Set(days);
    rest.delete(day);
    out.set(id, rest);
  }
  return out;
}

/**
 * achievedOn: その日に直接達成にしたマスの id。達成の前は、ひもづいた習慣・タスクで数える
 */
export function dayProgress(
  model: ChartModel,
  byCell: Map<string, Task[]>,
  doneByTask: Map<string, Set<string>>,
  day: string,
  achievedOn: Set<string> = new Set()
): DayProgress {
  const period = periodEndingOn(day);
  const before = withoutDay(doneByTask, day);
  const elements: ElementStep[] = [];
  const cells: CellStep[] = [];

  for (const el of model.elements) {
    const pairs = el.actions.map((c, a) => {
      if (!c) return { before: null, after: null };
      const linked = byCell.get(c.id) ?? [];
      const achieved = achievedOn.has(c.id) && c.status === "achieved";
      const step = {
        before: cellRate(achieved ? { ...c, status: "active" } : c, linked, before, period),
        after: cellRate(c, linked, doneByTask, period),
      };
      const doneTasks = linked.filter((t) => doneByTask.get(t.id)?.has(day));
      if (el.name && c.text.trim() && c.status !== "paused" && (doneTasks.length > 0 || achieved)) {
        cells.push({ element: el.index, index: a, cell: c, ...step, doneTasks, achieved });
      }
      return step;
    });
    elements.push({
      index: el.index,
      before: el.name ? average(pairs.map((p) => p.before)) : null,
      after: el.name ? average(pairs.map((p) => p.after)) : null,
    });
  }
  return { day, period, elements, cells };
}

/** 進み具合の差(%)。未着手は 0 として数える */
export function gain(step: { before: number | null; after: number | null }): number {
  return (step.after ?? 0) - (step.before ?? 0);
}
