import { describe, expect, it } from "vitest";
import type { Task } from "../../../lib/types";
import type { GuideCtx, GuideState, GuideStep } from "./guideTypes";
import { HOWTO_GROUPS, findHowTo } from "./howtos";
import { STORIES, buildStory } from "./stories";

const habit = { id: "h1", title: "読書", task_type: "habit", is_active: true, is_hidden: false } as Task;

function ctxWith(state: Partial<GuideState>): GuideCtx {
    const full: GuideState = { tasks: [], doneTaskIds: new Set(), missedTaskIds: new Set(), doingTaskIds: new Set(), hasChart: false, ...state };
    return { setTab: () => {}, openRegister: () => {}, goal: () => {}, openSettings: () => {}, state: () => full };
}

const wellFormed = (steps: GuideStep[]) => {
    expect(steps.length).toBeGreaterThan(0);
    for (const s of steps) {
        expect(s.title.trim()).not.toBe("");
        expect(s.body.trim()).not.toBe("");
        // 操作を待つステップは、進む条件を持つ
        if (s.kind !== "explain") expect(s.until).toBeTypeOf("function");
    }
};

describe("やりたいことから探す", () => {
    const all = HOWTO_GROUPS.flatMap((g) => g.items);

    it("id が重ならず、findHowTo で引ける", () => {
        expect(new Set(all.map((h) => h.id)).size).toBe(all.length);
        for (const h of all) expect(findHowTo(h.id)).toBe(h);
    });

    it.each([
        ["何も無いとき", {}],
        ["チャートと習慣があるとき", { hasChart: true, tasks: [habit] }],
    ])("%s、どの使い方もステップを作れる", (_, state) => {
        for (const h of all) wellFormed(h.build(ctxWith(state)));
    });

    it("チャートが無いと、目標の使い方は「まだチャートがありません」だけになる", () => {
        const steps = findHowTo("goal-progress")!.build(ctxWith({}));
        expect(steps.map((s) => s.title)).toEqual(["まだチャートがありません"]);
    });

    it("習慣が無いと、習慣の編集の使い方は登録を促す", () => {
        const steps = findHowTo("habit-frequency")!.build(ctxWith({}));
        expect(steps.map((s) => s.title)).toEqual(["まだ習慣がありません"]);
        expect(findHowTo("habit-frequency")!.build(ctxWith({ tasks: [habit] })).length).toBe(2);
    });
});

describe("はじめかた", () => {
    it.each(STORIES.map((s) => s.id))("%s は、読んで終えるステップで終わる", (id) => {
        const steps = buildStory(id, ctxWith({}));
        wellFormed(steps);
        expect(steps.at(-1)!.kind).toBe("explain");
    });

    it("チャートがあるときは、目標のストーリーにチャートの作成を入れない", () => {
        expect(buildStory("goal", ctxWith({})).length - buildStory("goal", ctxWith({ hasChart: true })).length).toBe(1);
    });
});
