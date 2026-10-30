import { useEffect, useMemo, useState } from "react";
import type { Task, TaskEntry, TaskEntryBounds } from "../lib/types";
import type { Tab } from "../lib/tabs";
import Card from "../components/ui/Card";
import SectionTitle from "../components/ui/SectionTitle";
import { RepeatIcon, CheckIcon, ShieldIcon, ChevronLeftIcon, ChevronRightIcon } from "../components/ui/Icon";
import { sqliteRepo } from "../lib/db/instance";
import { useUserSettings } from "../lib/context/UserSettingsContext";
import { sortTasks } from "../lib/sortTasks";
import { todayJST } from "../lib/day";
import { daysBetween, weekdayIndex } from "../lib/mandala/dates";
import { WEEKDAY_NAMES } from "../lib/mandala/frequency";
import {
    daysAgo, habitMarks, habitSummary, ruleMarks, ruleSummary, shiftTrendAnchor, staleHabits, startDayOf,
    trendPeriod, unansweredRuleDays, unrecordedDays, type HabitMark, type RuleMark, type TrendUnit,
} from "../lib/trend";
import { space } from "../lib/ui/spacing";
import { theme } from "../lib/ui/theme";

type Props = {
    userId: string;
    tasks: Task[];
    day: string;
    setDay: (d: string) => void;
    setTab: (t: Tab) => void;
    setMsg: (s: string) => void;
    cardStyle: React.CSSProperties;
};

/** 10/30(木) */
function dayLabel(day: string): string {
    return `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}(${WEEKDAY_NAMES[weekdayIndex(day)]})`;
}

/** 10/30 */
function shortDay(day: string): string {
    return `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}`;
}

function agoLabel(day: string, today: string): string {
    const n = daysAgo(day, today);
    return n === 0 ? "今日" : n === 1 ? "昨日" : `${n}日前`;
}

/**
 * 推移タブ。週(月〜日)か月で、習慣・マイルールの日ごとの記録、完了したタスク、記録の抜けを見る。
 * 日にちを押すと、その日の記録タブに移る(抜けた日をそのまま記録できるように)
 */
