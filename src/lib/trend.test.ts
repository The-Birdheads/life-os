import { describe, expect, it } from "vitest";
import {
    habitMarks, habitSummary, ruleMarks, ruleSummary, shiftTrendAnchor, staleHabits, startDayOf,
    trendPeriod, unansweredRuleDays, unrecordedDays,
} from "./trend";
import { daysBetween } from "./mandala/dates";

const daily = { frequency_kind: "daily" as const, frequency_count: null, frequency_days: null, frequency_history: [], ended_at: null };

describe("trendPeriod / shiftTrendAnchor", () => {
    it("週は月曜〜日曜", () => {
        // 2026-10-30 は金曜
        expect(trendPeriod("week", "2026-10-30")).toEqual({ from: "2026-10-26", to: "2026-11-01" });
    });
    it("月は1日〜末日(うるう年の2月も)", () => {
        expect(trendPeriod("month", "2026-10-30")).toEqual({ from: "2026-10-01", to: "2026-10-31" });
        expect(trendPeriod("month", "2028-02-10")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
        expect(trendPeriod("month", "2026-12-05")).toEqual({ from: "2026-12-01", to: "2026-12-31" });
    });
    it("前後の期間に移る(年をまたぐ)", () => {
        expect(shiftTrendAnchor("week", "2026-10-30", -1)).toBe("2026-10-19");
        expect(shiftTrendAnchor("month", "2026-12-15", 1)).toBe("2027-01-01");
        expect(shiftTrendAnchor("month", "2027-01-15", -1)).toBe("2026-12-01");
    });
});

describe("startDayOf", () => {
    it("作った日と、いちばん早い記録の日の早いほう。どちらも無ければ今日", () => {
        expect(startDayOf({ created_at: "2026-10-20T03:00:00Z" }, "2026-10-18", "2026-10-30")).toBe("2026-10-18");
        expect(startDayOf({ created_at: null }, null, "2026-10-30")).toBe("2026-10-30");
    });
});

describe("habitMarks / habitSummary", () => {
    const days = daysBetween("2026-10-26", "2026-11-01"); // 月〜日
    const today = "2026-10-30"; // 金

    it("作る前の日と、まだ来ていない日は数えない", () => {
        const marks = habitMarks(daily, "2026-10-27", new Set(["2026-10-28"]), days, today);
        expect(marks).toEqual(["none", "open", "done", "open", "open", "none", "none"]);
        expect(habitSummary(daily, marks, "week", today)).toBe("1/4");
    });

    it("曜日指定は予定のない曜日を off にする", () => {
        const weekdays = { ...daily, frequency_kind: "weekdays" as const, frequency_days: 1 | 4 }; // 月・水
        const marks = habitMarks(weekdays, "2026-10-01", new Set(["2026-10-26"]), days, today);
        expect(marks.slice(0, 5)).toEqual(["done", "off", "open", "off", "off"]);
        expect(habitSummary(weekdays, marks, "week", today)).toBe("1/2");
    });

    it("週n回は、やっていない日を予定外(free)にして回数で出す", () => {
        const weekly = { ...daily, frequency_kind: "weekly_count" as const, frequency_count: 3 };
        const marks = habitMarks(weekly, "2026-10-01", new Set(["2026-10-26", "2026-10-29"]), days, today);
        expect(marks.slice(0, 5)).toEqual(["done", "free", "free", "done", "free"]);
        expect(habitSummary(weekly, marks, "week", today)).toBe("2/3回");
        expect(habitSummary(weekly, marks, "month", today)).toBe("2回");
    });
});

describe("ruleMarks / ruleSummary / unansweredRuleDays", () => {
    const days = daysBetween("2026-10-26", "2026-11-01");
    const today = "2026-10-30";
    it("○・×・つけていない(前の日まで)・今日はまだ", () => {
        const marks = ruleMarks(daily, "2026-10-26", new Set(["2026-10-26"]), new Set(["2026-10-27"]), days, today);
        expect(marks).toEqual(["kept", "missed", "unanswered", "unanswered", "pending", "none", "none"]);
        expect(ruleSummary(marks)).toBe("1/4");
        expect(unansweredRuleDays(days, [marks])).toEqual(["2026-10-28", "2026-10-29"]);
    });
});

describe("unrecordedDays", () => {
    it("はじめて記録した日より後で、前の日までの、記録の無い日", () => {
        const days = daysBetween("2026-10-26", "2026-11-01");
        const recorded = new Set(["2026-10-27", "2026-10-29"]);
        expect(unrecordedDays(days, recorded, "2026-10-27", "2026-10-30")).toEqual(["2026-10-28"]);
        expect(unrecordedDays(days, recorded, null, "2026-10-30")).toEqual([]);
    });
});

describe("staleHabits", () => {
    it("最後にやった日から7日以上たった習慣を、長い順に出す", () => {
        const a = { ...daily, id: "a" };
        const b = { ...daily, id: "b" };
        const c = { ...daily, id: "c" };
        const out = staleHabits(
            [a, b, c],
            new Map([["a", "2026-10-21"], ["b", "2026-10-29"]]),
            new Map([["c", "2026-10-01"]]),
            "2026-10-30"
        );
        expect(out.map((s) => [s.task.id, s.days, s.lastDone])).toEqual([["c", 29, null], ["a", 9, "2026-10-21"]]);
    });
});
