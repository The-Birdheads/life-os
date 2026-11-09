import { describe, expect, it } from "vitest";
import type { Task } from "./types";
import { historyEvents, oneoffStats, recordsOf, repeatStats, streakOf } from "./taskHistory";

const TODAY = "2026-11-04"; // 水曜

const habit = (patch: Partial<Task> = {}) => ({
    task_type: "habit", created_at: "2026-10-20T00:00:00+09:00", frequency_kind: "daily",
    frequency_count: null, frequency_days: null, frequency_history: [], ended_at: null, due_date: null, ...patch,
}) as Task;

const done = (...days: string[]) => recordsOf(days.map((day) => ({ day, status: "done" as const })));

describe("続いている回数", () => {
    it("毎日: 今日まだでも切らさず、抜けた日で数え直す", () => {
        // 10/25〜27 の3日続いたあと 10/28 が抜け、10/29〜11/3 で6日。今日 11/4 はまだ
        const days = ["2026-10-25", "2026-10-26", "2026-10-27", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02", "2026-11-03"];
        expect(streakOf(habit(), done(...days).done, "2026-10-20", TODAY, TODAY)).toEqual({ current: 6, longest: 6, unit: "日" });
        // 今日の前の日も抜けると、0 から
        expect(streakOf(habit(), done("2026-10-25", "2026-10-26").done, "2026-10-20", TODAY, TODAY)).toEqual({ current: 0, longest: 2, unit: "日" });
    });

    it("曜日指定: 予定のない曜日は飛ばす", () => {
        // 月・水(1 + 4)。10/26(月) 10/28(水) 11/2(月) にやって、今日 11/4(水) はまだ
        const t = habit({ frequency_kind: "weekdays", frequency_days: 5 });
        const s = streakOf(t, done("2026-10-26", "2026-10-28", "2026-11-02").done, "2026-10-26", TODAY, TODAY);
        expect(s.current).toBe(3);
    });

    it("週n回: 目標に届いた週を数え、今週まだ届いていないのは切らさない", () => {
        const t = habit({ frequency_kind: "weekly_count", frequency_count: 2 });
        // 10/19 の週: 2回、10/26 の週: 2回、11/2 の週(今週): 1回
        const rec = done("2026-10-20", "2026-10-22", "2026-10-27", "2026-10-30", "2026-11-03");
        expect(streakOf(t, rec.done, "2026-10-20", TODAY, TODAY)).toEqual({ current: 2, longest: 2, unit: "週" });
    });
});

describe("習慣のまとめ", () => {
    it("作った日から数え、直近の予定の日には今日を入れない(やっていれば入れる)", () => {
        const s = repeatStats(habit({ created_at: "2026-11-01T09:00:00+09:00" }), done("2026-11-01", "2026-11-03"), TODAY);
        expect(s.start).toBe("2026-11-01");
        expect(s.age).toBe(4);
        expect(s.total).toBe(2);
        expect(s.recent).toEqual({ days: 4, hits: 2, scheduled: 3 });
        expect(s.last).toBe("2026-11-03");
    });

    it("週n回は、今週と先週の回数を出す", () => {
        const t = habit({ frequency_kind: "weekly_count", frequency_count: 3 });
        expect(repeatStats(t, done("2026-10-27", "2026-11-02", "2026-11-03"), TODAY).week).toEqual({ hits: 2, target: 3, lastWeek: 1 });
        expect(repeatStats(habit(), done("2026-11-02"), TODAY).week).toBeNull();
    });

    it("作った日時が無いときは、いちばん早い記録の日から", () => {
        expect(repeatStats(habit({ created_at: null }), done("2026-10-30"), TODAY).start).toBe("2026-10-30");
    });
});

describe("タスクのまとめ", () => {
    it("作ってから完了までの日数と、対応中にした日", () => {
        const rec = recordsOf([{ day: "2026-10-28", status: "doing" }, { day: "2026-11-02", status: "done" }]);
        const s = oneoffStats(habit({ task_type: "oneoff", created_at: "2026-10-25T12:00:00+09:00" }), rec, TODAY);
        expect(s).toEqual({ start: "2026-10-25", doingSince: "2026-10-28", doneOn: "2026-11-02", days: 9 });
    });
});

describe("できごと", () => {
    it("作った・頻度の変更・目標・節目・終了を、新しい順に並べる", () => {
        const t = habit({
            frequency_kind: "weekly_count", frequency_count: 3,
            frequency_history: [{ from: null, to: "2026-10-27", kind: "daily", count: null, days: null }],
            ended_at: "2026-11-03",
        });
        const days = Array.from({ length: 10 }, (_, i) => `2026-10-${String(21 + i).padStart(2, "0")}`);
        const events = historyEvents(t, done(...days), [{ kind: "linked", note: "習慣「読書」をひもづけた", created_at: "2026-10-22T10:00:00+09:00", cell_text: "毎晩読む" }], TODAY);
        expect(events.map((e) => [e.day, e.text])).toEqual([
            ["2026-11-03", "終了した"],
            ["2026-10-30", "やった日が10日になった"],
            ["2026-10-28", "頻度を 毎日 → 週3回 に変えた"],
            ["2026-10-22", "行動目標「毎晩読む」にひもづけた"],
            ["2026-10-21", "はじめてやった"],
            ["2026-10-20", "作った"],
        ]);
    });

    it("同じ日は、作った → はじめてやった → 節目 → 終了 の順に積む", () => {
        const t = habit({ created_at: "2026-11-01T09:00:00+09:00", ended_at: "2026-11-01" });
        expect(historyEvents(t, done("2026-11-01"), [], TODAY).map((e) => e.text)).toEqual(["終了した", "はじめてやった", "作った"]);
    });

    it("マスから作ったときは「作った」にまとめ、チャートの作り直しは引き継いだ側だけ出す", () => {
        const t = habit({ created_at: "2026-11-01T09:00:00+09:00" });
        const events = historyEvents(t, done(), [
            { kind: "linked", note: "習慣「はやね」（毎日）を作った", created_at: "2026-11-01T09:00:01+09:00", cell_text: "23時に寝る" },
            { kind: "unlinked", note: "チャートを作り直したので、習慣「はやね」を新しいチャートへ引き継いだ", created_at: "2026-11-02T08:00:00+09:00", cell_text: "23時に寝る" },
            { kind: "linked", note: "習慣「はやね」を前のチャートから引き継いだ", created_at: "2026-11-02T08:00:01+09:00", cell_text: "23時に寝る" },
        ], TODAY);
        expect(events.map((e) => e.text)).toEqual(["新しいチャートの行動目標「23時に寝る」に引き継いだ", "行動目標「23時に寝る」から作った"]);
    });

    it("タスクは、対応中にした日と完了した日を出す", () => {
        const rec = recordsOf([{ day: "2026-10-28", status: "doing" }, { day: "2026-10-28", status: "done" }]);
        const events = historyEvents(habit({ task_type: "oneoff" }), rec, [], TODAY);
        expect(events.map((e) => e.text)).toEqual(["完了した", "対応中にした", "作った"]);
    });
});
