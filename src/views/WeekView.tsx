import { useEffect, useMemo, useState } from "react";
import type { Task } from "../lib/types";
import Card from "../components/ui/Card";
import SectionTitle from "../components/ui/SectionTitle";
import { space } from "../lib/ui/spacing";
import { theme } from "../lib/ui/theme";




type Tab = "today" | "review" | "week";

type Props = {
    userId: string;
    tasks: Task[];
    day: string;
    setDay: (d: string) => void;
    setTab: (t: Tab) => void;
    setMsg: (s: string) => void;
    supabase: any; // Phase1なのでanyでOK（後で型付け）
    cardStyle: React.CSSProperties;
};

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
    supabase,
    cardStyle,
}: Props) {
    const [rows, setRows] = useState<
        {
            day: string;
            habitDone: number;
            taskDone: number;
            actionDone: number;
            fulfillment: number | null;
        }[]
    >([]);
    const [weekLoading, setWeekLoading] = useState(false);

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
                const [
                    { data: te, error: teErr },
                    { data: ae, error: aeErr },
                    { data: dl, error: dlErr },
                ] = await Promise.all([
                    supabase
                        .from("task_entries")
                        .select("day, task_id, status")
                        .eq("user_id", userId)
                        .gte("day", startDay)
                        .lte("day", endDay),

                    supabase
                        .from("action_entries")
                        .select("day, id")
                        .eq("user_id", userId)
                        .gte("day", startDay)
                        .lte("day", endDay),

                    supabase
                        .from("daily_logs")
                        .select("day, fulfillment")
                        .eq("user_id", userId)
                        .gte("day", startDay)
                        .lte("day", endDay),
                ]);

                if (teErr) throw teErr;
                if (aeErr) throw aeErr;
                if (dlErr) throw dlErr;

                const taskById = new Map(tasks.map((t) => [t.id, t]));

                const habitDoneMap = new Map<string, number>();
                const oneoffDoneMap = new Map<string, number>();
                const actionCountMap = new Map<string, number>();
                const fulfillmentMap = new Map<string, number | null>();

                (te ?? []).forEach((r: any) => {
                    if (r.status !== "done") return;
                    const t = taskById.get(r.task_id);
                    if (!t) return;

                    if (t.task_type === "habit") {
                        habitDoneMap.set(r.day, (habitDoneMap.get(r.day) ?? 0) + 1);
                    } else if (t.task_type === "oneoff") {
                        oneoffDoneMap.set(r.day, (oneoffDoneMap.get(r.day) ?? 0) + 1);
                    }
                });

                (ae ?? []).forEach((r: any) => {
                    actionCountMap.set(r.day, (actionCountMap.get(r.day) ?? 0) + 1);
                });

                (dl ?? []).forEach((r: any) => {
                    fulfillmentMap.set(r.day, typeof r.fulfillment === "number" ? r.fulfillment : null);
                });

                const nextRows = days.map((d) => ({
                    day: d,
                    habitDone: habitDoneMap.get(d) ?? 0,
                    taskDone: oneoffDoneMap.get(d) ?? 0,
                    actionDone: actionCountMap.get(d) ?? 0,
                    fulfillment: fulfillmentMap.get(d) ?? null,
                }));

                setRows(nextRows);
            } catch (e: any) {
                setMsg(e?.message ?? "週の読み込みエラー");
            } finally {
                setWeekLoading(false);
            }
        })();
    }, [userId, startDay, endDay, days, tasks, setMsg, supabase]);

    const avg = useMemo(() => {
        const vals = rows.map((r) => r.fulfillment).filter((v): v is number => typeof v === "number");
        if (vals.length === 0) return 0;
        return vals.reduce((s, v) => s + v, 0) / vals.length;
    }, [rows]);

    const isMobile =
        typeof window !== "undefined" &&
        window.matchMedia("(max-width: 430px)").matches;

    const cellPad = isMobile ? "12px 4px" : "14px 12px"; // プロっぽく余白を広く
    const cellFontSize = isMobile ? 12 : 14;

    function formatDayLabel(iso: string) {
        if (!iso) return iso;
        const d = new Date(iso);
        if (isNaN(d.getTime())) return iso;
        const dayOfWeek = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const date = String(d.getDate()).padStart(2, '0');
        const formatted = `${m}月${date}日(${dayOfWeek})`;
        return isMobile ? `${m}/${date}(${dayOfWeek})` : formatted;
    }

    // YYYY年MM月DD日
    const titleDateMatch = endDay.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const titleDateStr = titleDateMatch
        ? `${titleDateMatch[1]}年${titleDateMatch[2]}月${titleDateMatch[3]}日`
        : endDay;

    return (
        <>
            <div style={{ display: "grid", gap: space.lg, marginTop: space.md }}>
                <SectionTitle title={`${titleDateStr} までの7日間`} isLarge={true} style={{ marginBottom: 8 }} />
                <Card style={{ ...cardStyle, padding: "24px 0" }}> {/* 余白調整 */}
                    <div style={{ padding: "0 24px", marginBottom: 16, display: "flex", alignItems: "baseline", gap: 12 }}>
                        <span style={{ fontSize: 14, color: "#64748b", fontWeight: 500 }}>平均 充実度</span>
                        <b style={{ fontSize: 24, color: theme.primary }}>{avg.toFixed(1)}</b>
                        {weekLoading ? <small style={{ color: "#94a3b8" }}>読み込み中…</small> : null}
                    </div>

                    <div style={{ width: "100%", overflowX: "auto" }}>
                        <table
                            style={{
                                width: "100%",
                                minWidth: "400px", // スマホでも崩れにくくするため
                                tableLayout: "fixed",
                                borderCollapse: "collapse",
                            }}
                        >
                            <colgroup>
                                {/* ✅ 画面幅に合わせて均等割り（目安） */}
                                <col style={{ width: "22%" }} />
                                <col style={{ width: "18.5%" }} />
                                <col style={{ width: "18.5%" }} />
                                <col style={{ width: "18.5%" }} />
                                <col style={{ width: "22.5%" }} />
                            </colgroup>

                            <thead style={{ background: "#f8fafc", borderTop: "1px solid #e2e8f0", borderBottom: "2px solid #e2e8f0" }}>
                                <tr>
                                    <th style={{ textAlign: "left", padding: cellPad, color: "#475569", fontWeight: 600, fontSize: cellFontSize }}>日付</th>
                                    <th style={{ textAlign: "right", padding: cellPad, color: "#475569", fontWeight: 600, fontSize: cellFontSize }}>習慣</th>
                                    <th style={{ textAlign: "right", padding: cellPad, color: "#475569", fontWeight: 600, fontSize: cellFontSize }}>タスク</th>
                                    <th style={{ textAlign: "right", padding: cellPad, color: "#475569", fontWeight: 600, fontSize: cellFontSize }}>行動</th>
                                    <th style={{ textAlign: "right", padding: cellPad, color: "#475569", fontWeight: 600, fontSize: cellFontSize }}>充実度</th>
                                </tr>
                            </thead>

                            <tbody>
                                {rows.map((r, i) => (
                                    <tr key={r.day} style={{ background: i % 2 === 0 ? "#ffffff" : "#fafafa", transition: "background 0.2s" }}>
                                        <td style={{
                                            padding: cellPad,
                                            borderBottom: "1px solid #f1f5f9",
                                            fontSize: cellFontSize,
                                            overflow: "hidden"
                                        }}>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setDay(r.day);
                                                    setTab("review");
                                                }}
                                                style={{
                                                    padding: 0,
                                                    margin: 0,
                                                    border: "none",
                                                    background: "transparent",
                                                    cursor: "pointer",
                                                    textDecoration: "underline",
                                                    font: "inherit",
                                                    color: "inherit",
                                                    display: "block",     // ✅ 追加
                                                    width: "100%",        // ✅ 追加
                                                    textAlign: "left",    // ✅ 追加（好み）
                                                    overflow: "hidden",   // ✅ 念のため
                                                }}
                                                aria-label={`${r.day} の振り返りを開く`}
                                            >
                                                <span
                                                    style={{
                                                        display: "block",
                                                        maxWidth: "100%",
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                        whiteSpace: "nowrap",
                                                    }}
                                                    title={r.day}
                                                >
                                                    {formatDayLabel(r.day)}
                                                </span>
                                            </button>
                                        </td>

                                        <td style={{ padding: cellPad, borderBottom: "1px solid #f1f5f9", textAlign: "right", fontSize: cellFontSize, color: "#334155" }}>
                                            {r.habitDone || <span style={{ color: "#cbd5e1" }}>-</span>}
                                        </td>
                                        <td style={{ padding: cellPad, borderBottom: "1px solid #f1f5f9", textAlign: "right", fontSize: cellFontSize, color: "#334155" }}>
                                            {r.taskDone || <span style={{ color: "#cbd5e1" }}>-</span>}
                                        </td>
                                        <td style={{ padding: cellPad, borderBottom: "1px solid #f1f5f9", textAlign: "right", fontSize: cellFontSize, color: "#334155" }}>
                                            {r.actionDone || <span style={{ color: "#cbd5e1" }}>-</span>}
                                        </td>
                                        <td style={{ padding: cellPad, borderBottom: "1px solid #f1f5f9", textAlign: "right", fontSize: cellFontSize, fontWeight: r.fulfillment != null ? 600 : 400, color: r.fulfillment != null ? theme.primary : "#cbd5e1" }}>
                                            {r.fulfillment == null ? "-" : r.fulfillment}
                                        </td>
                                    </tr>
                                ))}
                                {rows.length === 0 && !weekLoading ? (
                                    <tr>
                                        <td colSpan={5} style={{ padding: 12, opacity: 0.7 }}>
                                            データがありません
                                        </td>
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
