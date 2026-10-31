/**
 * 目標タブ(マンダラチャート)のデータの読み込みと保存。
 * 習慣・タスク自体は App の tasks(loadBase)で持ち、ここではマスとのひもづけだけを扱う。
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { sqliteRepo } from "../db/instance";
import { todayJST } from "../day";
import type { MandalaCell, MandalaCellEvent, MandalaCellEventKind, MandalaChart, MandalaReview, Task } from "../types";
import { buildChartModel, ELEMENT_COLORS, tasksByCell, type ChartModel } from "./chart";
import { addDays } from "./dates";
import { changeFrequencyPatch, currentFrequency, frequencyLabel, type Frequency } from "./frequency";
import { doneDaysByTask, isCounted, type Period } from "./progress";
import { buildSnapshot, describeDecision, type ReviewDecision } from "./review";
import type { TaskState } from "../taskState";
import { saveRuleAnswer, saveTaskState } from "../taskEntries";
import { isRepeating, KIND_LABEL, type RuleAnswer } from "../taskKind";

/** チャートの作成で入力する内容(作成の3ステップ) */
export type ChartDraft = {
  title: string;
  endDate: string | null;
  /** 要素の名前(8つ) */
  elements: string[];
  /** 要素ごとの行動目標(8×8) */
  actions: string[][];
};

export type NewTaskForCell =
  | { type: "habit" | "rule"; title: string; frequency: Frequency }
  | { type: "oneoff"; title: string; dueDate: string | null };

export function emptyDraft(): ChartDraft {
  return {
    title: "",
    endDate: null,
    elements: Array(8).fill(""),
    actions: Array.from({ length: 8 }, () => Array(8).fill("")),
  };
}

