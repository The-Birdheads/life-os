/**
 * 目標タブ(マンダラチャート)のデータの読み込みと保存。
 * 習慣・タスク自体は App の tasks(loadBase)で持ち、ここではマスとのひもづけだけを扱う。
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { sqliteRepo } from "../db/instance";
import { todayJST } from "../day";
import type { MandalaCell, MandalaCellEvent, MandalaCellEventKind, MandalaChart, Task } from "../types";
import { buildChartModel, ELEMENT_COLORS, tasksByCell, type ChartModel } from "./chart";
import { addDays } from "./dates";
import { frequencyLabel, type Frequency } from "./frequency";
import { doneDaysByTask, type Period } from "./progress";

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
  const [loaded, setLoaded] = useState(false);

  // 進み具合は「直近7日(今日を含む)」で数える
  const today = todayJST();
  const period: Period = useMemo(() => ({ from: addDays(today, -6), to: today }), [today]);

  const load = useCallback(async () => {
    if (!userId) return;
    const c = await sqliteRepo.getActiveChart(userId);
    setChart(c);
    setCells(c ? await sqliteRepo.getCells(userId, c.id) : []);
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

  return {
    loaded, model, byCell, doneByTask, period,
    reload: load,
    createChart, updateChart, setElementName, setActionText,
    createTaskForCell, linkTask, unlinkTask, getEvents,
  };
}

export type MandalaState = ReturnType<typeof useMandala>;
