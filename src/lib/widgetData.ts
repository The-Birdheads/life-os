import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import type { Task } from "./types";
import { todayJST } from "./day";
import { frequencyAt, isScheduledOn } from "./mandala/frequency";
import type { WidgetMandala } from "./mandala/widget";
import { sortTasks, type SortRule } from "./sortTasks";

const WIDGET_DATA_KEY    = "widget_data";
const WIDGET_PENDING_KEY = "widget_pending";

function daysDiff(from: string, to: string): number {
  const d1 = new Date(from + "T00:00:00+09:00");
  const d2 = new Date(to   + "T00:00:00+09:00");
  return Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

export async function syncWidgetData(
  tasks: Task[],
  doneHabitIds: Set<string>,
  doneTaskIdsAnyDay: Set<string>,
  mandala: WidgetMandala | null = null,
  sortRule: SortRule = "manual"
): Promise<void> {
  if (Capacitor.getPlatform() !== "ios") return;
  try {
    const today = todayJST();

    // 習慣: 今日予定のあるもの(曜日指定)を、記録タブと同じ順に
    const scheduled = tasks.filter(
      (t) => t.task_type === "habit" && !t.is_hidden && t.is_active && !t.ended_at && isScheduledOn(frequencyAt(t, today), today)
    );
    const habits = sortTasks(scheduled, sortRule, false)
      .slice(0, 12)
      .map((t) => ({
        id: t.id,
        title: t.title,
        done: doneHabitIds.has(t.id),
        priority: t.priority,
      }));

    // 未完了のタスク（完了済・非表示・非アクティブを除く）を、記録タブと同じ順に
    const openTasks = tasks.filter((t) => t.task_type === "oneoff" && !t.is_hidden && t.is_active && !doneTaskIdsAnyDay.has(t.id));
    const upcomingTasks = sortTasks(openTasks, sortRule, false)
      .slice(0, 12)
      .map((t) => ({
        id: t.id,
        title: t.title,
        daysUntilDue: t.due_date ? daysDiff(today, t.due_date) : 9999,
        priority: t.priority,
        done: false,
      }));

    const payload = {
      today,
      updatedAt: new Date().toISOString(),
      habits,
      // 件数は、一覧に入りきらない分も数える
      habitsDone: scheduled.filter((t) => doneHabitIds.has(t.id)).length,
      habitsTotal: scheduled.length,
      tasks: upcomingTasks,
      tasksOverdue: openTasks.filter((t) => t.due_date && daysDiff(today, t.due_date) < 0).length,
      // チャートが無いときは送らない(ウィジェットは「チャートを作る」案内を出す)
      ...(mandala ? { mandala } : {}),
    };

    await Preferences.set({ key: WIDGET_DATA_KEY, value: JSON.stringify(payload) });
  } catch (e) {
    console.warn("[Widget] syncWidgetData error:", e);
  }
}

export async function processPendingCompletions(): Promise<string[]> {
  if (Capacitor.getPlatform() !== "ios") return [];
  try {
    const { value } = await Preferences.get({ key: WIDGET_PENDING_KEY });
    if (!value) return [];
    const ids: string[] = JSON.parse(value);
    if (ids.length > 0) {
      await Preferences.remove({ key: WIDGET_PENDING_KEY });
    }
    return ids;
  } catch (e) {
    console.warn("[Widget] processPendingCompletions error:", e);
    return [];
  }
}
