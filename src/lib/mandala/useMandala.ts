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
  | { type: "habit"; title: string; frequency: Frequency }
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
  options: { refreshKey?: unknown; reloadTasks: () => Promise<void>; onAfterWrite?: () => unknown }
) {
  const { refreshKey, reloadTasks, onAfterWrite } = options;
  const [chart, setChart] = useState<MandalaChart | null>(null);
  const [cells, setCells] = useState<MandalaCell[]>([]);
  const [doneByTask, setDoneByTask] = useState<Map<string, Set<string>>>(new Map());
  const [reviews, setReviews] = useState<MandalaReview[]>([]);
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
    setDoneByTask(doneDaysByTask(await sqliteRepo.getTaskEntriesBetween(userId, period.from, period.to)));
    setLoaded(true);
  }, [userId, period]);

  useEffect(() => {
    load().catch((e) => console.warn("[mandala] load failed:", e));
  }, [load, refreshKey]);

  const model: ChartModel | null = useMemo(() => (chart ? buildChartModel(chart, cells) : null), [chart, cells]);
  const byCell = useMemo(() => tasksByCell(tasks), [tasks]);

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

  const createChart = useCallback(async (draft: ChartDraft) => {
    if (!userId) return;
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
  }, [userId, addEvent, afterWrite]);

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
    const isHabit = input.type === "habit";
    const task: Task = {
      id: "", user_id: userId, title: input.title.trim(), task_type: input.type,
      due_date: input.type === "oneoff" ? input.dueDate : null,
      is_active: true, is_hidden: false, priority: 3, volume: 5,
      frequency_kind: isHabit ? input.frequency.kind : "daily",
      frequency_count: isHabit && input.frequency.kind === "weekly_count" ? input.frequency.count : null,
      frequency_days: isHabit && input.frequency.kind === "weekdays" ? input.frequency.days : null,
      frequency_history: [],
      mandala_cell_id: cell.id,
      mandala_linked_at: todayJST(),
    };
    await sqliteRepo.createTask(task);
    await addEvent(
      cell.id, "linked",
      isHabit ? `習慣「${task.title}」（${frequencyLabel(input.frequency)}）を作った` : `タスク「${task.title}」を作った`,
      task.id
    );
    await reloadTasks();
    await afterWrite();
  }, [userId, addEvent, reloadTasks, afterWrite]);

  /** 登録済みの習慣・タスクをマスにひもづける(ほかのマスからは付け替え) */
  const linkTask = useCallback(async (task: Task, cell: MandalaCell) => {
    if (!userId) return;
    const kind = task.task_type === "habit" ? "習慣" : "タスク";
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
    const kind = task.task_type === "habit" ? "習慣" : "タスク";
    await addEvent(task.mandala_cell_id, "unlinked", `${kind}「${task.title}」のひもづけを外した`, task.id);
    await sqliteRepo.updateTask(userId, task.id, { mandala_cell_id: null, mandala_linked_at: null });
    await reloadTasks();
    await afterWrite();
  }, [userId, addEvent, reloadTasks, afterWrite]);

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
        const habits = active.filter((t) => t.task_type === "habit");
        await endTasks(habits);
        const newText = d.newText.trim() || cell.text;
        if (newText !== cell.text) await sqliteRepo.upsertCell({ ...cell, text: newText });
        let note = `見直し：やり方を変えた。「${cell.text}」→「${newText}」`;
        if (habits.length) note += `。習慣「${habits.map((t) => t.title).join("」「")}」を終了`;
        let newTaskId: string | null = null;
        if (d.newHabit && d.newHabit.title.trim()) {
          const task: Task = {
            id: "", user_id: userId, title: d.newHabit.title.trim(), task_type: "habit", due_date: null,
            is_active: true, is_hidden: false, priority: 3, volume: 5,
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

  return {
    loaded, model, byCell, doneByTask, period, reviews,
    reload: load,
    createChart, updateChart, setElementName, setActionText,
    createTaskForCell, linkTask, unlinkTask, getEvents,
    saveReview, resumeCell,
  };
}

export type MandalaState = ReturnType<typeof useMandala>;
