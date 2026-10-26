import { useEffect, useMemo, useState } from "react";
import type { Task } from "../lib/types";
import Card from "../components/ui/Card";
import SectionTitle from "../components/ui/SectionTitle";
import { space } from "../lib/ui/spacing";
import { theme } from "../lib/ui/theme";

import type { Tab } from "../lib/tabs";
type ChartTarget = "fulfillment" | "total" | "habit" | "task" | "action";
type ChartMetric  = "count" | "vol";

type Props = {
    userId: string;
    tasks: Task[];
    day: string;
    setDay: (d: string) => void;
    setTab: (t: Tab) => void;
    setMsg: (s: string) => void;
    cardStyle: React.CSSProperties;
};

import { sqliteRepo } from "../lib/db/instance";

function isoDay(d: Date) {
    return d.toISOString().slice(0, 10);
}

function addDaysISO(day: string, delta: number) {
    const dt = new Date(day + "T00:00:00Z");
    dt.setUTCDate(dt.getUTCDate() + delta);
    return isoDay(dt);
}

export default function WeekView({
    userId,
    tasks,
    day,
    setDay,
    setTab,
    setMsg,
    cardStyle,
}: Props) {
    type GoalStatus = "none" | "unreviewed" | "done" | "partial" | "failed";

    type RowData = {
        day: string;
        habitDone: number;
        habitVol: number;
        taskDone: number;
        taskVol: number;
        actionDone: number;
        actionVol: number;
        fulfillment: number | null;
        goalStatus: GoalStatus;
    };

    const [rows, setRows] = useState<RowData[]>([]);
    const [weekLoading, setWeekLoading] = useState(false);
    const [chartTarget, setChartTarget] = useState<ChartTarget>("fulfillment");
    const [chartMetric, setChartMetric]  = useState<ChartMetric>("count");

    const startDay = useMemo(() => addDaysISO(day, -6), [day]);
    const endDay = day;
    const days = useMemo(
        () => Array.from({ length: 7 }, (_, i) => addDaysISO(startDay, i)),
        [startDay]
    );

    useEffect(() => {
        if (!userId) return;

        (async () => {
            setWeekLoading(true);
            try {
                const db = await (sqliteRepo as any).getDb();

                const prevStartDay = addDaysISO(startDay, -1);

                const [teRes, aeRes, dlRes] = await Promise.all([
                    db.query(
                        `SELECT day, task_id, status FROM task_entries WHERE user_id = ? AND day >= ? AND day <= ?`,
                        [userId, startDay, endDay]
                    ),
                    db.query(
                        `SELECT day, id, volume FROM action_entries WHERE user_id = ? AND day >= ? AND day <= ? AND deleted_at IS NULL`,
                        [userId, startDay, endDay]
                    ),
                    db.query(
                        `SELECT day, fulfillment, tomorrow_note, yesterday_achievement FROM daily_logs WHERE user_id = ? AND day >= ? AND day <= ?`,
                        [userId, prevStartDay, endDay]
                    )
                ]);

                const te = teRes.values || [];
                const ae = aeRes.values || [];
                const dl = dlRes.values || [];

                const taskById = new Map(tasks.map((t) => [t.id, t]));

                const habitDoneMap  = new Map<string, number>();
                const habitVolMap   = new Map<string, number>();
                const oneoffDoneMap = new Map<string, number>();
                const taskVolMap    = new Map<string, number>();
                const actionCountMap = new Map<string, number>();
                const actionVolMap   = new Map<string, number>();
                const fulfillmentMap = new Map<string, number | null>();

                te.forEach((r: any) => {
                    if (r.status !== "done") return;
                    const t = taskById.get(r.task_id);
                    if (!t) return;
                    if (t.task_type === "habit") {
                        habitDoneMap.set(r.day, (habitDoneMap.get(r.day) ?? 0) + 1);
                        habitVolMap.set(r.day, (habitVolMap.get(r.day) ?? 0) + ((t as any).volume ?? 0));
                    } else if (t.task_type === "oneoff") {
                        oneoffDoneMap.set(r.day, (oneoffDoneMap.get(r.day) ?? 0) + 1);
                        taskVolMap.set(r.day, (taskVolMap.get(r.day) ?? 0) + ((t as any).volume ?? 0));
                    }
                });

                ae.forEach((r: any) => {
                    actionCountMap.set(r.day, (actionCountMap.get(r.day) ?? 0) + 1);
                    actionVolMap.set(r.day, (actionVolMap.get(r.day) ?? 0) + (r.volume ?? 0));
                });

                const dlMap = new Map<string, {
                    fulfillment: number | null;
                    tomorrow_note: string | null;
                    yesterday_achievement: string | null;
                }>();
                dl.forEach((r: any) => {
                    fulfillmentMap.set(r.day, typeof r.fulfillment === "number" ? r.fulfillment : null);
                    dlMap.set(r.day, {
                        fulfillment: typeof r.fulfillment === "number" ? r.fulfillment : null,
                        tomorrow_note: r.tomorrow_note ?? null,
                        yesterday_achievement: r.yesterday_achievement ?? null,
                    });
                });

                const nextRows: RowData[] = days.map((d) => {
                    const prevDayLog = dlMap.get(addDaysISO(d, -1));
                    const dayLog = dlMap.get(d);
                    let goalStatus: GoalStatus = "none";
                    if (prevDayLog?.tomorrow_note?.trim()) {
                        const ach = dayLog?.yesterday_achievement;
                        if (ach === "done" || ach === "partial" || ach === "failed") {
                            goalStatus = ach;
                        } else {
                            goalStatus = "unreviewed";
                        }
                    }
                    return {
                        day: d,
                        habitDone:  habitDoneMap.get(d) ?? 0,
                        habitVol:   habitVolMap.get(d) ?? 0,
                        taskDone:   oneoffDoneMap.get(d) ?? 0,
                        taskVol:    taskVolMap.get(d) ?? 0,
                        actionDone: actionCountMap.get(d) ?? 0,
                        actionVol:  actionVolMap.get(d) ?? 0,
                        fulfillment: fulfillmentMap.get(d) ?? null,
                        goalStatus,
                    };
                });

                setRows(nextRows);
            } catch (e: any) {
                setMsg(e?.message ?? "週の読み込みエラー");
            } finally {
                setWeekLoading(false);
            }
        })();
    }, [userId, startDay, endDay, days, tasks, setMsg]);

    const avg = useMemo(() => {
        const vals = rows.map((r) => r.fulfillment).filter((v): v is number => typeof v === "number");
        if (vals.length === 0) return 0;
        return vals.reduce((s, v) => s + v, 0) / vals.length;
    }, [rows]);

    const isMobile =
        typeof window !== "undefined" &&
        window.matchMedia("(max-width: 430px)").matches;

    const cellPad = isMobile ? "10px 3px" : "12px 10px";
    const cellFontSize = isMobile ? 11 : 14;

    // その日に何らかのデータが入っているか（0 vs - の判定用）
    function hasAnyData(r: RowData): boolean {
        return r.habitDone > 0 || r.taskDone > 0 || r.actionDone > 0 || r.fulfillment != null || r.goalStatus !== "none";
    }

    function renderGoalCell(gs: GoalStatus) {
        if (gs === "none")       return <span style={{ color: "#cbd5e1" }}>-</span>;
        if (gs === "unreviewed") return <span style={{ color: "#3b82f6" }}>未</span>;
        if (gs === "done")       return <span style={{ color: theme.habit  }}>○</span>;
        if (gs === "partial")    return <span style={{ color: "#f59e0b"   }}>△</span>;
        if (gs === "failed")     return <span style={{ color: "#ef4444"   }}>×</span>;
        return <span style={{ color: "#cbd5e1" }}>-</span>;
    }

    function formatDayLabel(iso: string) {
        if (!iso) return iso;
        const d = new Date(iso);
        if (isNaN(d.getTime())) return iso;
        const dayOfWeek = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const date = String(d.getDate()).padStart(2, "0");
        return isMobile ? `${m}/${date}(${dayOfWeek})` : `${m}月${date}日(${dayOfWeek})`;
    }

    // ── Chart ────────────────────────────────────────────────
    // SVG coordinate system: fixed viewBox 320×150
    const CW = 320, CH = 150;
    const PL = 28, PR = 4, PT = 8, PB = 24;
    const plotW = CW - PL - PR;
    const plotH = CH - PT - PB;
    const slotW = plotW / 7;
    const barW  = Math.round(slotW * 0.6);

    const xOf = (i: number) => PL + slotW * i + slotW / 2;
    const yOf = (val: number, maxVal: number) => PT + plotH * (1 - val / maxVal);

    function formatChartLabel(iso: string): string {
        const d = new Date(iso + "T00:00:00Z");
        const dow = ["日", "月", "火", "水", "木", "金", "土"][d.getUTCDay()];
        return `${d.getUTCDate()}(${dow})`;
    }

    function renderChart() {
        if (chartTarget === "fulfillment") {
            const maxY = 100;
            const gridVals = [0, 25, 50, 75, 100];
            const allPts = rows.map((r, i) =>
                r.fulfillment != null
                    ? { x: xOf(i), y: yOf(r.fulfillment, maxY), i }
                    : null
            );
            const nonNullPts = allPts.filter(
                (pt): pt is { x: number; y: number; i: number } => pt !== null
            );
            const hasData = nonNullPts.length >= 1;

            // 連続する非null点のペアごとにセグメントを生成
            const segments: { d: string; dashed: boolean }[] = [];
            for (let k = 0; k + 1 < nonNullPts.length; k++) {
                const from = nonNullPts[k];
                const to   = nonNullPts[k + 1];
                segments.push({
                    d: `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} L ${to.x.toFixed(1)} ${to.y.toFixed(1)}`,
                    dashed: to.i - from.i > 1, // 日付が飛んでいる場合は点線
                });
            }

            return (
                <svg width="100%" viewBox={`0 0 ${CW} ${CH}`} style={{ display: "block", overflow: "visible" }}>
                    {gridVals.map(v => (
                        <g key={v}>
                            <line x1={PL} y1={yOf(v, maxY)} x2={CW - PR} y2={yOf(v, maxY)}
                                stroke="#e2e8f0" strokeWidth="1" />
                            <text x={PL - 3} y={yOf(v, maxY) + 3.5} textAnchor="end"
                                fontSize="9" fill="#94a3b8">{v}</text>
                        </g>
                    ))}
                    {!hasData && (
                        <text x={CW / 2} y={(PT + CH - PB) / 2} textAnchor="middle"
                            dominantBaseline="middle" fontSize="12" fill="#94a3b8">
                            期間内にデータがありません
                        </text>
                    )}
                    {segments.map((seg, k) => (
                        <path key={k} d={seg.d} fill="none" stroke={theme.primary}
                            strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
                            strokeDasharray={seg.dashed ? "5 4" : undefined} />
                    ))}
                    {nonNullPts.map((pt, k) => (
                        <circle key={k} cx={pt.x} cy={pt.y} r="3.5"
                            fill={theme.primary} stroke="white" strokeWidth="1.5" />
                    ))}
                    {rows.map((r, i) => (
                        <text key={r.day} x={xOf(i)} y={CH - 2}
                            textAnchor="middle" fontSize="9" fill="#64748b">
                            {formatChartLabel(r.day)}
                        </text>
                    ))}
                </svg>
            );
        }

        // 積み上げ棒グラフ
        const getH = (r: RowData) => chartMetric === "count" ? r.habitDone  : r.habitVol;
        const getT = (r: RowData) => chartMetric === "count" ? r.taskDone   : r.taskVol;
        const getA = (r: RowData) => chartMetric === "count" ? r.actionDone : r.actionVol;

        const hasBarData = rows.some(r => {
            if (chartTarget === "habit")  return getH(r) > 0;
            if (chartTarget === "task")   return getT(r) > 0;
            if (chartTarget === "action") return getA(r) > 0;
            return getH(r) + getT(r) + getA(r) > 0;
        });

        const maxRaw = Math.max(
            ...rows.map(r => {
                if (chartTarget === "habit")  return getH(r);
                if (chartTarget === "task")   return getT(r);
                if (chartTarget === "action") return getA(r);
                return getH(r) + getT(r) + getA(r);
            }),
            1
        );
        const maxY = Math.ceil(maxRaw / 5) * 5 || 5;

        const gridStep = Math.max(Math.ceil(maxY / 4 / 5) * 5, 5);
        const gridVals: number[] = [];
        for (let v = 0; v <= maxY; v += gridStep) gridVals.push(v);

        return (
            <svg width="100%" viewBox={`0 0 ${CW} ${CH}`} style={{ display: "block" }}>
                {gridVals.map(v => (
                    <g key={v}>
                        <line x1={PL} y1={yOf(v, maxY)} x2={CW - PR} y2={yOf(v, maxY)}
                            stroke="#e2e8f0" strokeWidth="1" />
                        <text x={PL - 3} y={yOf(v, maxY) + 3.5} textAnchor="end"
                            fontSize="9" fill="#94a3b8">{v}</text>
                    </g>
                ))}
                {!hasBarData && (
                    <text x={CW / 2} y={(PT + CH - PB) / 2} textAnchor="middle"
                        dominantBaseline="middle" fontSize="12" fill="#94a3b8">
                        期間内にデータがありません
                    </text>
                )}
                {rows.map((r, i) => {
                    const bx = xOf(i) - barW / 2;
                    if (chartTarget === "habit") {
                        const v = getH(r);
                        return v === 0 ? <g key={r.day} /> : (
                            <rect key={r.day} x={bx} y={yOf(v, maxY)}
                                width={barW} height={(v / maxY) * plotH} fill={theme.habit} />
                        );
                    }
                    if (chartTarget === "task") {
                        const v = getT(r);
                        return v === 0 ? <g key={r.day} /> : (
                            <rect key={r.day} x={bx} y={yOf(v, maxY)}
                                width={barW} height={(v / maxY) * plotH} fill={theme.task} />
                        );
                    }
                    if (chartTarget === "action") {
                        const v = getA(r);
                        return v === 0 ? <g key={r.day} /> : (
                            <rect key={r.day} x={bx} y={yOf(v, maxY)}
                                width={barW} height={(v / maxY) * plotH} fill={theme.action} />
                        );
                    }
                    // total: 習慣（下）→ タスク → 行動（上）
                    const h = getH(r), t = getT(r), a = getA(r);
                    return (
                        <g key={r.day}>
                            {h > 0 && <rect x={bx} y={yOf(h, maxY)}
                                width={barW} height={(h / maxY) * plotH} fill={theme.habit} />}
                            {t > 0 && <rect x={bx} y={yOf(h + t, maxY)}
                                width={barW} height={(t / maxY) * plotH} fill={theme.task} />}
                            {a > 0 && <rect x={bx} y={yOf(h + t + a, maxY)}
                                width={barW} height={(a / maxY) * plotH} fill={theme.action} />}
                        </g>
                    );
                })}
                {rows.map((r, i) => (
                    <text key={r.day} x={xOf(i)} y={CH - 2}
                        textAnchor="middle" fontSize="9" fill="#64748b">
                        {formatChartLabel(r.day)}
                    </text>
                ))}
            </svg>
        );
    }
    // ── /Chart ───────────────────────────────────────────────

    const titleDateMatch = endDay.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const titleDateStr = titleDateMatch
        ? `${titleDateMatch[1]}年${titleDateMatch[2]}月${titleDateMatch[3]}日`
        : endDay;

    const showMetricRow = chartTarget !== "fulfillment";

    return (
        <>
            <div style={{ display: "grid", gap: space.lg, marginTop: 0 }}>
            {/* 見出し＋グラフを1グリッドセルにまとめて間隔を8pxに */}
            <div>
                <SectionTitle title={`${titleDateStr} までの7日間`} isLarge={true} style={{ marginBottom: 8 }} />

                {/* ── グラフ枠 ── */}
                <Card style={{ ...cardStyle, padding: "14px 16px", margin: "0 -16px", width: "calc(100% + 32px)" }}>
                    {/* 行1: 表示対象プルダウン */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: showMetricRow ? 10 : 12 }}>
                        <label style={{ fontSize: 12, color: "#64748b", whiteSpace: "nowrap" }}>表示対象</label>
                        <select
                            value={chartTarget}
                            onChange={e => setChartTarget(e.target.value as ChartTarget)}
                            style={{
                                flex: 1,
                                fontSize: 13,
                                padding: "4px 8px",
                                borderRadius: 8,
                                border: "1px solid #e2e8f0",
                                background: "var(--bg)",
                                color: "var(--text)",
                            }}
                        >
                            <option value="fulfillment">充実度</option>
                            <option value="total">習慣・タスク・行動の合計</option>
                            <option value="habit">習慣</option>
                            <option value="task">タスク</option>
                            <option value="action">行動</option>
                        </select>
                    </div>

                    {/* 行2: ラジオボタン（充実度以外のみ表示） */}
                    {showMetricRow && (
                        <div style={{ display: "flex", gap: 20, marginBottom: 12 }}>
                            {(["count", "vol"] as ChartMetric[]).map(m => (
                                <label key={m} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, cursor: "pointer" }}>
                                    <input
                                        type="radio"
                                        name="chartMetric"
                                        value={m}
                                        checked={chartMetric === m}
                                        onChange={() => setChartMetric(m)}
                                        style={{ accentColor: theme.primary }}
                                    />
                                    {m === "count" ? "合計数" : "合計vol"}
                                </label>
                            ))}
                            {/* 凡例（合計モードのみ） */}
                            {chartTarget === "total" && (
                                <div style={{ marginLeft: "auto", display: "flex", gap: 10, fontSize: 11, color: "#64748b", alignItems: "center" }}>
                                    <span><span style={{ color: theme.habit }}>■</span> 習慣</span>
                                    <span><span style={{ color: theme.task }}>■</span> タスク</span>
                                    <span><span style={{ color: theme.action }}>■</span> 行動</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 行3: グラフ本体 */}
                    {renderChart()}
                </Card>
            </div>

                {/* ── 表 ── */}
                <Card style={{ ...cardStyle, padding: "20px 0", margin: "0 -16px", width: "calc(100% + 32px)" }}>
                    <div style={{ padding: "0 20px", marginBottom: 14, display: "flex", alignItems: "baseline", gap: 12 }}>
                        <span style={{ fontSize: 14, color: "#64748b", fontWeight: 500 }}>平均 充実度</span>
                        <b style={{ fontSize: 24, color: theme.primary }}>{avg.toFixed(1)}</b>
                        {weekLoading ? <small style={{ color: "#94a3b8" }}>読み込み中…</small> : null}
                    </div>

                    <div style={{ width: "100%", padding: "0 8px", boxSizing: "border-box" }}>
                        <table style={{ width: "100%", tableLayout: "fixed", borderCollapse: "collapse" }}>
                            <colgroup>
                                <col style={{ width: "30%" }} />
                                <col style={{ width: "14%" }} />
                                <col style={{ width: "14%" }} />
                                <col style={{ width: "14%" }} />
                                <col style={{ width: "14%" }} />
                                <col style={{ width: "14%" }} />
                            </colgroup>
                            <thead style={{ background: "#f8fafc", borderTop: "1px solid #e2e8f0", borderBottom: "2px solid #e2e8f0" }}>
                                <tr>
                                    <th style={{ textAlign: "left",   padding: cellPad, color: "#475569", fontWeight: 600, fontSize: cellFontSize }}>日付</th>
                                    <th style={{ textAlign: "right",  padding: cellPad, color: "#475569", fontWeight: 600, fontSize: cellFontSize }}>習慣</th>
                                    <th style={{ textAlign: "right",  padding: cellPad, color: "#475569", fontWeight: 600, fontSize: cellFontSize }}>タスク</th>
                                    <th style={{ textAlign: "right",  padding: cellPad, color: "#475569", fontWeight: 600, fontSize: cellFontSize }}>行動</th>
                                    <th style={{ textAlign: "center", padding: cellPad, color: "#475569", fontWeight: 600, fontSize: cellFontSize }}>目標</th>
                                    <th style={{ textAlign: "right",  padding: cellPad, color: "#475569", fontWeight: 600, fontSize: cellFontSize }}>充実度</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r, i) => (
                                    <tr key={r.day} style={{ background: i % 2 === 0 ? "#ffffff" : "#fafafa", transition: "background 0.2s" }}>
                                        <td style={{ padding: cellPad, borderBottom: "1px solid #f1f5f9", fontSize: cellFontSize, overflow: "hidden" }}>
                                            <button
                                                type="button"
                                                onClick={() => { setDay(r.day); setTab("review"); }}
                                                style={{
                                                    padding: 0, margin: 0, border: "none",
                                                    background: "transparent", cursor: "pointer",
                                                    textDecoration: "underline", font: "inherit",
                                                    color: "inherit", display: "block", width: "100%",
                                                    textAlign: "left", overflow: "hidden",
                                                }}
                                                aria-label={`${r.day} の振り返りを開く`}
                                            >
                                                <span style={{ display: "block", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.day}>
                                                    {formatDayLabel(r.day)}
                                                </span>
                                            </button>
                                        </td>
                                        <td style={{ padding: cellPad, borderBottom: "1px solid #f1f5f9", textAlign: "right", fontSize: cellFontSize, fontWeight: 400 }}>
                                            {r.habitDone > 0 ? r.habitDone : hasAnyData(r) ? 0 : <span style={{ color: "#cbd5e1" }}>-</span>}
                                        </td>
                                        <td style={{ padding: cellPad, borderBottom: "1px solid #f1f5f9", textAlign: "right", fontSize: cellFontSize, fontWeight: 400 }}>
                                            {r.taskDone > 0 ? r.taskDone : hasAnyData(r) ? 0 : <span style={{ color: "#cbd5e1" }}>-</span>}
                                        </td>
                                        <td style={{ padding: cellPad, borderBottom: "1px solid #f1f5f9", textAlign: "right", fontSize: cellFontSize, fontWeight: 400 }}>
                                            {r.actionDone > 0 ? r.actionDone : hasAnyData(r) ? 0 : <span style={{ color: "#cbd5e1" }}>-</span>}
                                        </td>
                                        <td style={{ padding: cellPad, borderBottom: "1px solid #f1f5f9", textAlign: "center", fontSize: cellFontSize, fontWeight: 400 }}>
                                            {renderGoalCell(r.goalStatus)}
                                        </td>
                                        <td style={{ padding: cellPad, borderBottom: "1px solid #f1f5f9", textAlign: "right", fontSize: cellFontSize, fontWeight: r.fulfillment != null ? 600 : 400, color: r.fulfillment != null ? undefined : hasAnyData(r) ? "#3b82f6" : "#cbd5e1" }}>
                                            {r.fulfillment != null ? r.fulfillment : hasAnyData(r) ? "未" : "-"}
                                        </td>
                                    </tr>
                                ))}
                                {rows.length === 0 && !weekLoading ? (
                                    <tr>
                                        <td colSpan={6} style={{ padding: 12, opacity: 0.7 }}>データがありません</td>
                                    </tr>
                                ) : null}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        </>
    );
}
