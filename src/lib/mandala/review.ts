/**
 * 見直し(docs/mandala-chart.md 4-9, 4-10)。
 * - 見直しの記録(snapshot): 見直す前のチャートと、当時の進み具合。保存後は変えない
 * - 次の手(decision): マスごとに選ぶ。保存したときに、まとめてチャート・習慣へ反映する
 */
import type { MandalaCell, Task } from "../types";
import { actionRate, elementRate, type ChartModel } from "./chart";
import { currentFrequency, frequencyLabel, type Frequency } from "./frequency";
import { isCounted, taskProgress, type Period } from "./progress";

export type SnapshotTask = { title: string; type: Task["task_type"]; frequency: string | null; rate: number | null };
export type SnapshotCell = { index: number; text: string; status: MandalaCell["status"]; rate: number | null; tasks: SnapshotTask[] };
export type SnapshotElement = { index: number; name: string; color: string; rate: number | null; cells: SnapshotCell[] };
export type ReviewSnapshot = { title: string; period: Period; elements: SnapshotElement[] };

export function buildSnapshot(
  model: ChartModel,
  byCell: Map<string, Task[]>,
  doneByTask: Map<string, Set<string>>,
  period: Period
): ReviewSnapshot {
  return {
    title: model.chart.title,
    period,
    elements: model.elements.map((el) => ({
      index: el.index,
      name: el.name,
      color: el.color,
      rate: el.name ? elementRate(el, byCell, doneByTask, period) : null,
      cells: el.actions.flatMap((c, a) => {
        if (!c || !c.text.trim()) return [];
        const tasks = (byCell.get(c.id) ?? []).filter(isCounted);
        return [{
          index: a,
          text: c.text,
          status: c.status,
          rate: actionRate(c, byCell, doneByTask, period),
          tasks: tasks.map((t) => ({
            title: t.title,
            type: t.task_type,
            frequency: t.task_type === "habit" ? frequencyLabel(currentFrequency(t)) : null,
            rate: taskProgress(t, doneByTask.get(t.id), period, c.paused_periods).rate,
          })),
        }];
      }),
    })),
  };
}

/** 保存済みの snapshot(JSON)を読む。形が違えば null */
export function parseSnapshot(raw: unknown): ReviewSnapshot | null {
  const s = raw as ReviewSnapshot | null;
  return s && Array.isArray(s.elements) ? s : null;
}

export type ReviewDecision =
  | { kind: "keep" }
  /** ハードルを下げる: 同じ習慣のタイトル・頻度を直す(記録はつながったまま) */
  | { kind: "lower"; taskId: string; title: string; frequency: Frequency }
  /** やり方を変える: 今の習慣を終了し、マスの文言を直して、新しい習慣を作る(今日から数える) */
  | { kind: "change"; newText: string; newHabit: { title: string; frequency: Frequency } | null }
  /** いったん休む: マスを休止し、習慣を記録タブから外す(休止中の日は数えない) */
  | { kind: "pause" }
  /** 達成にする: マスは 100%。習慣は続けるか終えるかを選ぶ */
  | { kind: "achieve"; endHabits: boolean }
  /** 目標から外す: マスを空にする。習慣は残すか終えるかを選ぶ */
  | { kind: "remove"; endHabits: boolean };

export const DECISION_LABELS: Record<ReviewDecision["kind"], string> = {
  keep: "続ける",
  lower: "ハードルを下げる",
  change: "やり方を変える",
  pause: "いったん休む",
  achieve: "達成にする",
  remove: "目標から外す",
};

/** 見直しの記録に残す、決めたことの文言 */
export function describeDecision(
  elementName: string,
  cellText: string,
  decision: ReviewDecision,
  tasks: Task[]
): string {
  const head = `${elementName} › ${cellText}：${DECISION_LABELS[decision.kind]}`;
  switch (decision.kind) {
    case "lower": {
      const t = tasks.find((x) => x.id === decision.taskId);
      const before = t ? `${t.title}（${frequencyLabel(currentFrequency(t))}）` : "";
      return `${head}（${before} → ${decision.title}（${frequencyLabel(decision.frequency)}））`;
    }
    case "change": {
      const parts = [];
      if (decision.newText.trim() && decision.newText.trim() !== cellText) parts.push(`「${decision.newText.trim()}」に変更`);
      if (decision.newHabit) parts.push(`習慣「${decision.newHabit.title}」（${frequencyLabel(decision.newHabit.frequency)}）を開始`);
      return parts.length ? `${head}（${parts.join("、")}）` : head;
    }
    case "achieve":
      return `${head}（習慣は${decision.endHabits ? "終了" : "続ける"}）`;
    case "remove":
      return `${head}（習慣は${decision.endHabits ? "終了" : "記録タブに残す"}）`;
    default:
      return head;
  }
}
