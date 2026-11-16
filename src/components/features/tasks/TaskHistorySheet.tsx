import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { Task, TaskCellEvent, TaskEntry } from "../../../lib/types";
import { sqliteRepo } from "../../../lib/db/instance";
import { todayJST } from "../../../lib/day";
import { daysBetween, weekdayIndex } from "../../../lib/mandala/dates";
import { WEEKDAY_NAMES, currentFrequency, frequencyLabel } from "../../../lib/mandala/frequency";
import {
    historyEvents, oneoffStats, recordsOf, repeatStats, type HistoryEventKind, type HistoryRecords,
} from "../../../lib/taskHistory";
import { daysAgo, habitMarks, ruleMarks, shiftTrendAnchor, trendPeriod, type HabitMark, type RuleMark } from "../../../lib/trend";
import { theme } from "../../../lib/ui/theme";
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, ClockIcon, CloseIcon, RepeatIcon, ShieldIcon, TargetIcon } from "../../ui/Icon";

/** 11/1(土) */
function dayLabel(day: string): string {
    return `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}(${WEEKDAY_NAMES[weekdayIndex(day)]})`;
}

/** 2026/11/1(土)。今年なら年を省く */
function fullDayLabel(day: string, today: string): string {
    return day.slice(0, 4) === today.slice(0, 4) ? dayLabel(day) : `${day.slice(0, 4)}/${dayLabel(day)}`;
}

function agoLabel(day: string, today: string): string {
    const n = daysAgo(day, today);
    return n === 0 ? "今日" : n === 1 ? "昨日" : `${n}日前`;
}

const KIND: Record<Task["task_type"], { label: string; color: string }> = {
    habit: { label: "習慣", color: theme.habit },
    oneoff: { label: "タスク", color: theme.task },
    rule: { label: "マイルール", color: theme.rule },
};

/**
 * 習慣・タスク・マイルールの履歴。
 * 習慣・マイルールは、これまでの回数・続いている日数・月ごとのカレンダー、
 * タスクは、作った日から完了までの流れを出し、どちらも下にできごとを新しい順に並べる。
 */
