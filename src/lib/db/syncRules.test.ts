import { describe, expect, it } from "vitest";
import { shouldPull } from "./syncRules";

const row = (patch: Record<string, unknown> = {}) => ({ id: "e1", day: "2026-08-26", task_id: "buy-1", status: "done", updated_at: "2026-10-30T00:37:00Z", ...patch });

describe("サーバーの行を取り込むか", () => {
    it("端末に無い・サーバーが新しいときは取り込み、端末が新しいときは取り込まない", () => {
        expect(shouldPull("task_entries", undefined, row())).toBe(true);
        expect(shouldPull("task_entries", row({ updated_at: "2026-10-29T00:00:00Z" }), row())).toBe(true);
        expect(shouldPull("task_entries", row({ updated_at: "2026-10-31T00:00:00Z", task_id: "x" }), row())).toBe(false);
    });

    it("更新時刻が同じで中身も同じなら取り込まない。時刻の書き方の違いは同じとみなす", () => {
        expect(shouldPull("task_entries", row({ updated_at: "2026-10-30T00:37:00.000Z" }), row({ updated_at: "2026-10-30T00:37:00+00:00" }))).toBe(false);
    });

    it("更新時刻が同じなのに付け替わっていれば、サーバーに戻す", () => {
        expect(shouldPull("task_entries", row({ task_id: "buy-2" }), row())).toBe(true);
        expect(shouldPull("mandala_cell_events", { task_id: "a", updated_at: "2026-10-30T00:37:00Z" }, { task_id: "b", updated_at: "2026-10-30T00:37:00Z" })).toBe(true);
        expect(shouldPull("tasks", { mandala_cell_id: null, updated_at: "2026-10-30T00:37:00Z" }, { mandala_cell_id: null, updated_at: "2026-10-30T00:37:00Z" })).toBe(false);
    });
});
