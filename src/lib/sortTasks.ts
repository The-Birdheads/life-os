import type { Task } from "./types";

export type SortRule = "priority" | "volume_desc" | "volume_asc";

function compareBase(a: Task, b: Task, rule: SortRule): number {
    if (rule === "priority") {
        if (a.priority !== b.priority) return b.priority - a.priority;
        if (a.volume   !== b.volume)   return b.volume   - a.volume;   // ボリューム降順
    } else if (rule === "volume_desc") {
        if (a.volume   !== b.volume)   return b.volume   - a.volume;
        if (a.priority !== b.priority) return b.priority - a.priority;
    } else if (rule === "volume_asc") {
        if (a.volume   !== b.volume)   return a.volume   - b.volume;   // ボリューム昇順
        if (a.priority !== b.priority) return b.priority - a.priority;
    }
    // 作成日降順の代替として ID 降順（UUID は完全な時系列ではないが最良の代替）
    return b.id.localeCompare(a.id);
}

/**
 * タスク・習慣を指定ルールでソートして新しい配列を返す。
 *
 * @param tasks      ソート対象
 * @param rule       ソートルール
 * @param prioritizeDue  期限付きタスクを優先（oneoff のみ有効）
 * @param doneSet    完了済み ID セット（渡すと 未完了→完了済 を最上位に）
 */
export function sortTasks(
    tasks: Task[],
    rule: SortRule,
    prioritizeDue: boolean,
    doneSet?: Set<string>
): Task[] {
    return [...tasks].sort((a, b) => {
        // 1. 未完了 → 完了済（doneSet が渡された場合）
        if (doneSet) {
            const ac = doneSet.has(a.id) ? 1 : 0;
            const bc = doneSet.has(b.id) ? 1 : 0;
            if (ac !== bc) return ac - bc;
        }

        // 2. 期限付きタスク優先（oneoff かつ prioritizeDue ON のみ）
        if (prioritizeDue && a.task_type === "oneoff" && b.task_type === "oneoff") {
            const aHas = !!a.due_date;
            const bHas = !!b.due_date;
            if (aHas !== bHas) return aHas ? -1 : 1;
            if (aHas && bHas) {
                const cmp = a.due_date!.localeCompare(b.due_date!);
                if (cmp !== 0) return cmp;
            }
        }

        // 3. メインルール
        return compareBase(a, b, rule);
    });
}
