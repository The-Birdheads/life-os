/**
 * タスク(単発)の状態: 未完了 / 対応中 / 完了。
 * 対応中は task_entries の status = 'doing'(対応中にした日の記録)で持つ。
 * 完了したタスクの「対応中にした日」は、着手した日の記録として残す。
 */
export type TaskState = "todo" | "doing" | "done";

/**
 * 記録タブに出すタスクの状態。
 * @param doneToday   選択中の日に完了したか
 * @param doneAnyDay  どこかの日に完了しているか
 * @param doing       対応中にした記録があるか
 */
export function oneoffState(doneToday: boolean, doneAnyDay: boolean, doing: boolean): TaskState {
    if (doneToday) return "done";
    if (doing && !doneAnyDay) return "doing";
    return "todo";
}

/** タップ: 未完了・対応中 → 完了、完了 → 未完了 */
export function nextOnTap(state: TaskState): TaskState {
    return state === "done" ? "todo" : "done";
}

/** 長押し: 対応中 → 未完了、それ以外 → 対応中 */
export function nextOnLongPress(state: TaskState): TaskState {
    return state === "doing" ? "todo" : "doing";
}

/** 対応中の記録から、タスクごとの「対応中にした日」(いちばん早い日) */
export function doingSinceByTask(entries: { task_id: string; day: string }[]): Map<string, string> {
    const map = new Map<string, string>();
    for (const e of entries) {
        const cur = map.get(e.task_id);
        if (!cur || e.day < cur) map.set(e.task_id, e.day);
    }
    return map;
}

export const TASK_STATE_LABELS: Record<TaskState, string> = {
    todo: "未完了",
    doing: "対応中",
    done: "完了",
};
