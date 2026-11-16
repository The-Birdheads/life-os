/**
 * 見直し(docs/mandala-chart.md 4-9, 4-10)。
 * - 見直しの記録(snapshot): 見直す前のチャートと、当時までの回数。保存後は変えない
 * - 次の手(decision): マスごとに選ぶ。保存したときに、まとめてチャート・習慣へ反映する
 */
import type { MandalaCell, MandalaReview, Task } from "../types";
import { type ChartModel } from "./chart";
import { currentFrequency, frequencyLabel, type Frequency } from "./frequency";
import { isCounted, type Period } from "./progress";
import { actionTally, elementTally, taskTally } from "./tally";

/**
 * 回数(count)は、チャートを始めた日から保存した日までの、やった回数。
 * 回数を数えるようになる前(1.4.0 の途中まで)の記録には、直近7日の割合(rate)だけが入っている
 */
export type SnapshotTask = { title: string; type: Task["task_type"]; frequency: string | null; count?: number; rate?: number | null };
export type SnapshotCell = { index: number; text: string; status: MandalaCell["status"]; count?: number; rate?: number | null; tasks: SnapshotTask[] };
export type SnapshotElement = { index: number; name: string; color: string; count?: number; rate?: number | null; cells: SnapshotCell[] };
export type ReviewSnapshot = {
  title: string;
  period: Period;
  elements: SnapshotElement[];
  /** 見直し以外の記録の種類(無ければ見直し) */
  kind?: "save" | "final";
};

/**
 * 履歴の記録の種類。見直し・手動の保存・チャートを終えたときの保存。
 * どれも mandala_reviews に残し、保存の記録は snapshot.kind で見分ける(メモは good_note)
 */
export type RecordKind = "review" | "save" | "final";

export const RECORD_LABELS: Record<RecordKind, string> = {
  review: "見直し",
  save: "保存",
  final: "終えたときの保存",
};

export function recordKind(record: Pick<MandalaReview, "snapshot">): RecordKind {
  const kind = (record.snapshot as { kind?: unknown } | null)?.kind;
  return kind === "save" || kind === "final" ? kind : "review";
}

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
      count: elementTally(el, byCell, doneByTask, period)?.count ?? 0,
      cells: el.actions.flatMap((c, a) => {
        if (!c || !c.text.trim()) return [];
        const tasks = (byCell.get(c.id) ?? []).filter(isCounted);
        return [{
          index: a,
          text: c.text,
          status: c.status,
          count: actionTally(c, byCell, doneByTask, period)?.count ?? 0,
          tasks: tasks.map((t) => ({
            title: t.title,
            type: t.task_type,
            frequency: t.task_type !== "oneoff" ? frequencyLabel(currentFrequency(t)) : null,
            count: taskTally(doneByTask.get(t.id), period, c.paused_periods).count,
          })),
        }];
      }),
    })),
  };
}

/** 回数を数えるようになってからの記録か */
export function hasCounts(snap: ReviewSnapshot): boolean {
  return snap.elements.some((e) => typeof e.count === "number");
}

/**
 * 回数を数える前に保存した記録(割合だけのもの)に、回数を入れ直す。
 * その時点までの完了の記録から数える。マスにひもづいていた習慣・タスクは、マスの変更の履歴(linkedIdsByCell)から集める
 * (チャートを終えると、ひもづけは外れているため)。数えた期間は、チャートを始めた日から保存した日まで
 */
export function recountSnapshot(
  snap: ReviewSnapshot,
  model: ChartModel,
  linkedIdsByCell: Map<string, Set<string>>,
  doneByTask: Map<string, Set<string>>,
  tasks: Pick<Task, "id" | "title">[],
  /** 回数が入っていても数え直す(回数を保存せずに終えたチャートを、記録から数えるとき) */
  force = false
): ReviewSnapshot {
  if (!force && hasCounts(snap)) return snap;
  const period = { from: model.chart.start_date && model.chart.start_date <= snap.period.to ? model.chart.start_date : snap.period.to, to: snap.period.to };
  const titleOf = new Map(tasks.map((t) => [t.id, t.title]));
  return {
    ...snap,
    period,
    elements: snap.elements.map((el) => {
      const cells = el.cells.map((c) => {
        const cell = model.elements[el.index]?.actions[c.index] ?? null;
        const ids = cell ? [...(linkedIdsByCell.get(cell.id) ?? [])] : [];
        const per = ids.map((id) => ({ id, count: taskTally(doneByTask.get(id), period, cell?.paused_periods).count }));
        return {
          ...c,
          count: per.reduce((a, b) => a + b.count, 0),
          tasks: c.tasks.map((t) => ({ ...t, count: per.filter((x) => titleOf.get(x.id) === t.title).reduce((a, b) => a + b.count, 0) })),
        };
      });
      return { ...el, count: cells.reduce((a, c) => a + c.count, 0), cells };
    }),
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
  /** 達成にする: マスに「達成」の印を付ける。習慣は続けるか終えるかを選ぶ */
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
