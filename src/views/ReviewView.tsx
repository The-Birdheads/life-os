import React, { useEffect, useState, useRef } from "react";
import type { Action, Task } from "../lib/types";

import Card from "../components/ui/Card";
import IconBtn from "../components/ui/IconBtn";

import CategoryBadge from "../components/badges/CategoryBadge";
import PriorityBadge from "../components/badges/PriorityBadge";
import VolBar from "../components/badges/VolBar";
import PrimaryBtn from "../components/ui/PrimaryBtn";
import SegmentedBar from "../components/ui/SegmentedBar";
import SectionTitle from "../components/ui/SectionTitle";
import { space } from "../lib/ui/spacing";

type Filter = "all" | "habit" | "task" | "action";

const segmentedItems = [
  { key: "all", label: "すべて" },
  { key: "habit", label: "習慣" },
  { key: "task", label: "タスク" },
  { key: "action", label: "行動" },
] as const;

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

  // ✅ Segmented filter
  const [filter, setFilter] = useState<Filter>("all");

  // ✅ 「一度でも保存されたか」＋「編集モード」
  const [hasSavedReview, setHasSavedReview] = useState(false);
  const [isEditingReview, setIsEditingReview] = useState(true);

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

      // ✅ その日の保存有無で初期表示を決める
      const saved = !!data; // レコードがある＝一度でも保存された
      setHasSavedReview(saved);
      setIsEditingReview(!saved); // 未保存→編集、保存済→確認

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

  const sumVolume = (arr: any[], getV: (x: any) => any) =>
    arr.reduce((acc, x) => acc + (Number(getV(x)) || 0), 0);

  const habitsCount = doneHabits.length;
  const habitsVol = sumVolume(doneHabits, (t) => (t as any).volume);

  const tasksCount = doneOneoffs.length;
  const tasksVol = sumVolume(doneOneoffs, (t) => (t as any).volume);

  const actionsCount = doneActionEntries.length;
  const actionsVol = sumVolume(doneActionEntries, (e) => (e as any).volume);

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

    // ✅ 保存後は「登録済」扱いにして確認画面へ
    setHasSavedReview(true);
    setIsEditingReview(false);
  }

  // --- UI parts style (Today/Registerと揃える) ---
  const listWrap: React.CSSProperties = {
    display: "grid",
    gap: 6,
  };

  const itemCard: React.CSSProperties = {
    border: "1px solid rgba(0,0,0,0.12)",
    borderRadius: 12,
    padding: 10,
    background: "rgba(255,255,255,0.02)",
  };

  const itemRow: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "center",
  };

  const itemTitle: React.CSSProperties = {
    fontWeight: 700,
    minWidth: 0,
  };

  const metaLine: React.CSSProperties = {
    marginTop: 6,
    display: "flex",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
    opacity: 0.85,
  };

  const smallLabel: React.CSSProperties = {
    fontSize: 12,
    opacity: 0.7,
  };

  const sectionCardBody: React.CSSProperties = {
    display: "grid",
    gap: 10,
  };

  const sectionStats: React.CSSProperties = {
    display: "flex",
    gap: 8,
    fontSize: 12,
    opacity: 0.75,
    whiteSpace: "nowrap",
  };

  const statPill: React.CSSProperties = {
    border: "1px solid rgba(0,0,0,0.12)",
    borderRadius: 999,
    padding: "2px 8px",
    fontSize: 12,
    opacity: 0.8,
  };

  // ✅ 充実度「確認」画面用の見た目
  const confirmWrap: React.CSSProperties = {
    display: "grid",
    gap: 12,
  };

  const confirmRow: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 12,
  };

  const bigNumber: React.CSSProperties = {
    fontSize: 36,
    fontWeight: 900,
    lineHeight: 1,
    letterSpacing: 0.2,
  };

  const confirmLabel: React.CSSProperties = {
    fontSize: 12,
    opacity: 0.7,
  };

  const noteBox: React.CSSProperties = {
    border: "1px solid rgba(0,0,0,0.12)",
    borderRadius: 12,
    padding: "10px 12px",
    background: "rgba(255,255,255,0.02)",
    whiteSpace: "pre-wrap",
    lineHeight: 1.4,
  };

  return (
    <>
      <div style={{ display: "grid", gap: space.xl }}>
        {/* ✅ 見出し：充実度（右に編集ボタンを出す） */}
        <SectionTitle
          title="充実度"
          right={
            hasSavedReview && !isEditingReview ? (
              <IconBtn title="編集" onClick={() => setIsEditingReview(true)}>
                ✏️
              </IconBtn>
            ) : null
          }
        />

        {/* ✅ 充実度Card：未登録時＆編集時 / 登録済で出し分け */}
        <Card style={cardStyle}>
          {reviewLoading && <small style={{ opacity: 0.7 }}>読み込み中…</small>}

          {/* 登録済＆確認モード */}
          {hasSavedReview && !isEditingReview ? (
            <div style={confirmWrap}>
              <div style={confirmRow}>
                <div>
                  <div style={confirmLabel}>充実度</div>
                  <div style={bigNumber}>{fulfillment ? fulfillment : "—"}</div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={confirmLabel}>範囲</div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>1〜100</div>
                </div>
              </div>

              <div>
                <div style={{ ...confirmLabel, marginBottom: 6 }}>振り返りメモ</div>
                <div style={noteBox}>{note.trim() ? note : "（メモは未入力です）"}</div>
              </div>
            </div>
          ) : (
            /* 未登録 or 編集モード（現在の編集可能な画面） */
            <div style={{ display: "grid", gap: 10 }}>
              <label>
                <div style={confirmLabel}>充実度を1～100の範囲で入力</div>
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
                <div style={{ ...confirmLabel, marginBottom: 6 }}>振り返りメモを入力</div>
                <textarea
                  rows={5}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  style={{ width: "100%", boxSizing: "border-box" }}
                  placeholder="例：今日はタスク偏重だった。明日は回復系を1つ入れる。"
                />
              </label>

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                {hasSavedReview ? (
                  <IconBtn
                    title="キャンセル"
                    onClick={() => {
                      // 保存済のときだけ「確認画面に戻る」
                      setIsEditingReview(false);
                    }}
                  >
                    ✖️
                  </IconBtn>
                ) : null}

                <PrimaryBtn onClick={saveReview}>保存</PrimaryBtn>
              </div>
            </div>
          )}
        </Card>

        {/* ✅ 見出し：実施したこと一覧（SegmentedBarの上） */}
        <SectionTitle title="実施したこと一覧" />

        {/* ✅ SegmentedBar */}
        <SegmentedBar
          items={segmentedItems as any}
          value={filter}
          onChange={setFilter}
          ariaLabel="振り返りの表示切り替え"
        />

        {/* ✅ 習慣 */}
        {(filter === "all" || filter === "habit") && (
          <Card style={cardStyle}>
            <div style={sectionCardBody}>
              <SectionTitle
                title="習慣"
                right={
                  <div style={sectionStats}>
                    <span style={statPill}>合計数: {habitsCount}</span>
                    <span style={statPill}>合計ボリューム: {habitsVol}</span>
                  </div>
                }
              />

              {doneHabits.length === 0 ? (
                <p>まだありません</p>
              ) : (
                <div style={listWrap}>
                  {doneHabits.map((t) => (
                    <div key={t.id} style={itemCard}>
                      <div style={itemRow}>
                        <div style={{ minWidth: 0 }}>
                          <div style={itemTitle}>{t.title}</div>
                          <div style={metaLine}>
                            <PriorityBadge value={(t as any).priority} />
                            <VolBar value={(t as any).volume} />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        )}

        {/* ✅ タスク */}
        {(filter === "all" || filter === "task") && (
          <Card style={cardStyle}>
            <div style={sectionCardBody}>
              <SectionTitle
                title="タスク"
                right={
                  <div style={sectionStats}>
                    <span style={statPill}>合計数: {tasksCount}</span>
                    <span style={statPill}>合計ボリューム: {tasksVol}</span>
                  </div>
                }
              />

              {doneOneoffs.length === 0 ? (
                <p>まだありません</p>
              ) : (
                <div style={listWrap}>
                  {doneOneoffs.map((t) => (
                    <div key={t.id} style={itemCard}>
                      <div style={itemRow}>
                        <div style={{ minWidth: 0 }}>
                          <div style={itemTitle}>{t.title}</div>

                          <div style={metaLine}>
                            <PriorityBadge value={(t as any).priority} />
                            <VolBar value={(t as any).volume} />
                          </div>

                          {t.due_date ? (
                            <div style={{ ...metaLine, marginTop: 4 }}>
                              <span style={smallLabel}>期限：</span>
                              <span style={smallLabel}>{t.due_date}</span>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        )}

        {/* ✅ 行動 */}
        {(filter === "all" || filter === "action") && (
          <Card style={cardStyle}>
            <div style={sectionCardBody}>
              <SectionTitle
                title="行動"
                right={
                  <div style={sectionStats}>
                    <span style={statPill}>合計数: {actionsCount}</span>
                    <span style={statPill}>合計ボリューム: {actionsVol}</span>
                  </div>
                }
              />

              {doneActionEntries.length === 0 ? (
                <p>まだありません</p>
              ) : (
                <div style={listWrap}>
                  {doneActionEntries.map((e: any) => {
                    const a = actionById.get(e.action_id);
                    const title = a ? (a.kind) : "（不明）";

                    return (
                      <div key={e.id} style={itemCard}>
                        <div style={itemRow}>
                          <div style={{ minWidth: 0 }}>
                            <div style={itemTitle}>
                              {title}{" "}
                              <span style={{ marginLeft: 8 }}>
                                <CategoryBadge category={a?.category} />
                              </span>
                            </div>

                            {e.note ? (
                              <div style={{ ...smallLabel, marginTop: 6, opacity: 0.85 }}>{e.note}</div>
                            ) : null}

                            <div style={metaLine}>
                              <VolBar value={(e as any).volume} />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
