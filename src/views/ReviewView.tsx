import { useEffect, useState, useRef } from "react";
import type { Action, Task } from "../lib/types";

import Card from "../components/ui/Card";
import DateNav from "../components/ui/DateNav";

import CategoryBadge from "../components/badges/CategoryBadge";
import PriorityBadge from "../components/badges/PriorityBadge";
import VolBar from "../components/badges/VolBar";

type Props = {
  userId: string | null;
  day: string;
  setDay: (d: string) => void;

  tasks: Task[];
  doneTaskIds: Set<string>;
  actions: Action[];
  todayActionEntries: any[];

  note: string;
  setNote: (s: string) => void;
  fulfillment: number;
  setFulfillment: (n: number) => void;

  setMsg: (s: string) => void;
  supabase: any;

  cardStyle: React.CSSProperties; // ✅ App.tsx の cardStyle を渡して見た目維持
};

export default function ReviewView({
  userId,
  day,
  setDay,
  tasks,
  doneTaskIds,
  actions,
  todayActionEntries,
  note,
  setNote,
  fulfillment,
  setFulfillment,
  setMsg,
  supabase,
  cardStyle,
}: Props) {
  const [reviewLoading, setReviewLoading] = useState(false);
  const reqIdRef = useRef(0);

  useEffect(() => {
    if (!userId) return;

    const reqId = ++reqIdRef.current;
    setReviewLoading(true);

    (async () => {
      const { data, error } = await supabase
        .from("daily_logs")
        .select("note, fulfillment")
        .eq("user_id", userId)
        .eq("day", day)
        .maybeSingle();

      // ✅ 古いリクエスト結果は捨てる
      if (reqId !== reqIdRef.current) return;

      if (error) {
        setMsg(error.message);
        setReviewLoading(false);
        return;
      }

      setNote(data?.note ?? "");
      setFulfillment(typeof data?.fulfillment === "number" ? data.fulfillment : 0);
      setReviewLoading(false);
    })();
  }, [userId, day, setMsg, setNote, setFulfillment, supabase]);

  // ✅ その日完了したもの（表示用）
  const doneHabits = tasks.filter((t) => t.task_type === "habit" && doneTaskIds.has(t.id));
  const doneOneoffs = tasks.filter((t) => t.task_type === "oneoff" && doneTaskIds.has(t.id));

  // ✅ 行動（その日のログを表示）
  const actionById = new Map(actions.map((a) => [a.id, a]));
  const doneActionEntries = (todayActionEntries ?? []).filter((e: any) => {
    const a = actionById.get(e.action_id);
    if (!a) return false;
    return a.is_active !== false;
  });

  async function saveReview() {
    if (!userId) return;

    const fNum = Number(fulfillment);
    const f = Number.isFinite(fNum) && fNum >= 1 && fNum <= 100 ? Math.trunc(fNum) : null;

    const { error } = await supabase.from("daily_logs").upsert(
      {
        user_id: userId,
        day,
        note: note.trim() ? note.trim() : null,
        fulfillment: f,
      },
      { onConflict: "user_id,day" }
    );

    if (error) throw error;
    setMsg("振り返りを保存しました。");
  }

  return (
    <>
      <Card style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
          <DateNav day={day} setDay={setDay} />
        </div>
      </Card>

      <Card style={cardStyle}>
        {reviewLoading && <small style={{ opacity: 0.7 }}>読み込み中…</small>}
        <div style={{ display: "grid", gap: 10 }}>
          <label>
            充実度（1-100）
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <b>{fulfillment || 0}</b>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={fulfillment}
                  onChange={(e) => setFulfillment(Number(e.target.value))}
                  style={{ width: 90, boxSizing: "border-box" }}
                />
              </div>

              <input
                type="range"
                min={1}
                max={100}
                step={1}
                value={Math.min(100, Math.max(1, Number(fulfillment) || 1))}
                onChange={(e) => setFulfillment(Number(e.target.value))}
                style={{ width: "100%" }}
              />

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.7 }}>
                <span>1</span>
                <span>50</span>
                <span>100</span>
              </div>
            </div>
          </label>

          <label>
            振り返りメモ
            <textarea
              rows={5}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box" }}
              placeholder="例：今日はタスク偏重だった。明日は回復系を1つ入れる。"
            />
          </label>

          <button onClick={saveReview}>保存</button>
        </div>
      </Card>

      <Card style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>その日やった習慣</h3>
        {doneHabits.length === 0 ? (
          <p>まだありません</p>
        ) : (
          <ul style={{ paddingLeft: 18 }}>
            {doneHabits.map((t) => (
              <li key={t.id}>
                {t.title}{" "}
                <small style={{ opacity: 0.7 }}>
                  <PriorityBadge value={(t as any).priority} /> <VolBar value={(t as any).volume} />
                </small>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>その日やったタスク</h3>
        {doneOneoffs.length === 0 ? (
          <p>まだありません</p>
        ) : (
          <ul style={{ paddingLeft: 18 }}>
            {doneOneoffs.map((t) => (
              <li key={t.id}>
                {t.title}{" "}
                <small style={{ opacity: 0.7 }}>
                  <PriorityBadge value={(t as any).priority} /> <VolBar value={(t as any).volume} />
                </small>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>その日やった行動</h3>
        {doneActionEntries.length === 0 ? (
          <p>まだありません</p>
        ) : (
          <ul style={{ paddingLeft: 18 }}>
            {doneActionEntries.map((e: any) => {
              const a = actionById.get(e.action_id);
              return (
                <li key={e.id}>
                  {a ? (a.kind ?? a.title) : "（不明）"}{" "}
                  <small style={{ opacity: 0.7 }}>
                    <CategoryBadge category={a?.category} /> <VolBar value={(e as any).volume} />
                    {e.note ? ` / ${e.note}` : ""}
                  </small>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
