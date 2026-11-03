/**
 * 習慣・タスク・マイルールごとの履歴(編集画面の「履歴」から開く)。
 * 新しく記録を足さず、今ある記録から組み立てる:
 * - 作った日(created_at。無ければ、いちばん早い記録の日)
 * - 日ごとの記録(task_entries: 完了・対応中・×)
 * - 頻度の変更(frequency_history)
 * - 目標(マンダラチャート)でのできごと(mandala_cell_events のうち、この習慣・タスクのもの)
 * - 終了した日(ended_at)
 */
import type { Task, TaskCellEvent, TaskEntry } from "./types";
import { addDays, daysBetween, weekStart } from "./mandala/dates";
import { frequencyAt, frequencyLabel, isScheduledOn } from "./mandala/frequency";
import { createdDay } from "./trend";

export type HistoryEventKind = "created" | "frequency" | "goal" | "doing" | "done" | "milestone" | "ended";

export type HistoryEvent = {
    day: string;
    kind: HistoryEventKind;
    text: string;
    /** 同じ日の中で並べる順(保存時刻。無ければ空) */
    at: string;
};

export type HistoryRecords = {
    /** 完了(マイルールは ○)の日 */
    done: Set<string>;
    /** マイルールで × をつけた日 */
    missed: Set<string>;
    /** 対応中にした日 */
    doing: Set<string>;
};

type HistTask = Pick<
    Task,
    "task_type" | "created_at" | "frequency_kind" | "frequency_count" | "frequency_days" | "frequency_history" | "ended_at" | "due_date"
>;

/** 回数の節目(この回数に届いた日を、できごとに出す) */
const MILESTONES = [10, 30, 50, 100, 200, 300, 500, 1000];

export function recordsOf(entries: Pick<TaskEntry, "day" | "status">[]): HistoryRecords {
    const out: HistoryRecords = { done: new Set(), missed: new Set(), doing: new Set() };
    for (const e of entries) {
        if (e.status === "done") out.done.add(e.day);
        else if (e.status === "missed") out.missed.add(e.day);
        else if (e.status === "doing") out.doing.add(e.day);
    }
    return out;
}

const sorted = (days: Set<string>) => [...days].sort();

/** 数え始める日。作った日と、いちばん早い記録の日の早いほう(どちらも無ければ today) */
export function historyStart(task: HistTask, rec: HistoryRecords, today: string): string {
    const first = [...rec.done, ...rec.missed, ...rec.doing].sort()[0];
    const created = createdDay(task.created_at);
    if (created && first) return created < first ? created : first;
    return created ?? first ?? today;
}

/** 数える最後の日(終了した日か今日の早いほう) */
function historyEnd(task: HistTask, today: string): string {
    return task.ended_at && task.ended_at < today ? task.ended_at : today;
}

// ---------- 続いている日数 ----------

/**
 * 続いている回数(今と、これまでの最長)。
 * - 毎日・曜日指定: 予定の日にやった日が何日続いたか(予定のない日は飛ばす。今日まだなのは切らさない)
 * - 週n回: 目標の回数に届いた週が何週続いたか(今週まだ届いていないのは切らさない)
 */
export function streakOf(
    task: HistTask,
    hits: Set<string>,
    start: string,
    end: string,
    today: string
): { current: number; longest: number; unit: "日" | "週" } {
    const weekly = frequencyAt(task, end).kind === "weekly_count";
    let current = 0;
    let longest = 0;
    if (weekly) {
        for (let w = weekStart(start); w <= end; w = addDays(w, 7)) {
            const days = daysBetween(w, addDays(w, 6));
            const count = days.filter((d) => hits.has(d)).length;
            const target = frequencyAt(task, days[6] > end ? end : days[6]).count ?? 1;
            if (count >= target) longest = Math.max(longest, ++current);
            else if (!(w <= today && today <= days[6])) current = 0;
        }
        return { current, longest, unit: "週" };
    }
    for (const d of daysBetween(start, end)) {
        if (hits.has(d)) longest = Math.max(longest, ++current);
        else if (d === today) continue;
        else if (isScheduledOn(frequencyAt(task, d), d) && frequencyAt(task, d).kind !== "weekly_count") current = 0;
    }
    return { current, longest, unit: "日" };
}

// ---------- まとめ ----------

function weekCounts(hits: Set<string>, day: string, target: number) {
    const from = weekStart(day);
    const count = (w: string) => daysBetween(w, addDays(w, 6)).filter((d) => hits.has(d)).length;
    return { hits: count(from), target, lastWeek: count(addDays(from, -7)) };
}

export type RepeatStats = {
    start: string;
    /** 作ってから何日目か */
    age: number;
    /** やった日(マイルールは ○ の日)の合計 */
    total: number;
    /** マイルールの × の日の合計 */
    missed: number;
    /** 直近30日(作る前の日は除く)でやった日 / 予定の日。週n回は予定の日を出さない(null) */
    recent: { days: number; hits: number; scheduled: number | null };
    streak: { current: number; longest: number; unit: "日" | "週" };
    /** 週n回の、今週と先週の回数(週n回でなければ null) */
    week: { hits: number; target: number; lastWeek: number } | null;
    last: string | null;
};

