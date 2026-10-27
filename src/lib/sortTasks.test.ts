import { describe, expect, it } from "vitest";
import { sortTasks } from "./sortTasks";
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
