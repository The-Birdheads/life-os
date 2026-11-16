/**
 * 今のチャートを引き継いで新しく作るときの、下書きと引き継ぐマスの決め方(画面や保存に依存しない計算だけ)
 */
import type { MandalaCell } from "../types";
import type { ChartModel } from "./chart";
import type { ChartDraft } from "./useMandala";

/** 今のチャートの大目標・期限・要素・行動目標を入れた下書き(引き継いで新しく作るとき) */
export function draftFromModel(model: ChartModel): ChartDraft {
  return {
    title: model.chart.title,
    endDate: model.chart.end_date ?? null,
    elements: model.elements.map((el) => el.name),
    actions: model.elements.map((el) => el.actions.map((c) => c?.text ?? "")),
  };
}

/**
 * 引き継ぐ行動目標のマス: 下書きでも同じ場所に同じ文言が残っているマス(書き換えたマスは引き継がない)。
 * 返すのは「マスの場所 → 前のマス」
 */
export function carriedCells(model: ChartModel, draft: ChartDraft): Map<string, MandalaCell> {
  const map = new Map<string, MandalaCell>();
  for (const el of model.elements) {
    el.actions.forEach((c, a) => {
      const text = c?.text.trim();
      if (c && text && draft.actions[el.index][a].trim() === text) map.set(`${el.index}-${a}`, c);
    });
  }
  return map;
}
