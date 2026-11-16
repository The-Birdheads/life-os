/**
 * その日に、チャートのどこをどれだけ進めたか(振り返りタブの「目標の進み」とウィジェットに使う)。
 * 回数は目標タブと同じく「チャートを始めた日から、その日まで」で数え、
 * その日の完了を入れる前と入れた後を比べる(差がその日の回数)。
 */
import type { MandalaCell, Task } from "../types";
import { type ChartModel } from "./chart";
import { type Period } from "./progress";
import { cellTally, chartPeriod, mergeTallies } from "./tally";

export type CellStep = {
  element: number;
  /** 行動目標の番号(0〜7) */
  index: number;
  cell: MandalaCell;
  /** その日の前までの回数 */
  before: number;
  /** その日までの回数 */
  after: number;
  /** その日に完了した、ひもづいた習慣・タスク */
  doneTasks: Task[];
  /** その日に、マスを直接達成にした */
  achieved: boolean;
};

/** 要素ごとの前後の回数。名前の無い要素は null */
export type ElementStep = { index: number; before: number | null; after: number | null };

export type DayProgress = {
  day: string;
  period: Period;
  /** 要素ごとの前後(8つ、番号順) */
  elements: ElementStep[];
  /** 進めた行動目標(チャートの並び順) */
  cells: CellStep[];
};

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
 * achievedOn: その日に直接達成にしたマスの id
 */
export function dayProgress(
  model: ChartModel,
  byCell: Map<string, Task[]>,
  doneByTask: Map<string, Set<string>>,
  day: string,
  achievedOn: Set<string> = new Set()
): DayProgress {
  const period = chartPeriod(day, model.chart.start_date);
  const before = withoutDay(doneByTask, day);
  const elements: ElementStep[] = [];
  const cells: CellStep[] = [];

  for (const el of model.elements) {
    const pairs = el.actions.map((c, a) => {
      const linked = c ? byCell.get(c.id) ?? [] : [];
      const b = cellTally(c, linked, before, period);
      const n = cellTally(c, linked, doneByTask, period);
      if (!c || !b || !n) return null;
      const achieved = achievedOn.has(c.id) && c.status === "achieved";
      const doneTasks = linked.filter((t) => doneByTask.get(t.id)?.has(day));
      if (el.name && c.status !== "paused" && (n.count > b.count || achieved)) {
        cells.push({ element: el.index, index: a, cell: c, before: b.count, after: n.count, doneTasks, achieved });
      }
      return { before: b, after: n };
    }).filter((p) => p !== null);
    elements.push({
      index: el.index,
      before: el.name ? mergeTallies(pairs.map((p) => p.before)).count : null,
      after: el.name ? mergeTallies(pairs.map((p) => p.after)).count : null,
    });
  }
  return { day, period, elements, cells };
}

/** その日に増えた回数 */
export function gain(step: { before: number | null; after: number | null }): number {
  return (step.after ?? 0) - (step.before ?? 0);
}
