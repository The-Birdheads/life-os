/**
 * ホーム画面ウィジェットに渡すチャート(小・中: 中心の3×3、大: 全体の9×9)。
 * 進み具合は目標タブと同じ「直近7日」。Swift 側で読めるよう、数字だけの形にする
 */
import type { Task } from "../types";
import { actionRate, elementRate, rateLevel, type ChartModel } from "./chart";
import { dayProgress } from "./dayProgress";
import type { Period } from "./progress";

export type WidgetMandalaCell = {
  /** 行動目標の文言(空きは "") */
  text: string;
  /** 進み具合の段階。-1=空き・休止中、0=未着手、1〜3=進み具合(chart.rateLevel) */
  level: number;
};

export type WidgetMandalaElement = {
  name: string;
  color: string;
  /** 0〜100。未着手は -1 */
  rate: number;
  level: number;
  /** 行動目標(8つ、番号順) */
  cells: WidgetMandalaCell[];
};

export type WidgetMandala = {
  title: string;
  /** 要素(8つ、番号順。名前の無い要素は name が "") */
  elements: WidgetMandalaElement[];
  /** 今日進めた行動目標の数 */
  todayCount: number;
};

export function buildWidgetMandala(
  model: ChartModel,
  byCell: Map<string, Task[]>,
  doneByTask: Map<string, Set<string>>,
  period: Period
): WidgetMandala {
  return {
    title: model.chart.title,
    elements: model.elements.map((el) => {
      const rate = el.name ? elementRate(el, byCell, doneByTask, period) : null;
      return {
        name: el.name,
        color: el.color,
        rate: rate ?? -1,
        level: el.name ? rateLevel(rate) : -1,
        cells: el.actions.map((c) => {
          if (!c || !c.text.trim() || c.status === "paused") return { text: c?.text ?? "", level: -1 };
          return { text: c.text, level: rateLevel(actionRate(c, byCell, doneByTask, period)) };
        }),
      };
    }),
    todayCount: dayProgress(model, byCell, doneByTask, period.to).cells.length,
  };
}
