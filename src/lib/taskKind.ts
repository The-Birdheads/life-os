import type { Task } from "./types";

/** 種類の呼び名 */
export const KIND_LABEL: Record<Task["task_type"], string> = {
    habit: "習慣",
    oneoff: "タスク",
    rule: "マイルール",
};

/** 頻度を持って、くり返すものか(習慣・マイルール)。タスクは1回きり */
export function isRepeating(task: Pick<Task, "task_type">): boolean {
    return task.task_type !== "oneoff";
}

/** マイルールの答え。○=done / ×=missed / 答えていない=null */
export type RuleAnswer = "done" | "missed" | null;
