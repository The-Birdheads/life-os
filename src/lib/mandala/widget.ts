/**
 * ホーム画面ウィジェットに渡すチャート(小・中: 中心の3×3、大: 全体の9×9)。
 * 回数は目標タブと同じ「チャートを始めた日から」。Swift 側で読めるよう、数字だけの形にする
 */
import type { Task } from "../types";
import { type ChartModel } from "./chart";
import { dayProgress } from "./dayProgress";
import type { Period } from "./progress";
import { actionTally, countLevel, elementTally } from "./tally";

export type WidgetMandalaCell = {
  /** 行動目標の文言(空きは "") */
  text: string;
  /** 色の段階。-1=空き・休止中、0=まだ、1〜3=回数の段階(tally.countLevel) */
  level: number;
};

export type WidgetMandalaElement = {
  name: string;
  color: string;
  /** チャートを始めてからの回数 */
  count: number;
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
      const count = elementTally(el, byCell, doneByTask, period)?.count ?? 0;
      return {
        name: el.name,
        color: el.color,
        count,
        level: el.name ? countLevel(count) : -1,
        cells: el.actions.map((c) => {
          if (!c || !c.text.trim() || c.status === "paused") return { text: c?.text ?? "", level: -1 };
          return { text: c.text, level: countLevel(actionTally(c, byCell, doneByTask, period)?.count ?? 0, c.status === "achieved") };
        }),
      };
    }),
    todayCount: dayProgress(model, byCell, doneByTask, period.to).cells.length,
  };
}