export default function TrendView({ userId, tasks, day, setDay, setTab, setMsg, cardStyle }: Props) {
    const { sortRule } = useUserSettings();
    const [unit, setUnit] = useState<TrendUnit>("week");
    const [anchor, setAnchor] = useState(day);
    const [entries, setEntries] = useState<TaskEntry[]>([]);
    const [bounds, setBounds] = useState<TaskEntryBounds[]>([]);

    useEffect(() => setAnchor(day), [day]);

    const today = todayJST();
    const period = useMemo(() => trendPeriod(unit, anchor), [unit, anchor]);
    const days = useMemo(() => daysBetween(period.from, period.to), [period]);
    const isCurrent = period.from <= today && today <= period.to;

    useEffect(() => {
        if (!userId) return;
        let alive = true;
        (async () => {
            try {
                const [e, b] = await Promise.all([
                    sqliteRepo.getTaskEntriesBetween(userId, period.from, period.to),
                    sqliteRepo.getTaskEntryBounds(userId),
                ]);
                if (!alive) return;
                setEntries(e);
                setBounds(b);
            } catch (err: any) {
                if (alive) setMsg(err?.message ?? "推移の読み込みエラー");
            }
        })();
        return () => { alive = false; };
    }, [userId, period, tasks, setMsg]);

    const goDay = (d: string) => {
        setDay(d);
        setTab("today");
    };

    // --- 記録の集計 ---
    const data = useMemo(() => {
        const doneBy = new Map<string, Set<string>>();
        const missedBy = new Map<string, Set<string>>();
        const recordedDays = new Set<string>();
        const doneInPeriod: { day: string; taskId: string }[] = [];
        for (const e of entries) {
            if (e.status === "done" || e.status === "missed") {
                const map = e.status === "done" ? doneBy : missedBy;
                if (!map.has(e.task_id)) map.set(e.task_id, new Set());
                map.get(e.task_id)!.add(e.day);
            }
            if (e.status !== "todo") recordedDays.add(e.day);
            if (e.status === "done") doneInPeriod.push({ day: e.day, taskId: e.task_id });
        }

        const firstEntry = new Map<string, string>();
        const lastDone = new Map<string, string>();
        const doingSince = new Map<string, string>();
        let firstRecord: string | null = null;
        let lastRecord: string | null = null;
        for (const b of bounds) {
            const cur = firstEntry.get(b.task_id);
            if (!cur || b.first < cur) firstEntry.set(b.task_id, b.first);
            if (b.status === "done") lastDone.set(b.task_id, b.last);
            if (b.status === "doing") doingSince.set(b.task_id, b.first);
            if (!firstRecord || b.first < firstRecord) firstRecord = b.first;
            if (b.last <= today && (!lastRecord || b.last > lastRecord)) lastRecord = b.last;
        }
        const start = new Map(tasks.map((t) => [t.id, startDayOf(t, firstEntry.get(t.id), today)]));
        return { doneBy, missedBy, recordedDays, doneInPeriod, lastDone, doingSince, firstRecord, lastRecord, start };
    }, [entries, bounds, tasks, today]);

    /** 期間に出す習慣・マイルール(非表示・終えたもの・期間より後に作ったものは、期間に記録があるときだけ出す) */
    const shownOf = (type: "habit" | "rule") => sortTasks(
        tasks.filter((t) => {
            if (t.task_type !== type || !t.is_active) return false;
            const hasRecord = data.doneBy.has(t.id) || data.missedBy.has(t.id);
            const live = !t.is_hidden && (!t.ended_at || t.ended_at >= period.from) && (data.start.get(t.id) ?? today) <= period.to;
            return live || hasRecord;
        }),
        sortRule, false,
    );
    const habits = shownOf("habit");
    const rules = shownOf("rule");

    const habitRows = habits.map((t) => {
        const marks = habitMarks(t, data.start.get(t.id) ?? today, data.doneBy.get(t.id), days, today);
        return { task: t, marks, summary: habitSummary(t, marks, unit, period.to < today ? period.to : today) };
    });
    const ruleRows = rules.map((t) => {
        const marks = ruleMarks(t, data.start.get(t.id) ?? today, data.doneBy.get(t.id), data.missedBy.get(t.id), days, today);
        return { task: t, marks, summary: ruleSummary(marks) };
    });

    const noRecordDays = unrecordedDays(days, data.recordedDays, data.firstRecord, today);
    const noAnswerDays = unansweredRuleDays(days, ruleRows.map((r) => r.marks));
    const stale = isCurrent
        ? staleHabits(habits.filter((t) => !t.is_hidden), data.lastDone, data.start, today)
        : [];

    // 完了したタスク(完了した日の新しい順)と、対応中のタスク
    const taskById = new Map(tasks.map((t) => [t.id, t]));
    const doneTasksByDay = new Map<string, Task[]>();
    for (const { day: d, taskId } of data.doneInPeriod) {
        const t = taskById.get(taskId);
        if (!t || t.task_type !== "oneoff") continue;
        if (!doneTasksByDay.has(d)) doneTasksByDay.set(d, []);
        doneTasksByDay.get(d)!.push(t);
    }
    const doneTaskDays = [...doneTasksByDay.keys()].sort().reverse();
    const doingTasks = isCurrent
        ? tasks
            .filter((t) => t.task_type === "oneoff" && t.is_active && data.doingSince.has(t.id) && !data.lastDone.has(t.id))
            .map((t) => ({ task: t, since: data.doingSince.get(t.id)! }))
            .sort((a, b) => a.since.localeCompare(b.since))
        : [];

    // --- 見た目 ---
    // 週は必ず月〜日なので、曜日は付けない(1行に収めるため)
    const periodLabel = unit === "week"
        ? `${shortDay(period.from)}〜${shortDay(period.to)}`
        : `${period.from.slice(0, 4)}年${Number(period.from.slice(5, 7))}月`;
    const canNext = period.to < today;

    const small: React.CSSProperties = { fontSize: 12, color: theme.subtext };
    const chip = (d: string) => (
        <button key={d} type="button" onClick={() => goDay(d)}
            style={{ border: `1px solid ${theme.border}`, background: "var(--card)", color: "var(--text)", borderRadius: 999, padding: "4px 10px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
            {dayLabel(d)}
        </button>
    );
    const navBtn = (label: string, onClick: () => void, disabled: boolean, icon: React.ReactNode) => (
        <button type="button" aria-label={label} onClick={onClick} disabled={disabled}
            style={{ width: 36, height: 36, borderRadius: 18, border: "none", background: "rgba(0,0,0,0.05)", color: "var(--text)", display: "flex", alignItems: "center", justifyContent: "center", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.3 : 1 }}>
            {icon}
        </button>
    );

    const compact = unit === "month";
    const cellSize = compact ? 14 : 24;

    /** 日ごとのマス。押すとその日の記録タブへ */
    const cell = (d: string, style: React.CSSProperties, text: string, label: string) => (
        <button key={d} type="button" onClick={() => goDay(d)} aria-label={`${dayLabel(d)}：${label}`}
            style={{
                height: cellSize, minWidth: 0, padding: 0, borderRadius: compact ? 3 : 6, boxSizing: "border-box",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                border: "none", background: "transparent", color: "var(--text)", ...style,
            }}>
            {compact ? "" : text}
        </button>
    );
    const rest: React.CSSProperties = { background: "rgba(100,116,139,0.12)" };
    const habitCell = (d: string, m: HabitMark) => {
        if (m === "done") return cell(d, { background: theme.habit, color: "#fff" }, "✓", "やった");
        if (m === "open") return cell(d, { border: `1.5px solid ${theme.habit}66` }, "", "やっていない");
        if (m === "free" || m === "off") return cell(d, rest, "", m === "off" ? "予定のない日" : "やっていない");
        return cell(d, {}, "", "数えない日");
    };
    const ruleCell = (d: string, m: RuleMark) => {
        if (m === "kept") return cell(d, { background: theme.rule, color: "#fff" }, "○", "守れた");
        if (m === "missed") return cell(d, { background: `${theme.rule}33`, color: theme.rule }, "×", "守れなかった");
        if (m === "unanswered") return cell(d, { border: `1.5px dashed ${theme.subtext}`, color: theme.subtext }, "?", "○× をつけていない");
        if (m === "pending") return cell(d, { border: `1.5px solid ${theme.border}` }, "", "まだ");
        if (m === "off") return cell(d, rest, "", "予定のない日");
        return cell(d, {}, "", "数えない日");
    };

    const cols = `repeat(${days.length}, minmax(0, 1fr))`;
    /** 日にちの見出し。週は曜日、月は 1・8・15・22・29 日だけ数字を出す */
    const ruler = (
        <div style={{ display: "grid", gridTemplateColumns: cols, gap: compact ? 2 : 4, marginBottom: 4 }}>
            {days.map((d) => {
                const n = Number(d.slice(8, 10));
                const isToday = d === today;
                return (
                    <div key={d} style={{ fontSize: compact ? 10 : 11, textAlign: compact ? "left" : "center", whiteSpace: "nowrap", overflow: "visible", color: isToday ? theme.text : theme.subtext, fontWeight: isToday ? 800 : 500 }}>
                        {compact ? ([1, 8, 15, 22, 29].includes(n) ? n : "") : WEEKDAY_NAMES[weekdayIndex(d)]}
                    </div>
                );
            })}
        </div>
    );
    /** 1行 = 名前とまとめ、その下に日ごとのマス */
    const table = <T,>(rows: { task: Task; marks: T[]; summary: string }[], render: (d: string, m: T) => React.ReactNode) => (
        <div style={{ display: "grid", gap: 10 }}>
            {ruler}
            {rows.map(({ task, marks, summary }) => (
                <div key={task.id} style={{ display: "grid", gap: 4 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13 }}>
                        <span style={{ fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.title}</span>
                        <span style={{ ...small, flexShrink: 0 }}>{summary}</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: cols, gap: compact ? 2 : 4 }}>
                        {days.map((d, i) => render(d, marks[i]))}
                    </div>
                </div>
            ))}
        </div>
    );
    const legend = (items: [React.CSSProperties, string][]) => (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", marginTop: 10 }}>
            {items.map(([style, label]) => (
                <span key={label} style={{ ...small, display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, boxSizing: "border-box", ...style }} />{label}
                </span>
            ))}
        </div>
    );

    return (
        <div style={{ display: "grid", gap: space.lg }}>
            {/* 期間の切り替え */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div role="tablist" aria-label="期間の単位" style={{ display: "flex", gap: 4, background: "rgba(0,0,0,0.05)", borderRadius: 10, padding: 3 }}>
                    {(["week", "month"] as const).map((u) => (
                        <button key={u} type="button" role="tab" aria-selected={unit === u} onClick={() => setUnit(u)}
                            style={{ border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", background: unit === u ? "var(--card)" : "transparent", color: "var(--text)", boxShadow: unit === u ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}>
                            {u === "week" ? "週" : "月"}
                        </button>
                    ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
                    {navBtn("前の期間", () => setAnchor(shiftTrendAnchor(unit, anchor, -1)), false, <ChevronLeftIcon size={18} />)}
                    <span style={{ fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", textAlign: "center" }}>{periodLabel}</span>
                    {navBtn("次の期間", () => setAnchor(shiftTrendAnchor(unit, anchor, 1)), !canNext, <ChevronRightIcon size={18} />)}
                </div>
            </div>

            {/* 記録の抜け */}
            <Card style={{ ...cardStyle, display: "grid", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                    <b style={{ fontSize: 14 }}>記録の抜け</b>
                    <span style={small}>
                        {data.lastRecord ? `最後に記録した日：${dayLabel(data.lastRecord)}（${agoLabel(data.lastRecord, today)}）` : "まだ記録がありません"}
                    </span>
                </div>
                {noRecordDays.length === 0 && noAnswerDays.length === 0 ? (
                    <span style={small}>{days[0] < today && data.firstRecord ? "この期間に、記録の抜けはありません。" : "前の日までの記録の抜けを、ここに出します。"}</span>
                ) : (
                    <>
                        {noRecordDays.length > 0 && (
                            <div style={{ display: "grid", gap: 6 }}>
                                <span style={small}>何も記録していない日（押すと、その日の記録へ）</span>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{noRecordDays.map(chip)}</div>
                            </div>
                        )}
                        {noAnswerDays.length > 0 && (
                            <div style={{ display: "grid", gap: 6 }}>
                                <span style={small}>マイルールに ○× をつけていない日</span>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{noAnswerDays.map(chip)}</div>
                            </div>
                        )}
                    </>
                )}
            </Card>

            {/* 習慣 */}
            <div>
                <SectionTitle title="習慣" icon={<RepeatIcon size={18} />} accentColor={theme.habit} style={{ marginBottom: 8 }} />
                {habitRows.length === 0 ? (
                    <p style={{ margin: 0, opacity: 0.5, fontSize: 14 }}>この期間の習慣はありません</p>
                ) : (
                    <Card style={cardStyle}>
                        {table(habitRows, habitCell)}
                        {legend([
                            [{ background: theme.habit }, "やった"],
                            [{ border: `1.5px solid ${theme.habit}66` }, "予定の日にやっていない"],
                            [rest, "予定のない日・週n回"],
                        ])}
                        {stale.length > 0 && (
                            <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${theme.border}`, display: "grid", gap: 4 }}>
                                <span style={{ ...small, fontWeight: 700 }}>しばらくやっていない習慣</span>
                                {stale.map(({ task, lastDone, days: n }) => (
                                    <div key={task.id} style={{ fontSize: 13, display: "flex", justifyContent: "space-between", gap: 8 }}>
                                        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.title}</span>
                                        <span style={{ ...small, flexShrink: 0 }}>
                                            {lastDone ? `最後は ${dayLabel(lastDone)}（${n}日前）` : `まだやっていない（作ってから${n}日）`}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                )}
            </div>

            {/* マイルール */}
            {ruleRows.length > 0 && (
                <div>
                    <SectionTitle title="マイルール" icon={<ShieldIcon size={18} />} accentColor={theme.rule} style={{ marginBottom: 8 }} />
                    <Card style={cardStyle}>
                        {table(ruleRows, ruleCell)}
                        {legend([
                            [{ background: theme.rule }, "○ 守れた"],
                            [{ background: `${theme.rule}33` }, "× 守れなかった"],
                            [{ border: `1.5px dashed ${theme.subtext}` }, "つけていない"],
                        ])}
                    </Card>
                </div>
            )}

            {/* 完了したタスク */}
            <div>
                <SectionTitle title="完了したタスク" icon={<CheckIcon size={18} />} accentColor={theme.task} style={{ marginBottom: 8 }} />
                <Card style={{ ...cardStyle, display: "grid", gap: 10 }}>
                    {doneTaskDays.length === 0 ? (
                        <span style={small}>この期間に完了したタスクはありません</span>
                    ) : doneTaskDays.map((d) => (
                        <div key={d} style={{ display: "grid", gap: 2 }}>
                            <span style={small}>{dayLabel(d)}</span>
                            {doneTasksByDay.get(d)!.map((t) => (
                                <span key={t.id} style={{ fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
                                    <CheckIcon size={14} color={theme.task} />{t.title}
                                </span>
                            ))}
                        </div>
                    ))}
                    {doingTasks.length > 0 && (
                        <div style={{ paddingTop: 10, borderTop: `1px solid ${theme.border}`, display: "grid", gap: 4 }}>
                            <span style={{ ...small, fontWeight: 700 }}>対応中</span>
                            {doingTasks.map(({ task, since }) => (
                                <div key={task.id} style={{ fontSize: 13, display: "flex", justifyContent: "space-between", gap: 8 }}>
                                    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.title}</span>
                                    <span style={{ ...small, flexShrink: 0 }}>{dayLabel(since)}〜（{daysAgo(since, today) + 1}日目）</span>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}