export function useMandala(
  userId: string | null,
  tasks: Task[],
  options: {
    refreshKey?: unknown;
    reloadTasks: () => Promise<void>;
    onAfterWrite?: () => unknown;
    /** どこかの日に完了したタスク(タスクの状態を出すため) */
    doneAnyDay?: Set<string>;
    /** 対応中のタスク(id → 対応中にした日) */
    doingSince?: Map<string, string>;
    /** 完了・対応中を変えたあとに、記録タブの完了状態を読み直す */
    reloadEntries?: () => Promise<void>;
  }
) {
  const { refreshKey, reloadTasks, onAfterWrite, doneAnyDay, doingSince, reloadEntries } = options;
  const [chart, setChart] = useState<MandalaChart | null>(null);
  const [cells, setCells] = useState<MandalaCell[]>([]);
  const [doneByTask, setDoneByTask] = useState<Map<string, Set<string>>>(new Map());
  // マイルールで、今日 × をつけたもの(○ は doneByTask)
  const [missedToday, setMissedToday] = useState<Set<string>>(new Set());
  const [reviews, setReviews] = useState<MandalaReview[]>([]);
  const [pastCharts, setPastCharts] = useState<MandalaChart[]>([]);
  const [loaded, setLoaded] = useState(false);

  // 進み具合は「直近7日(今日を含む)」で数える
  const today = todayJST();
  const period: Period = useMemo(() => ({ from: addDays(today, -6), to: today }), [today]);

  const load = useCallback(async () => {
    if (!userId) return;
    const c = await sqliteRepo.getActiveChart(userId);
    setChart(c);
    setCells(c ? await sqliteRepo.getCells(userId, c.id) : []);
    setReviews(c ? await sqliteRepo.getReviews(userId, c.id) : []);
    setPastCharts(await sqliteRepo.getFinishedCharts(userId));
    const entries = await sqliteRepo.getTaskEntriesBetween(userId, period.from, period.to);
    setDoneByTask(doneDaysByTask(entries));
    setMissedToday(new Set(entries.filter((e) => e.status === "missed" && e.day === period.to).map((e) => e.task_id)));
    setLoaded(true);
  }, [userId, period]);

  useEffect(() => {
    load().catch((e) => console.warn("[mandala] load failed:", e));
  }, [load, refreshKey]);

  const model: ChartModel | null = useMemo(() => (chart ? buildChartModel(chart, cells) : null), [chart, cells]);
  const byCell = useMemo(() => tasksByCell(tasks), [tasks]);

  /** タスクの状態(未完了 / 対応中 / 完了)。完了はどこかの日に完了したもの */
  const taskStateOf = useCallback((taskId: string): TaskState => {
    if (doneAnyDay?.has(taskId)) return "done";
    return doingSince?.has(taskId) ? "doing" : "todo";
  }, [doneAnyDay, doingSince]);

  const afterWrite = useCallback(async () => {
    await load();
    onAfterWrite?.();
  }, [load, onAfterWrite]);

  const addEvent = useCallback(async (cellId: string, kind: MandalaCellEventKind, note: string, taskId: string | null = null) => {
    if (!userId) return;
    await sqliteRepo.addCellEvent({ user_id: userId, cell_id: cellId, kind, note, task_id: taskId });
  }, [userId]);

  /** マスを作る・書き換える(行は id で上書き)。作ったマスを返す */
  const saveCell = useCallback(async (chartId: string, elementIndex: number, cellIndex: number | null, text: string): Promise<MandalaCell | null> => {
    if (!userId) return null;
    const existing = cells.find((c) => c.chart_id === chartId && c.element_index === elementIndex && c.cell_index === cellIndex);
    if (!existing && !text.trim()) return null;
    if (existing && existing.text === text) return existing;
    const cell: MandalaCell = existing
      ? { ...existing, text }
      : {
        id: "", user_id: userId, chart_id: chartId, element_index: elementIndex, cell_index: cellIndex,
        text, color: cellIndex === null ? ELEMENT_COLORS[elementIndex] : null, status: "active", paused_periods: [],
      };
    await sqliteRepo.upsertCell(cell);
    // 変更の履歴は行動目標のマスだけ残す
    if (cellIndex !== null) {
      if (!existing || !existing.text.trim()) await addEvent(cell.id, "created", `「${text}」を書いた`);
      else await addEvent(cell.id, "edited", `「${existing.text}」→「${text}」に書き換えた`);
    }
    return cell;
  }, [userId, cells, addEvent]);

  /** 今のチャートと進み具合(直近7日)を、履歴に残す */
  const addSnapshotRecord = useCallback(async (kind: "save" | "final", note: string) => {
    if (!userId || !model) return;
    const snapshot = { ...buildSnapshot(model, byCell, doneByTask, period), kind };
    await sqliteRepo.createReview({
      user_id: userId, chart_id: model.chart.id, reviewed_at: new Date().toISOString(),
      good_note: note.trim() || null, next_note: null,
      decisions: [], snapshot: snapshot as unknown as Record<string, unknown>,
    });
  }, [userId, model, byCell, doneByTask, period]);

  /** 履歴の画面から、今の状態を保存する */
  const saveCurrentState = useCallback(async (note: string) => {
    await addSnapshotRecord("save", note);
    await afterWrite();
  }, [addSnapshotRecord, afterWrite]);

  /**
   * 今のチャートを終える(過去のチャートとして残す)。save なら、終える前の状態を履歴に残す。
   * ひもづいた習慣・タスクは消さずに、ひもづけだけ外す(新しいチャートで改めてひもづける)
   */
  const finishCurrentChart = useCallback(async (save: boolean) => {
    if (!userId || !chart) return;
    if (save) await addSnapshotRecord("final", "");
    const cellIds = new Set(cells.map((c) => c.id));
    for (const t of tasks.filter((t) => t.mandala_cell_id && cellIds.has(t.mandala_cell_id))) {
      await addEvent(t.mandala_cell_id!, "unlinked", `チャートを終えたので、${KIND_LABEL[t.task_type]}「${t.title}」のひもづけを外した`, t.id);
      await sqliteRepo.updateTask(userId, t.id, { mandala_cell_id: null, mandala_linked_at: null });
    }
    await sqliteRepo.upsertChart({ ...chart, status: "finished" });
    await reloadTasks();
  }, [userId, chart, cells, tasks, addEvent, reloadTasks, addSnapshotRecord]);

  /** チャートを作る。今のチャートがあれば、終えてから作る(saveCurrent なら、終える前の状態を履歴に残す) */
  const createChart = useCallback(async (draft: ChartDraft, options: { saveCurrent?: boolean } = {}) => {
    if (!userId) return;
    await finishCurrentChart(!!options.saveCurrent);
    const newChart: MandalaChart = {
      id: "", user_id: userId, title: draft.title.trim(), start_date: todayJST(),
      end_date: draft.endDate || null, status: "active",
    };
    await sqliteRepo.upsertChart(newChart);
    for (let e = 0; e < 8; e++) {
      const name = draft.elements[e].trim();
      if (!name) continue;
      await sqliteRepo.upsertCell({
        id: "", user_id: userId, chart_id: newChart.id, element_index: e, cell_index: null,
        text: name, color: ELEMENT_COLORS[e], status: "active", paused_periods: [],
      });
      for (let a = 0; a < 8; a++) {
        const text = draft.actions[e][a].trim();
        if (!text) continue;
        const cell: MandalaCell = {
          id: "", user_id: userId, chart_id: newChart.id, element_index: e, cell_index: a,
          text, color: null, status: "active", paused_periods: [],
        };
        await sqliteRepo.upsertCell(cell);
        await addEvent(cell.id, "created", `「${text}」を書いた`);
      }
    }
    await afterWrite();
  }, [userId, addEvent, afterWrite, finishCurrentChart]);

  const updateChart = useCallback(async (patch: Partial<Pick<MandalaChart, "title" | "end_date">>) => {
    if (!chart) return;
    await sqliteRepo.upsertChart({ ...chart, ...patch });
    await afterWrite();
  }, [chart, afterWrite]);

  const setElementName = useCallback(async (elementIndex: number, name: string) => {
    if (!chart) return;
    await saveCell(chart.id, elementIndex, null, name.trim());
    await afterWrite();
  }, [chart, saveCell, afterWrite]);

  const setActionText = useCallback(async (elementIndex: number, cellIndex: number, text: string) => {
    if (!chart) return;
    await saveCell(chart.id, elementIndex, cellIndex, text.trim());
    await afterWrite();
  }, [chart, saveCell, afterWrite]);

  /** マスから習慣・タスクを作る(作った日にひもづける) */
  const createTaskForCell = useCallback(async (cell: MandalaCell, input: NewTaskForCell) => {
    if (!userId) return;
    const freq = input.type === "oneoff" ? null : input.frequency;
    const task: Task = {
      id: "", user_id: userId, title: input.title.trim(), task_type: input.type,
      due_date: input.type === "oneoff" ? input.dueDate : null,
      is_active: true, is_hidden: false, priority: 0, volume: 0,
      frequency_kind: freq ? freq.kind : "daily",
      frequency_count: freq?.kind === "weekly_count" ? freq.count : null,
      frequency_days: freq?.kind === "weekdays" ? freq.days : null,
      frequency_history: [],
      mandala_cell_id: cell.id,
      mandala_linked_at: todayJST(),
    };
    await sqliteRepo.createTask(task);
    await addEvent(
      cell.id, "linked",
      freq ? `${KIND_LABEL[input.type]}「${task.title}」（${frequencyLabel(freq)}）を作った` : `タスク「${task.title}」を作った`,
      task.id
    );
    await reloadTasks();
    await afterWrite();
  }, [userId, addEvent, reloadTasks, afterWrite]);

  /** 登録済みの習慣・タスクをマスにひもづける(ほかのマスからは付け替え) */
  const linkTask = useCallback(async (task: Task, cell: MandalaCell) => {
    if (!userId) return;
    const kind = KIND_LABEL[task.task_type];
    if (task.mandala_cell_id && task.mandala_cell_id !== cell.id) {
      await addEvent(task.mandala_cell_id, "unlinked", `${kind}「${task.title}」を別のマスへ付け替えた`, task.id);
    }
    await sqliteRepo.updateTask(userId, task.id, { mandala_cell_id: cell.id, mandala_linked_at: todayJST() });
    await addEvent(cell.id, "linked", `${kind}「${task.title}」をひもづけた`, task.id);
    await reloadTasks();
    await afterWrite();
  }, [userId, addEvent, reloadTasks, afterWrite]);

  const unlinkTask = useCallback(async (task: Task) => {
    if (!userId || !task.mandala_cell_id) return;
    const kind = KIND_LABEL[task.task_type];
    await addEvent(task.mandala_cell_id, "unlinked", `${kind}「${task.title}」のひもづけを外した`, task.id);
    await sqliteRepo.updateTask(userId, task.id, { mandala_cell_id: null, mandala_linked_at: null });
    await reloadTasks();
    await afterWrite();
  }, [userId, addEvent, reloadTasks, afterWrite]);

  /** 目標タブから、今日の分の完了・対応中を変える(記録タブでチェックするのと同じ) */
  const setTaskStateToday = useCallback(async (task: Task, next: TaskState) => {
    if (!userId) return;
    await saveTaskState(userId, task, todayJST(), next);
    await reloadEntries?.();
    await afterWrite();
  }, [userId, reloadEntries, afterWrite]);

  /** 目標タブから、マイルールの今日の ○ / × を変える(記録タブでつけるのと同じ) */
  const setRuleAnswerToday = useCallback(async (task: Task, answer: RuleAnswer) => {
    if (!userId) return;
    await saveRuleAnswer(userId, task.id, todayJST(), answer);
    await reloadEntries?.();
    await afterWrite();
  }, [userId, reloadEntries, afterWrite]);

  /** 習慣・タスクの側から選べる行動目標(要素ごと)。文言のある、休止中でないマス */
  const goalOptions: GoalOptionGroup[] = useMemo(() => {
    if (!model) return [];
    return model.elements
      .filter((el) => el.name)
      .map((el) => ({
        element: el.name,
        color: el.color,
        cells: el.actions
          .filter((c): c is MandalaCell => !!c && !!c.text && c.status !== "paused")
          .map((c) => ({ id: c.id, text: c.text, achieved: c.status === "achieved" })),
      }))
      .filter((g) => g.cells.length > 0);
  }, [model]);

  /** 習慣・タスクの側から、ひもづける行動目標を変える(null で外す) */
  const setTaskCell = useCallback(async (task: Task, cellId: string | null) => {
    if ((task.mandala_cell_id ?? null) === cellId) return;
    if (!cellId) return unlinkTask(task);
    const cell = model?.elements.flatMap((el) => el.actions).find((c) => c?.id === cellId);
    if (cell) await linkTask(task, cell);
  }, [model, linkTask, unlinkTask]);

  const getEvents = useCallback(async (cellId: string): Promise<MandalaCellEvent[]> => {
    if (!userId) return [];
    return sqliteRepo.getCellEvents(userId, cellId);
  }, [userId]);

  /**
   * 見直しを保存する。見直す前のチャート(snapshot)と決めたこと・メモを記録してから、
   * マスごとの次の手をチャート・習慣へ反映する。過去の記録(task_entries)は消さない。
   */
  const saveReview = useCallback(async (
    decisions: Map<string, ReviewDecision>,
    notes: { good: string; next: string }
  ) => {
    if (!userId || !model) return;
    const today = todayJST();
    const cellById = new Map<string, { cell: MandalaCell; elementName: string }>();
    for (const el of model.elements) for (const c of el.actions) if (c) cellById.set(c.id, { cell: c, elementName: el.name });

    const snapshot = buildSnapshot(model, byCell, doneByTask, period);
    const texts: string[] = [];
    for (const [cellId, d] of decisions) {
      const entry = cellById.get(cellId);
      if (entry && d.kind !== "keep") texts.push(describeDecision(entry.elementName, entry.cell.text, d, tasks));
    }
    await sqliteRepo.createReview({
      user_id: userId, chart_id: model.chart.id, reviewed_at: new Date().toISOString(),
      good_note: notes.good.trim() || null, next_note: notes.next.trim() || null,
      decisions: texts, snapshot: snapshot as unknown as Record<string, unknown>,
    });

    for (const [cellId, d] of decisions) {
      const entry = cellById.get(cellId);
      if (!entry || d.kind === "keep") continue;
      const { cell } = entry;
      const active = (byCell.get(cell.id) ?? []).filter(isCounted);
      const endTasks = async (list: Task[], unlink = false) => {
        for (const t of list) {
          await sqliteRepo.updateTask(userId, t.id, {
            ended_at: today, is_hidden: true, ...(unlink ? { mandala_cell_id: null } : {}),
          });
        }
      };

      if (d.kind === "lower") {
        const t = tasks.find((x) => x.id === d.taskId);
        if (!t) continue;
        const before = `${t.title}（${frequencyLabel(currentFrequency(t))}）`;
        await sqliteRepo.updateTask(userId, t.id, {
          title: d.title.trim() || t.title,
          ...(changeFrequencyPatch(t, d.frequency, today) ?? {}),
        });
        await addEvent(cell.id, "lowered", `見直し：ハードルを下げた。${before} → ${d.title.trim() || t.title}（${frequencyLabel(d.frequency)}）`, t.id);
      } else if (d.kind === "change") {
        // マイルールも習慣と同じく、くり返すものなので一緒に終える
        const habits = active.filter(isRepeating);
        await endTasks(habits);
        const newText = d.newText.trim() || cell.text;
        if (newText !== cell.text) await sqliteRepo.upsertCell({ ...cell, text: newText });
        let note = `見直し：やり方を変えた。「${cell.text}」→「${newText}」`;
        if (habits.length) note += `。習慣「${habits.map((t) => t.title).join("」「")}」を終了`;
        let newTaskId: string | null = null;
        if (d.newHabit && d.newHabit.title.trim()) {
          const task: Task = {
            id: "", user_id: userId, title: d.newHabit.title.trim(), task_type: "habit", due_date: null,
            is_active: true, is_hidden: false, priority: 0, volume: 0,
            frequency_kind: d.newHabit.frequency.kind,
            frequency_count: d.newHabit.frequency.kind === "weekly_count" ? d.newHabit.frequency.count : null,
            frequency_days: d.newHabit.frequency.kind === "weekdays" ? d.newHabit.frequency.days : null,
            frequency_history: [], mandala_cell_id: cell.id, mandala_linked_at: today,
          };
          await sqliteRepo.createTask(task);
          newTaskId = task.id;
          note += `、「${task.title}」（${frequencyLabel(d.newHabit.frequency)}）を開始`;
        }
        await addEvent(cell.id, "changed", note, newTaskId);
      } else if (d.kind === "pause") {
        const hidden = active.map((t) => t.id);
        for (const t of active) await sqliteRepo.updateTask(userId, t.id, { is_hidden: true });
        await sqliteRepo.upsertCell({
          ...cell, status: "paused",
          paused_periods: [...cell.paused_periods, { from: today, to: null, task_ids: hidden }],
        });
        await addEvent(cell.id, "paused", "見直し：いったん休む（習慣は記録タブに出なくなる）");
      } else if (d.kind === "achieve") {
        if (d.endHabits) await endTasks(active);
        await sqliteRepo.upsertCell({ ...cell, status: "achieved" });
        await addEvent(cell.id, "achieved", `見直し：達成にした（習慣は${d.endHabits ? "終了" : "続ける"}）`);
      } else if (d.kind === "remove") {
        await addEvent(cell.id, "removed", `見直し：「${cell.text}」を目標から外した（習慣は${d.endHabits ? "終了" : "記録タブに残す"}）`);
        if (d.endHabits) await endTasks(active, true);
        else for (const t of active) await sqliteRepo.updateTask(userId, t.id, { mandala_cell_id: null, mandala_linked_at: null });
        await sqliteRepo.upsertCell({ ...cell, text: "", status: "active" });
      }
    }
    await reloadTasks();
    await afterWrite();
  }, [userId, model, byCell, doneByTask, period, tasks, addEvent, reloadTasks, afterWrite]);

  /** 休止したマスを再開する。休止で外した習慣を戻し、今日から数える(決定 #17) */
  const resumeCell = useCallback(async (cell: MandalaCell) => {
    if (!userId) return;
    const yesterday = addDays(todayJST(), -1);
    const open = cell.paused_periods.find((p) => p.to === null);
    for (const id of open?.task_ids ?? []) {
      const t = tasks.find((x) => x.id === id);
      if (t && !t.ended_at && t.mandala_cell_id === cell.id) await sqliteRepo.updateTask(userId, id, { is_hidden: false });
    }
    await sqliteRepo.upsertCell({
      ...cell, status: "active",
      paused_periods: cell.paused_periods.map((p) => (p.to === null ? { ...p, to: yesterday } : p)),
    });
    await addEvent(cell.id, "resumed", "再開した");
    await reloadTasks();
    await afterWrite();
  }, [userId, tasks, addEvent, reloadTasks, afterWrite]);

  /**
   * マスを見直しを通さずに達成にする(習慣・タスクを作らずに済んだ行動目標もあるため)。
   * endHabits のときは、ひもづいた習慣を今日で終える。
   */
  const achieveCell = useCallback(async (cell: MandalaCell, endHabits: boolean) => {
    if (!userId) return;
    const habits = (byCell.get(cell.id) ?? []).filter((t) => isCounted(t) && isRepeating(t));
    if (endHabits) {
      for (const t of habits) await sqliteRepo.updateTask(userId, t.id, { ended_at: todayJST(), is_hidden: true });
    }
    await sqliteRepo.upsertCell({ ...cell, status: "achieved" });
    await addEvent(cell.id, "achieved", habits.length ? `達成にした（習慣は${endHabits ? "終了" : "続ける"}）` : "達成にした");
    await reloadTasks();
    await afterWrite();
  }, [userId, byCell, addEvent, reloadTasks, afterWrite]);

  /** 達成を取り消して、進み具合を数えるマスに戻す(終えた習慣は戻さない) */
  const unachieveCell = useCallback(async (cell: MandalaCell) => {
    if (!userId) return;
    await sqliteRepo.upsertCell({ ...cell, status: "active" });
    await addEvent(cell.id, "resumed", "達成を取り消した");
    await afterWrite();
  }, [userId, addEvent, afterWrite]);

  /** 過去のチャートの中身と履歴(見るだけ) */
  const loadPastChart = useCallback(async (c: MandalaChart): Promise<{ model: ChartModel; reviews: MandalaReview[] } | null> => {
    if (!userId) return null;
    const pastCells = await sqliteRepo.getCells(userId, c.id);
    const pastReviews = await sqliteRepo.getReviews(userId, c.id);
    return { model: buildChartModel(c, pastCells), reviews: pastReviews };
  }, [userId]);

  return {
    loaded, model, byCell, doneByTask, missedToday, period, reviews, pastCharts,
    reload: load,
    createChart, updateChart, saveCurrentState, loadPastChart, setElementName, setActionText,
    createTaskForCell, linkTask, unlinkTask, getEvents, goalOptions, setTaskCell,
    taskStateOf, doingSince: doingSince ?? new Map<string, string>(), setTaskStateToday, setRuleAnswerToday,
    saveReview, resumeCell, achieveCell, unachieveCell,
  };
}

export type MandalaState = ReturnType<typeof useMandala>;

export type GoalOptionGroup = {
  element: string;
  color: string;
  cells: { id: string; text: string; achieved: boolean }[];
};
/** 習慣・タスクの編集画面で、行動目標をひもづけるのに使う分だけ */
export type GoalLinkApi = Pick<MandalaState, "goalOptions" | "setTaskCell">;
