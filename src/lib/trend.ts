/**
 * 推移タブ(期間での振り返り)の計算。
 * - 期間は週(月〜日)か月。週を月曜始まりにするのは、週n回の習慣の数え方と合わせるため
 * - 作る前の日・終えた後の日・まだ来ていない日は、やらなかった日に数えない
 */
import type { Task } from "./types";
import { addDays, daysBetween, minDay, weekStart } from "./mandala/dates";
import { frequencyAt, isScheduledOn } from "./mandala/frequency";
import type { Period } from "./mandala/progress";

export type TrendUnit = "week" | "month";

/** anchor を含む週(月〜日)・月 */
export function trendPeriod(unit: TrendUnit, anchor: string): Period {
    if (unit === "week") {
        const from = weekStart(anchor);
        return { from, to: addDays(from, 6) };
    }
    const from = `${anchor.slice(0, 8)}01`;
    const to = addDays(`${nextMonth(anchor).slice(0, 8)}01`, -1);
    return { from, to };
}

function nextMonth(day: string): string {
    const [y, m] = day.split("-").map(Number);
    return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
}

/** 前後の期間に移ったときの基準の日(月は1日にそろえる) */
export function shiftTrendAnchor(unit: TrendUnit, anchor: string, delta: -1 | 1): string {
    if (unit === "week") return addDays(weekStart(anchor), delta * 7);
    const first = `${anchor.slice(0, 8)}01`;
    return delta === 1 ? nextMonth(first) : `${addDays(first, -1).slice(0, 8)}01`;
}

/** 作った日時(ISO)を、端末の日付(YYYY-MM-DD)にする */
export function createdDay(createdAt: string | null | undefined): string | null {
    if (!createdAt) return null;
    const d = new Date(createdAt);
    if (Number.isNaN(d.getTime())) return null;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * 数え始める日。作った日(無ければ、いちばん早い記録の日)。
 * どちらも無ければ today(過去の日を、やらなかった日に数えない)
 */
export function startDayOf(task: Pick<Task, "created_at">, firstEntryDay: string | null | undefined, today: string): string {
    return minDay(createdDay(task.created_at), firstEntryDay) ?? today;
}

type FreqTask = Pick<Task, "frequency_kind" | "frequency_count" | "frequency_days" | "frequency_history" | "ended_at">;

/** 数える日か(作った日〜終えた日、かつ今日まで) */
function inRange(task: FreqTask, start: string, day: string, today: string): boolean {
    return day >= start && day <= today && (!task.ended_at || day <= task.ended_at);
}

/**
 * 習慣のマス。
 * done=やった / open=予定の日にやっていない / free=週n回の、やっていない日 / off=予定のない曜日 / none=数えない日
 */
export type HabitMark = "done" | "open" | "free" | "off" | "none";

export function habitMarks(task: FreqTask, start: string, doneDays: Set<string> | undefined, days: string[], today: string): HabitMark[] {
    return days.map((day) => {
        if (doneDays?.has(day)) return "done";
        if (!inRange(task, start, day, today)) return "none";
        const freq = frequencyAt(task, day);
        if (freq.kind === "weekly_count") return "free";
        return isScheduledOn(freq, day) ? "open" : "off";
    });
}

/**
 * マイルールのマス。
 * kept=○ / missed=× / unanswered=つけていない(前の日まで) / pending=今日でまだ / off=予定のない曜日 / none=数えない日
 */
export type RuleMark = "kept" | "missed" | "unanswered" | "pending" | "off" | "none";

export function ruleMarks(
    task: FreqTask,
    start: string,
    kept: Set<string> | undefined,
    missed: Set<string> | undefined,
    days: string[],
    today: string
): RuleMark[] {
    return days.map((day) => {
        if (kept?.has(day)) return "kept";
        if (missed?.has(day)) return "missed";
        if (!inRange(task, start, day, today)) return "none";
        if (!isScheduledOn(frequencyAt(task, day), day)) return "off";
        return day === today ? "pending" : "unanswered";
    });
}

/**
 * 習慣の、期間のまとめ。
 * 毎日・曜日指定は「やった日 / 予定の日」、週n回は週なら「n / 目標回」、月なら回数だけ
 */
export function habitSummary(task: FreqTask, marks: HabitMark[], unit: TrendUnit, lastDay: string): string {
    const done = marks.filter((m) => m === "done").length;
    const freq = frequencyAt(task, lastDay);
    if (freq.kind === "weekly_count") {
        return unit === "week" ? `${done}/${freq.count ?? 1}回` : `${done}回`;
    }
    const scheduled = marks.filter((m) => m === "done" || m === "open").length;
    return `${done}/${scheduled}`;
}

/** マイルールの、期間のまとめ(○ の日 / ○× をつける日) */
export function ruleSummary(marks: RuleMark[]): string {
    const kept = marks.filter((m) => m === "kept").length;
    const counted = marks.filter((m) => m === "kept" || m === "missed" || m === "unanswered").length;
    return `${kept}/${counted}`;
}

/**
 * 何も記録していない日。前の日まで(今日はまだ終わっていない)で、はじめて記録した日より後の日
 * recordedDays: 完了・対応中・× のどれかを記録した日
 */
export function unrecordedDays(days: string[], recordedDays: Set<string>, firstRecordDay: string | null, today: string): string[] {
    if (!firstRecordDay) return [];
    return days.filter((d) => d >= firstRecordDay && d < today && !recordedDays.has(d));
}

/** マイルールに ○× をつけていない日(前の日まで)。ruleMarksList はマイルールごとのマス */
export function unansweredRuleDays(days: string[], ruleMarksList: RuleMark[][]): string[] {
    return days.filter((_, i) => ruleMarksList.some((marks) => marks[i] === "unanswered"));
}

/** 何日前か(0 = 今日) */
export function daysAgo(day: string, today: string): number {
    return daysBetween(day, today).length - 1;
}

/**
 * しばらくやっていない習慣(予定のある習慣で、最後にやった日から staleDays 日以上たったもの)。
 * まだ一度もやっていない習慣は、作ってから staleDays 日以上たったもの
 */
export function staleHabits<T extends FreqTask & { id: string }>(
    habits: T[],
    lastDoneByTask: Map<string, string>,
    startByTask: Map<string, string>,
    today: string,
    staleDays = 7
): { task: T; lastDone: string | null; days: number }[] {
    const out: { task: T; lastDone: string | null; days: number }[] = [];
    for (const t of habits) {
        if (t.ended_at && t.ended_at < today) continue;
        const lastDone = lastDoneByTask.get(t.id) ?? null;
        const since = lastDone ?? startByTask.get(t.id) ?? today;
        const days = daysAgo(since, today);
        if (days >= staleDays) out.push({ task: t, lastDone, days });
    }
    return out.sort((a, b) => b.days - a.days);
}
