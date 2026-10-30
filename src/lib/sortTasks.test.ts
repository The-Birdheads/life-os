import { describe, expect, it } from "vitest";
import { mergeManualOrder, sortTasks } from "./sortTasks";
import type { Task } from "./types";

const task = (id: string, priority: number, volume: number) =>
    ({ id, priority, volume, task_type: "habit", due_date: null } as unknown as Task);

describe("sortTasks: 優先度・ボリュームが未設定(0)のもの", () => {
    const tasks = [task("a", 0, 0), task("b", 2, 3), task("c", 5, 8)];
    const ids = (rule: Parameters<typeof sortTasks>[1]) => sortTasks(tasks, rule, false).map((t) => t.id);

    it("優先度順では後ろに回る", () => {
        expect(ids("priority")).toEqual(["c", "b", "a"]);
    });
    it("ボリューム大きい順では後ろに回る", () => {
        expect(ids("volume_desc")).toEqual(["c", "b", "a"]);
    });
    it("ボリューム小さい順でも後ろに回る", () => {
        expect(ids("volume_asc")).toEqual(["b", "c", "a"]);
    });
});

describe("sortTasks: 対応中のタスク", () => {
    it("対応中 → 未完了 → 完了済 の順になる", () => {
        const tasks = [task("done", 5, 5), task("todo", 5, 5), task("doing", 1, 1)];
        const ids = sortTasks(tasks, "priority", false, new Set(["done"]), new Set(["doing"])).map((t) => t.id);
        expect(ids).toEqual(["doing", "todo", "done"]);
    });
});

describe("sortTasks: 自分で並べる", () => {
    const withOrder = (id: string, priority: number, order: number | null) => ({ ...task(id, priority, 0), sort_order: order } as Task);
    const tasks = [withOrder("a", 5, null), withOrder("b", 1, 2), withOrder("c", 3, 1), withOrder("d", 2, null)];

    it("並べた順が上、並べていないものは下に優先度順", () => {
        expect(sortTasks(tasks, "manual", false).map((t) => t.id)).toEqual(["c", "b", "a", "d"]);
    });

    it("完了は下に回るが、対応中は並べた順のまま", () => {
        expect(sortTasks(tasks, "manual", false, new Set(["c"]), new Set(["a"])).map((t) => t.id)).toEqual(["b", "a", "d", "c"]);
    });
});

describe("mergeManualOrder", () => {
    const all = ["a", "b", "c", "d", "e"].map((id) => task(id, 0, 0));

    it("画面に出ていないものは、今の位置のまま", () => {
        // b, d は画面に出ていない(予定のない日の習慣など)
        expect(mergeManualOrder(all, ["e", "a", "c"])).toEqual(["e", "b", "a", "d", "c"]);
    });
});
