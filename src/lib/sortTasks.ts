import type { Task } from "./types";

export type SortRule = "manual" | "priority" | "volume_desc" | "volume_asc";

// 優先度・ボリュームは任意(0 = 未設定)。未設定はどの並び順でも後ろに回す
const UNSET_LAST = Number.POSITIVE_INFINITY;
const level = (v: number | null | undefined) => (v && v > 0 ? v : 0);
const ascLevel = (v: number | null | undefined) => (v && v > 0 ? v : UNSET_LAST);

// 自分で並べた順。並べたことの無いもの(null)は、並べたものの下に優先度順で出る
const manualOrder = (t: Task) => (t.sort_order ?? UNSET_LAST);

function compareBase(a: Task, b: Task, rule: SortRule): number {
    if (rule === "manual") {
        const am = manualOrder(a), bm = manualOrder(b);
        if (am !== bm) return am < bm ? -1 : 1;
        return compareBase(a, b, "priority");
    }
    const ap = level(a.priority), bp = level(b.priority);
    const av = level(a.volume), bv = level(b.volume);
    if (rule === "priority") {
        if (ap !== bp) return bp - ap;
        if (av !== bv) return bv - av;   // ボリューム降順
    } else if (rule === "volume_desc") {
        if (av !== bv) return bv - av;
        if (ap !== bp) return bp - ap;
    } else if (rule === "volume_asc") {
        const aa = ascLevel(a.volume), ba = ascLevel(b.volume);
        if (aa !== ba) return aa < ba ? -1 : 1;   // ボリューム昇順
        if (ap !== bp) return bp - ap;
    }
    // 作成日降順の代替として ID 降順（UUID は完全な時系列ではないが最良の代替）
    return b.id.localeCompare(a.id);
}

/**
 * 記録画面で並べ替えたあとの、同じ種類の全部の順(上から)。
 * 画面に出ていないもの(予定のない日の習慣・非表示など)と完了したものは、今の位置のまま動かさない
 *
 * @param all     同じ種類の全部(自分で並べた順に並べたもの)
 * @param moved   画面で並べ替えたものの、新しい順
 */
export function mergeManualOrder(all: Task[], moved: string[]): string[] {
    const set = new Set(moved);
    const queue = [...moved];
    return all.map((t) => (set.has(t.id) ? queue.shift()! : t.id));
}

/**
 * タスク・習慣を指定ルールでソートして新しい配列を返す。
 *
 * @param tasks      ソート対象
 * @param rule       ソートルール
 * @param prioritizeDue  期限付きタスクを優先（oneoff のみ有効。自分で並べるときは使わない）
 * @param doneSet    完了済み ID セット（渡すと 未完了→完了済 を最上位に）
 * @param doingSet   対応中の ID セット（渡すと 対応中→未完了→完了済 の順に。自分で並べるときは、対応中も並べた順のまま）
 */
export function sortTasks(
    tasks: Task[],
    rule: SortRule,
    prioritizeDue: boolean,
    doneSet?: Set<string>,
    doingSet?: Set<string>
): Task[] {
    const manual = rule === "manual";
    const rank = (t: Task) => (doneSet?.has(t.id) ? 2 : !manual && doingSet?.has(t.id) ? 0 : 1);
    return [...tasks].sort((a, b) => {
        // 1. 対応中 → 未完了 → 完了済（doneSet / doingSet が渡された場合）
        if (doneSet || doingSet) {
            const ar = rank(a), br = rank(b);
            if (ar !== br) return ar - br;
        }

        // 2. 期限付きタスク優先（oneoff かつ prioritizeDue ON のみ）
        if (prioritizeDue && !manual && a.task_type === "oneoff" && b.task_type === "oneoff") {
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
