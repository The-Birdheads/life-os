import { sqliteRepo } from "./db/instance";
import type { Task } from "./types";
import type { TaskState } from "./taskState";
import type { RuleAnswer } from "./taskKind";

/** マイルールの、その日の ○ / × を保存する(null で答える前に戻す) */
export async function saveRuleAnswer(userId: string, taskId: string, day: string, answer: RuleAnswer): Promise<void> {
    await sqliteRepo.upsertTaskEntry({ user_id: userId, day, task_id: taskId, status: answer ?? "todo" } as any);
}

/**
 * 習慣・タスクの状態を保存する(記録タブ・目標タブで共通)。
 * - 習慣: その日の完了 / 未完了だけを変える(ほかの日の記録は残す)
 * - タスク: 1回きりなので、未完了に戻すときはほかの日の完了・対応中も未完了に戻す。
 *   対応中にするときは、完了の記録を外してから対応中にする
 */
export async function saveTaskState(
    userId: string,
    task: Pick<Task, "id" | "task_type">,
    day: string,
    next: TaskState
): Promise<void> {
    const upsert = (status: TaskState) =>
        sqliteRepo.upsertTaskEntry({ user_id: userId, day, task_id: task.id, status } as any);
    if (task.task_type !== "oneoff") {
        await upsert(next === "done" ? "done" : "todo");
        return;
    }
    if (next === "done") {
        await upsert("done");
    } else if (next === "doing") {
        await sqliteRepo.resetTaskEntries(userId, task.id, ["done"]);
        await upsert("doing");
    } else {
        await upsert("todo");
        await sqliteRepo.resetTaskEntries(userId, task.id, ["done", "doing"]);
    }
}
