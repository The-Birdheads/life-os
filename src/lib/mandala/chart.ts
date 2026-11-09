/**
 * マンダラチャートの並び(3×3)と、表示用のモデル。
 * 要素・行動目標は 0〜7 の番号で持ち、3×3 では中心(位置4)のまわりに並べる。
 */
import type { MandalaCell, MandalaChart, Task } from "../types";
import { average, cellRate, type Period } from "./progress";

/** 要素の色(番号順)。白い文字を載せても読める濃さにしている */
export const ELEMENT_COLORS = ["#1D4ED8", "#C2410C", "#0F766E", "#6D28D9", "#BE185D", "#A16207", "#15803D", "#475569"] as const;

/** 3×3 の位置(0〜8)のうち、中心(4)以外。番号 i の要素・行動目標は AROUND[i] の位置に置く */
export const AROUND = [0, 1, 2, 3, 5, 6, 7, 8] as const;

/** 3×3 の位置 → 要素・行動目標の番号。中心は null */
export function indexAtPosition(pos: number): number | null {
  const i = AROUND.indexOf(pos as (typeof AROUND)[number]);
  return i === -1 ? null : i;
}

export type ElementModel = {
  index: number;
  /** 要素のマス(未作成なら null) */
  cell: MandalaCell | null;
  name: string;
  color: string;
  /** 行動目標のマス(番号順、未作成なら null) */
  actions: (MandalaCell | null)[];
};

export type ChartModel = {
  chart: MandalaChart;
  elements: ElementModel[];
};

export function buildChartModel(chart: MandalaChart, cells: MandalaCell[]): ChartModel {
  const elements: ElementModel[] = [];
  for (let e = 0; e < 8; e++) {
    const elementCell = cells.find((c) => c.element_index === e && c.cell_index === null) ?? null;
    const actions: (MandalaCell | null)[] = [];
    for (let a = 0; a < 8; a++) {
      actions.push(cells.find((c) => c.element_index === e && c.cell_index === a) ?? null);
    }
    elements.push({
      index: e,
      cell: elementCell,
      name: elementCell?.text ?? "",
      color: elementCell?.color ?? ELEMENT_COLORS[e],
      actions,
    });
  }
  return { chart, elements };
}

/** 名前のある要素の番号 */
export function namedElements(model: ChartModel): number[] {
  return model.elements.filter((el) => el.name.trim()).map((el) => el.index);
}

/** マス → ひもづいた習慣・タスク(削除済みは含まない。終了・非表示は含む) */
export function tasksByCell(tasks: Task[]): Map<string, Task[]> {
  const map = new Map<string, Task[]>();
  for (const t of tasks) {
    if (!t.mandala_cell_id) continue;
    const list = map.get(t.mandala_cell_id) ?? [];
    list.push(t);
    map.set(t.mandala_cell_id, list);
  }
  return map;
}

export function actionRate(
  cell: MandalaCell | null,
  byCell: Map<string, Task[]>,
  doneByTask: Map<string, Set<string>>,
  period: Period
): number | null {
  if (!cell) return null;
  return cellRate(cell, byCell.get(cell.id) ?? [], doneByTask, period);
}

export function elementRate(
  element: ElementModel,
  byCell: Map<string, Task[]>,
  doneByTask: Map<string, Set<string>>,
  period: Period
): number | null {
  return average(element.actions.map((c) => actionRate(c, byCell, doneByTask, period)));
}

/** 進み具合の4段階(0=未着手, 1=〜30%, 2=〜70%, 3=70%〜) */
export function rateLevel(rate: number | null): 0 | 1 | 2 | 3 {
  if (rate === null) return 0;
  if (rate < 30) return 1;
  if (rate < 70) return 2;
  return 3;
}

/** 進み具合の色(背景・文字・枠)。色だけに頼らないよう、画面では % も出す */
export function rateTint(color: string, rate: number | null): { bg: string; fg: string; border: string } {
  switch (rateLevel(rate)) {
    case 0: return { bg: "#E2E8F0", fg: "#334155", border: "#CBD5E1" };
    case 1: return { bg: `${color}1F`, fg: "#0F172A", border: `${color}59` };
    case 2: return { bg: `${color}66`, fg: "#0F172A", border: color };
    default: return { bg: color, fg: "#FFFFFF", border: color };
  }
}

export function rateText(rate: number | null): string {
  return rate === null ? "未着手" : `${rate}%`;
}
