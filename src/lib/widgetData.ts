import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import type { Task } from "./types";
import { todayJST } from "./day";

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
  doneTaskIdsAnyDay: Set<string>
): Promise<void> {
  if (Capacitor.getPlatform() !== "ios") return;
  try {
    const today = todayJST();

    // 習慣: 優先度が高い順（数値が小さいほど高優先度）
    const habits = tasks
      .filter((t) => t.task_type === "habit" && !t.is_hidden && t.is_active)
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 10)
      .map((t) => ({
        id: t.id,
        title: t.title,
        done: doneHabitIds.has(t.id),
        priority: t.priority,
      }));

    // 全アクティブタスク（完了済・非表示・非アクティブを除く）を優先度順に
    const upcomingTasks = tasks
      .filter((t) => t.task_type === "oneoff" && !t.is_hidden && t.is_active && !doneTaskIdsAnyDay.has(t.id))
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 10)
      .map((t) => ({
        id: t.id,
        title: t.title,
        daysUntilDue: t.due_date ? daysDiff(today, t.due_date) : 9999,
        priority: t.priority,
      }));

    const payload = {
      today,
      updatedAt: new Date().toISOString(),
      habits,
      habitsDone: habits.filter((h) => h.done).length,
      habitsTotal: habits.length,
      tasks: upcomingTasks,
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