/** 習慣・マイルールのまとめ */
export function repeatStats(task: HistTask, rec: HistoryRecords, today: string): RepeatStats {
    const start = historyStart(task, rec, today);
    const end = historyEnd(task, today);
    const recentFrom = addDays(end, -29) > start ? addDays(end, -29) : start;
    const recentDays = daysBetween(recentFrom, end);
    const hits = recentDays.filter((d) => rec.done.has(d)).length;
    const weekly = frequencyAt(task, end).kind === "weekly_count";
    // 予定の日: 今日はまだ終わっていないので、やっていなければ数えない
    const scheduled = weekly
        ? null
        : recentDays.filter((d) => rec.done.has(d) || (d !== today && isScheduledOn(frequencyAt(task, d), d))).length;
    return {
        start,
        age: daysBetween(start, today).length,
        total: rec.done.size,
        missed: rec.missed.size,
        recent: { days: recentDays.length, hits, scheduled },
        streak: streakOf(task, rec.done, start, end, today),
        week: weekly ? weekCounts(rec.done, end, frequencyAt(task, end).count ?? 1) : null,
        last: sorted(rec.done).at(-1) ?? null,
    };
}

export type OneoffStats = {
    start: string;
    doingSince: string | null;
    doneOn: string | null;
    /** 作ってから完了まで(完了していなければ今日まで)の日数。作った日を1日目と数える */
    days: number;
};

export function oneoffStats(task: HistTask, rec: HistoryRecords, today: string): OneoffStats {
    const start = historyStart(task, rec, today);
    const doneOn = sorted(rec.done).at(-1) ?? null;
    return {
        start,
        doingSince: sorted(rec.doing)[0] ?? null,
        doneOn,
        days: daysBetween(start, doneOn ?? today).length,
    };
}

// ---------- できごと ----------

/** 同じ日の中での順(大きいほど新しい側に出す) */
const RANK: Record<HistoryEventKind, number> = { created: 0, goal: 1, frequency: 1, doing: 2, milestone: 3, done: 4, ended: 5 };

const desc = (a: string, b: string) => (a < b ? 1 : a > b ? -1 : 0);

/**
 * 目標でのできごとを、この習慣・タスクの履歴として読める文にする。
 * 保存してある文(note)は目標側の履歴向けで、習慣・タスクの名前が入っているため、ここでは行動目標を主にして書き直す。
 * null は出さないもの(チャートの作り直しで、古いマスから外した記録。新しいマスへ引き継いだ記録と対になる)
 */
export function goalEventText(ev: Pick<TaskCellEvent, "kind" | "note" | "cell_text">): string | null {
    const cell = ev.cell_text?.trim() ? `行動目標「${ev.cell_text.trim()}」` : "行動目標";
    if (ev.kind === "linked") {
        if (ev.note.endsWith("を作った")) return `${cell}から作った`;
        if (ev.note.includes("前のチャートから引き継いだ")) return `新しいチャートの${cell}に引き継いだ`;
        return `${cell}にひもづけた`;
    }
    if (ev.kind === "unlinked") {
        if (ev.note.includes("新しいチャートへ引き継いだ")) return null;
        if (ev.note.includes("付け替えた")) return `${cell}から、別の行動目標へ付け替えた`;
        if (ev.note.includes("チャートを終えた")) return `チャートを終えたので、${cell}とのひもづけを外した`;
        return `${cell}とのひもづけを外した`;
    }
    if (ev.kind === "changed") return `見直しで、${cell}の新しいやり方として始めた`;
    return ev.note;
}

/** できごと(新しい順) */
export function historyEvents(
    task: HistTask,
    rec: HistoryRecords,
    cellEvents: Pick<TaskCellEvent, "kind" | "note" | "created_at" | "cell_text">[],
    today: string
): HistoryEvent[] {
    const events: HistoryEvent[] = [];
    const start = historyStart(task, rec, today);
    const created = createdDay(task.created_at);
    let createdText = created ? "作った" : "はじめて記録した";

    for (const ev of cellEvents) {
        const day = createdDay(ev.created_at);
        const text = goalEventText(ev);
        if (!day || !text) continue;
        // マスから作ったときは「作った」とまとめる
        if (ev.kind === "linked" && ev.note.endsWith("を作った") && day === start) {
            createdText = `${text}`;
            continue;
        }
        events.push({ day, kind: "goal", text, at: ev.created_at });
    }
    events.push({ day: start, kind: "created", text: createdText, at: task.created_at ?? "" });

    // 頻度の変更: 履歴の各期間の翌日に、次の頻度へ変えた
    (task.frequency_history ?? []).forEach((seg, i) => {
        const day = addDays(seg.to, 1);
        const before = frequencyLabel({ kind: seg.kind, count: seg.count, days: seg.days });
        events.push({ day, kind: "frequency", text: `頻度を ${before} → ${frequencyLabel(frequencyAt(task, day))} に変えた`, at: `~${i}` });
    });

    if (task.task_type === "oneoff") {
        const doing = sorted(rec.doing)[0];
        if (doing) events.push({ day: doing, kind: "doing", text: "対応中にした", at: "" });
        const done = sorted(rec.done).at(-1);
        if (done) events.push({ day: done, kind: "done", text: "完了した", at: "" });
    } else {
        const done = sorted(rec.done);
        const verb = task.task_type === "rule" ? "守れた" : "やった";
        if (done[0]) events.push({ day: done[0], kind: "milestone", text: `はじめて${verb}`, at: "" });
        MILESTONES.forEach((n, i) => {
            if (done[n - 1]) events.push({ day: done[n - 1], kind: "milestone", text: `${verb}日が${n}日になった`, at: `~${i}` });
        });
    }

    if (task.ended_at) events.push({ day: task.ended_at, kind: "ended", text: "終了した", at: "" });

    return events.sort((a, b) => desc(a.day, b.day) || RANK[b.kind] - RANK[a.kind] || desc(a.at, b.at));
}
