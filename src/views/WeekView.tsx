import { useEffect, useMemo, useState } from "react";
import type { Task } from "../lib/types";
import Card from "../components/ui/Card";
import DateNav from "../components/ui/DateNav";


type Tab = "today" | "review" | "week" | "register";

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
            habitTotal: number;
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

    const habitTotal = useMemo(
        () => tasks.filter((t) => t.task_type === "habit" && t.is_active).length,
        [tasks]
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
                    habitTotal,
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
    }, [userId, startDay, endDay, days, tasks, habitTotal, setMsg, supabase]);

    const avg = useMemo(() => {
        const vals = rows.map((r) => r.fulfillment).filter((v): v is number => typeof v === "number");
        if (vals.length === 0) return 0;
        return vals.reduce((s, v) => s + v, 0) / vals.length;
    }, [rows]);

    return (
        <>
            <Card style={cardStyle}>
                {/* ✅ 週タブでも日付ナビ */}
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
                    <DateNav day={day} setDay={setDay} label="" />
                </div>
            </Card>
            <Card style={cardStyle}>
                <h2 style={{ marginTop: 12 }}>{startDay} 〜 {endDay} の7日間</h2>
                <div> 平均 充実度: <b>{avg.toFixed(1)}</b>
                    {weekLoading ? <small style={{ marginLeft: 8, opacity: 0.7 }}>読み込み中…</small> : null}
                </div>

                <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", minWidth: 520, borderCollapse: "collapse" }}>
                        <thead>
                            <tr>
                                <th style={{ textAlign: "left", borderBottom: "1px solid #eee", padding: "8px 6px" }}>日付</th>
                                <th style={{ textAlign: "right", borderBottom: "1px solid #eee", padding: "8px 6px" }}>習慣</th>
                                <th style={{ textAlign: "right", borderBottom: "1px solid #eee", padding: "8px 6px" }}>タスク</th>
                                <th style={{ textAlign: "right", borderBottom: "1px solid #eee", padding: "8px 6px" }}>行動</th>
                                <th style={{ textAlign: "right", borderBottom: "1px solid #eee", padding: "8px 6px" }}>充実度</th>
                            </tr>
                        </thead>

                        <tbody>
                            {rows.map((r) => (
                                <tr key={r.day}>
                                    <td
                                        style={{
                                            padding: "8px 6px",
                                            borderBottom: "1px solid #f3f4f6",
                                        }}
                                    >
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
                                            }}
                                            aria-label={`${r.day} の振り返りを開く`}
                                        >
                                            {r.day}
                                        </button>
                                    </td>

                                    <td style={{ padding: "8px 6px", borderBottom: "1px solid #f3f4f6", textAlign: "right" }}>
                                        {r.habitDone} / {r.habitTotal}
                                    </td>
                                    <td style={{ padding: "8px 6px", borderBottom: "1px solid #f3f4f6", textAlign: "right" }}>
                                        {r.taskDone}
                                    </td>
                                    <td style={{ padding: "8px 6px", borderBottom: "1px solid #f3f4f6", textAlign: "right" }}>
                                        {r.actionDone}
                                    </td>
                                    <td style={{ padding: "8px 6px", borderBottom: "1px solid #f3f4f6", textAlign: "right" }}>
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
        </>
    );
}