export default function TaskHistorySheet({
    userId, task, adHeight = 0, onClose,
}: {
    userId: string;
    task: Task | null;
    adHeight?: number;
    onClose: () => void;
}) {
    const [entries, setEntries] = useState<TaskEntry[] | null>(null);
    const [cellEvents, setCellEvents] = useState<TaskCellEvent[]>([]);
    const today = todayJST();
    const [month, setMonth] = useState(today);

    useEffect(() => {
        if (!task) return;
        let alive = true;
        setEntries(null);
        setMonth(today);
        Promise.all([sqliteRepo.getTaskEntriesForTask(userId, task.id), sqliteRepo.getCellEventsForTask(userId, task.id)])
            .then(([e, c]) => {
                if (!alive) return;
                setEntries(e);
                setCellEvents(c);
            })
            .catch((err) => {
                console.warn("[history] load failed:", err);
                if (alive) setEntries([]);
            });
        return () => { alive = false; };
    }, [userId, task?.id]);

    const rec = useMemo(() => recordsOf(entries ?? []), [entries]);
    if (!task) return null;

    const kind = KIND[task.task_type];
    const repeating = task.task_type !== "oneoff";
    const events = entries ? historyEvents(task, rec, cellEvents, today) : [];

    // 編集画面の中から開くので、画面全体に重ねられるよう body に出す
    return createPortal(
        <div onClick={onClose}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", zIndex: 110, display: "flex", justifyContent: "center", alignItems: "flex-end" }}>
            <div role="dialog" aria-label={`${task.title}の履歴`} onClick={(e) => e.stopPropagation()}
                style={{
                    width: "100%", maxWidth: 600, boxSizing: "border-box", display: "flex", flexDirection: "column",
                    height: `calc(100dvh - max(env(safe-area-inset-top, 0px), 24px) - ${adHeight}px - var(--guide-modal, 0px))`,
                    background: "var(--bg)", borderTopLeftRadius: 20, borderTopRightRadius: 20,
                    boxShadow: "0 -4px 20px rgba(0,0,0,0.15)", animation: "history-up 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.2)",
                }}>
                <style>{"@keyframes history-up { from { transform: translateY(100%); opacity: 0; } to { transform: none; opacity: 1; } }"}</style>
                <div style={{ position: "relative", padding: "20px 16px 8px", flexShrink: 0 }}>
                    <button type="button" aria-label="閉じる" onClick={onClose}
                        style={{ position: "absolute", top: 14, right: 16, width: 44, height: 44, borderRadius: 22, border: "none", background: "rgba(0,0,0,0.05)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text)" }}>
                        <CloseIcon size={18} />
                    </button>
                    <span style={{ fontSize: 12, fontWeight: 700, color: kind.color }}>{kind.label}の履歴</span>
                    <h2 style={{ margin: "2px 56px 0 0", fontSize: 20, lineHeight: 1.4, wordBreak: "break-word" }}>{task.title}</h2>
                    {repeating && (
                        <span style={{ fontSize: 12, color: theme.subtext }}>
                            {frequencyLabel(currentFrequency(task))}{task.ended_at ? `・${dayLabel(task.ended_at)}に終了` : ""}
                        </span>
                    )}
                </div>

                <div style={{ padding: "8px 16px calc(24px + env(safe-area-inset-bottom, 0px))", overflowY: "auto", flex: 1, display: "grid", gap: 16, alignContent: "start" }}>
                    {!entries ? (
                        <span style={{ fontSize: 14, color: theme.subtext }}>読み込み中…</span>
                    ) : (
                        <>
                            {repeating
                                ? <RepeatSummary task={task} rec={rec} today={today} color={kind.color} />
                                : <OneoffSummary task={task} rec={rec} today={today} />}
                            {repeating && <MonthCalendar task={task} rec={rec} today={today} month={month} setMonth={setMonth} />}
                            <section style={{ display: "grid", gap: 8 }}>
                                <h3 style={{ margin: 0, fontSize: 14 }}>できごと</h3>
                                <ol style={{ listStyle: "none", margin: 0, padding: "4px 14px", background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 14 }}>
                                    {events.map((ev, i) => (
                                        <li key={`${ev.day}-${ev.kind}-${i}`}
                                            style={{ display: "flex", gap: 12, padding: "10px 0", borderTop: i ? `1px solid ${theme.border}` : "none", alignItems: "flex-start" }}>
                                            <EventIcon kind={ev.kind} color={kind.color} />
                                            <div style={{ minWidth: 0, display: "grid", gap: 2 }}>
                                                <span style={{ fontSize: 14, lineHeight: 1.5, wordBreak: "break-word" }}>{ev.text}</span>
                                                <span style={{ fontSize: 12, color: theme.subtext }}>{fullDayLabel(ev.day, today)}・{agoLabel(ev.day, today)}</span>
                                            </div>
                                        </li>
                                    ))}
                                </ol>
                            </section>
                        </>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}

function EventIcon({ kind, color }: { kind: HistoryEventKind; color: string }) {
    const icon = kind === "goal" ? <TargetIcon size={14} />
        : kind === "frequency" ? <RepeatIcon size={14} />
        : kind === "doing" ? <ClockIcon size={14} />
        : kind === "ended" ? <ShieldIcon size={14} />
        : <CheckIcon size={14} />;
    const tint = kind === "goal" ? "#1D4ED8" : kind === "ended" || kind === "created" ? theme.subtext : color;
    return (
        <span aria-hidden style={{ width: 28, height: 28, borderRadius: 14, flexShrink: 0, background: `${tint}1f`, color: tint, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {icon}
        </span>
    );
}

/** 数字のタイル */
function Stat({ label, value, unit, note }: { label: string; value: string | number; unit?: string; note?: string }) {
    return (
        <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 14, padding: "10px 12px", display: "grid", gap: 2, minWidth: 0 }}>
            <span style={{ fontSize: 12, color: theme.subtext }}>{label}</span>
            <span style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.2 }}>
                {value}{unit && <span style={{ fontSize: 13, fontWeight: 700, marginLeft: 2 }}>{unit}</span>}
            </span>
            {note && <span style={{ fontSize: 11, color: theme.subtext }}>{note}</span>}
        </div>
    );
}

function RepeatSummary({ task, rec, today, color }: { task: Task; rec: HistoryRecords; today: string; color: string }) {
    const s = repeatStats(task, rec, today);
    const rule = task.task_type === "rule";
    const verb = rule ? "守れた日" : "やった日";
    const recentNote = s.recent.scheduled ? `予定の日の ${Math.round((s.recent.hits / s.recent.scheduled) * 100)}%` : undefined;
    return (
        <section style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                <Stat label={`これまでに${verb}`} value={s.total} unit="日" note={rule && s.missed ? `× の日 ${s.missed}日` : undefined} />
                {s.week
                    ? <Stat label="今週" value={`${s.week.hits}/${s.week.target}`} unit="回" note={`先週 ${s.week.lastWeek}回`} />
                    : <Stat label={s.recent.days >= 30 ? `直近30日で${verb}` : `予定の日のうち${verb}`} value={s.recent.scheduled ? `${s.recent.hits}/${s.recent.scheduled}` : s.recent.hits} unit="日" note={recentNote} />}
                <Stat label="続いている" value={s.streak.current} unit={s.streak.unit} note={`いちばん長くて ${s.streak.longest}${s.streak.unit}`} />
                <Stat label="作ってから" value={s.age} unit="日目" note={`${fullDayLabel(s.start, today)}から`} />
            </div>
            <span style={{ fontSize: 13, color: s.last ? color : theme.subtext, fontWeight: 600 }}>
                {s.last ? `最後に${rule ? "守れた" : "やった"}のは ${dayLabel(s.last)}（${agoLabel(s.last, today)}）` : `まだ${rule ? "守れた" : "やった"}日はありません`}
            </span>
        </section>
    );
}

function OneoffSummary({ task, rec, today }: { task: Task; rec: HistoryRecords; today: string }) {
    const s = oneoffStats(task, rec, today);
    const state = s.doneOn ? "完了" : s.doingSince ? "対応中" : "未完了";
    return (
        <section style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
            <Stat label="今の状態" value={state} note={s.doneOn ? `${dayLabel(s.doneOn)}に完了` : s.doingSince ? `${dayLabel(s.doingSince)}から` : undefined} />
            <Stat label={s.doneOn ? "完了までに" : "作ってから"} value={s.days} unit={s.doneOn ? "日" : "日目"} note={`${fullDayLabel(s.start, today)}に作った`} />
            {task.due_date && (
                <Stat label="期限" value={dayLabel(task.due_date)}
                    note={s.doneOn ? (s.doneOn <= task.due_date ? "期限までに完了" : "期限を過ぎて完了") : task.due_date < today ? "期限を過ぎています" : `あと${daysAgo(today, task.due_date)}日`} />
            )}
        </section>
    );
}

/** 月ごとのカレンダー(月曜始まり)。作った月から今月まで動かせる */
function MonthCalendar({ task, rec, today, month, setMonth }: {
    task: Task; rec: HistoryRecords; today: string; month: string; setMonth: (m: string) => void;
}) {
    const start = repeatStats(task, rec, today).start;
    const period = trendPeriod("month", month);
    const days = daysBetween(period.from, period.to);
    const rule = task.task_type === "rule";
    const marks: (HabitMark | RuleMark)[] = rule
        ? ruleMarks(task, start, rec.done, rec.missed, days, today)
        : habitMarks(task, start, rec.done, days, today);
    const color = rule ? theme.rule : theme.habit;
    const canPrev = period.from > start;
    const canNext = period.to < today;
    const lead = weekdayIndex(period.from);
    const hits = days.filter((d) => rec.done.has(d)).length;

    const styleOf = (m: HabitMark | RuleMark): { style: React.CSSProperties; text: string; label: string } => {
        if (m === "done" || m === "kept") return { style: { background: color, color: "#fff" }, text: rule ? "○" : "", label: rule ? "守れた" : "やった" };
        if (m === "missed") return { style: { background: `${theme.rule}33`, color: theme.rule }, text: "×", label: "守れなかった" };
        if (m === "open" || m === "unanswered") return { style: { border: `1.5px solid ${color}55` }, text: "", label: rule ? "つけていない" : "やっていない" };
        if (m === "pending") return { style: { border: `1.5px solid ${theme.border}` }, text: "", label: "まだ" };
        if (m === "free" || m === "off") return { style: { background: "rgba(100,116,139,0.10)" }, text: "", label: m === "off" ? "予定のない日" : "やっていない" };
        return { style: { opacity: 0.35 }, text: "", label: "数えない日" };
    };
    const navBtn = (label: string, delta: -1 | 1, enabled: boolean, icon: React.ReactNode) => (
        <button type="button" aria-label={label} disabled={!enabled} onClick={() => setMonth(shiftTrendAnchor("month", month, delta))}
            style={{ width: 36, height: 36, borderRadius: 18, border: "none", background: "rgba(0,0,0,0.05)", color: "var(--text)", display: "flex", alignItems: "center", justifyContent: "center", cursor: enabled ? "pointer" : "default", opacity: enabled ? 1 : 0.3 }}>
            {icon}
        </button>
    );

    return (
        <section style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 14, padding: 12, display: "grid", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                {navBtn("前の月", -1, canPrev, <ChevronLeftIcon size={18} />)}
                <div style={{ textAlign: "center" }}>
                    <b style={{ fontSize: 14 }}>{period.from.slice(0, 4)}年{Number(period.from.slice(5, 7))}月</b>
                    <div style={{ fontSize: 12, color: theme.subtext }}>{rule ? "守れた日" : "やった日"} {hits}日</div>
                </div>
                {navBtn("次の月", 1, canNext, <ChevronRightIcon size={18} />)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 4 }}>
                {WEEKDAY_NAMES.map((w) => (
                    <span key={w} style={{ fontSize: 11, textAlign: "center", color: theme.subtext }}>{w}</span>
                ))}
                {Array.from({ length: lead }, (_, i) => <span key={`lead-${i}`} />)}
                {days.map((d, i) => {
                    const { style, text, label } = styleOf(marks[i]);
                    const isToday = d === today;
                    return (
                        <span key={d} role="img" aria-label={`${dayLabel(d)}：${label}`}
                            style={{
                                aspectRatio: "1", borderRadius: 8, boxSizing: "border-box", display: "flex", flexDirection: "column",
                                alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: isToday ? 800 : 500,
                                outline: isToday ? `2px solid ${theme.text}` : "none", outlineOffset: 1, color: "var(--text)", ...style,
                            }}>
                            <span>{Number(d.slice(8, 10))}</span>
                            {text && <span style={{ fontSize: 10, lineHeight: 1 }}>{text}</span>}
                        </span>
                    );
                })}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px" }}>
                {(rule
                    ? [[{ background: theme.rule }, "○ 守れた"], [{ background: `${theme.rule}33` }, "× 守れなかった"], [{ border: `1.5px solid ${color}55` }, "つけていない"]]
                    : [[{ background: theme.habit }, "やった"], [{ border: `1.5px solid ${color}55` }, "予定の日にやっていない"], [{ background: "rgba(100,116,139,0.10)" }, "予定のない日・週n回"]]
                ).map(([style, label]) => (
                    <span key={label as string} style={{ fontSize: 11, color: theme.subtext, display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 3, boxSizing: "border-box", ...(style as React.CSSProperties) }} />{label as string}
                    </span>
                ))}
            </div>
        </section>
    );
}
