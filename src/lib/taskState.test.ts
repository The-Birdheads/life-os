import { describe, expect, it } from "vitest";
import { doingSinceByTask, nextOnLongPress, nextOnTap, oneoffState } from "./taskState";

describe("タスクの状態(未完了 / 対応中 / 完了)", () => {
    it("選択中の日に完了していれば完了", () => {
        expect(oneoffState(true, true, true)).toBe("done");
    });
    it("対応中の記録があり、まだ完了していなければ対応中", () => {
        expect(oneoffState(false, false, true)).toBe("doing");
    });
    it("別の日に完了していれば、対応中の記録が残っていても対応中ではない", () => {
        expect(oneoffState(false, true, true)).toBe("todo");
    });

    it("長押しで対応中 → タップで完了 → タップで未完了", () => {
        const doing = nextOnLongPress("todo");
        expect(doing).toBe("doing");
        const done = nextOnTap(doing);
        expect(done).toBe("done");
        expect(nextOnTap(done)).toBe("todo");
    });
    it("対応中を長押しすると未完了に戻る", () => {
        expect(nextOnLongPress("doing")).toBe("todo");
    });

    it("対応中にした日は、いちばん早い日", () => {
        const map = doingSinceByTask([
            { task_id: "a", day: "2026-10-28" },
            { task_id: "a", day: "2026-10-25" },
            { task_id: "b", day: "2026-10-27" },
        ]);
        expect(map.get("a")).toBe("2026-10-25");
        expect(map.get("b")).toBe("2026-10-27");
    });
});
