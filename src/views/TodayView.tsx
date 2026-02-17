import React, { useEffect, useState } from "react";
import type { Action, Task } from "../lib/types";

import Card from "../components/ui/Card";
import IconBtn from "../components/ui/IconBtn";

import CategoryBadge from "../components/badges/CategoryBadge";
import PriorityBadge from "../components/badges/PriorityBadge";
import VolBar from "../components/badges/VolBar";
import PrimaryBtn from "../components/ui/PrimaryBtn";
import SegmentedBar from "../components/ui/SegmentedBar";
import { space } from "../lib/ui/spacing";

type Filter = "all" | "habit" | "task" | "action";

const segmentedItems = [
  { key: "all", label: "すべて" },
  { key: "habit", label: "習慣" },
  { key: "task", label: "タスク" },
  { key: "action", label: "行動" },
] as const;

type Props = {
  userId: string;
  day: string;
  setDay: (d: string) => void;

  tasks: Task[];
  actions: Action[];

  doneTaskIds: Set<string>; // 今日done
  setDoneTaskIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  doneTaskIdsAnyDay: Set<string>; // 過去どこかでdone

  todayActionEntries: any[];
  setMsg: (s: string) => void;
  supabase: any;

  cardStyle: React.CSSProperties;

  loadTodayEntries: () => Promise<void>;
};

export default function TodayView({
  userId,
  day,
  // setDay, // ※TodayView内では日付UIを持たないなら未使用OK（lintが気になるなら消してOK）
  tasks,
  actions,
  doneTaskIds,
  setDoneTaskIds,
  doneTaskIdsAnyDay,
  todayActionEntries,
  setMsg,
  supabase,
  cardStyle,
  loadTodayEntries,
}: Props) {
  // ✅ Segmented filter（コンポーネント内）
  const [filter, setFilter] = useState<Filter>("all");

  const activeHabits = tasks.filter((t) => t.is_active && t.task_type === "habit");
  const activeOneoffs = tasks.filter((t) => t.is_active && t.task_type === "oneoff");
  const activeActions = actions.filter((a) => a.is_active && !a.is_hidden);

  /**
   * ✅ 習慣（habit）の表示ルール
   * - 表示中: 常に表示
   * - 非表示: 今日完了 or 過去完了があれば「履歴として表示」
   * - 非表示で一度も完了してない: 出さない
   */
  const shouldShowHabitInToday = (t: Task) => {
    const hidden = !!(t as any).is_hidden;
    if (!hidden) return true;

    const doneToday = doneTaskIds.has(t.id);
    const doneAnyDay = doneTaskIdsAnyDay.has(t.id);
    return doneToday || doneAnyDay;
  };

  /**
   * ✅ タスク（oneoff）の表示ルール（あなた指定）
   * 表示中 + 当日以外に完了済：出ない
   * 表示中のその他の場合：出る
   * 非表示 + 当日完了済：出る
   * 非表示のその他：出ない
   */
  const shouldShowOneoffInToday = (t: Task) => {
    const hidden = !!(t as any).is_hidden;
    const doneToday = doneTaskIds.has(t.id);
    const doneAnyDay = doneTaskIdsAnyDay.has(t.id);

    if (!hidden) {
      // 表示中
      if (!doneToday && doneAnyDay) return false; // 当日以外で完了済は出ない
      return true; // その他は出る
    }

    // 非表示
    return doneToday; // 当日完了のみ出す
  };

  // ✅ 記録タブで表示する習慣
  const habits = activeHabits.filter(shouldShowHabitInToday);

  // ✅ 記録タブで表示するタスク（oneoff）
  const visibleOneoffs = activeOneoffs.filter(shouldShowOneoffInToday);

  async function toggleTaskDone(taskId: string, nextDone: boolean) {
    // ✅ 必ず“新しいSet”を作って返す（Reactが確実に再描画する）
    setDoneTaskIds((prev) => {
      const next = new Set(prev);
      if (nextDone) next.add(taskId);
      else next.delete(taskId);
      return next;
    });

    try {
      if (nextDone) {
        const { error } = await supabase.from("task_entries").upsert(
          { user_id: userId, day, task_id: taskId, status: "done" },
          { onConflict: "user_id,day,task_id" }
        );
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("task_entries")
          .delete()
          .eq("user_id", userId)
          .eq("day", day)
          .eq("task_id", taskId);
        if (error) throw error;
      }
    } catch (e) {
      // DB失敗時は正に戻す
      await loadTodayEntries();
      throw e;
    }
  }

  const rowLabelStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "22px 1fr",
    columnGap: 10,
    alignItems: "start",
  };

  const rowCard: React.CSSProperties = {
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: "10px 12px",
    background: "var(--card)",
    transition: "0.15s",
  };

  const titleStyle = (checked: boolean): React.CSSProperties => ({
    opacity: checked ? 1 : 0.4,
    minWidth: 0,
    wordBreak: "break-word",
    lineHeight: 1.3,
    fontWeight: 600,
  });

  const metaLineStyle: React.CSSProperties = {
    opacity: 0.75,
    display: "flex",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
  };

  const dueStyle: React.CSSProperties = {
    opacity: 0.75,
    fontSize: 12,
  };

  async function updateActionEntry(
    entryId: string,
    patch: { note?: string | null; volume?: number | null; action_id?: string | null }
  ) {
    const updateObj: any = {};
    if (patch.note !== undefined) updateObj.note = patch.note;
    if (patch.volume !== undefined) updateObj.volume = patch.volume;
    if (patch.action_id !== undefined) updateObj.action_id = patch.action_id;

    const { error } = await supabase
      .from("action_entries")
      .update(updateObj)
      .eq("user_id", userId)
      .eq("id", entryId);

    if (error) throw error;
    await loadTodayEntries();
  }

  function compareTask(a: Task, b: Task, doneSet: Set<string>) {
    // ① 未チェック → チェック済
    const aChecked = doneSet.has(a.id) ? 1 : 0;
    const bChecked = doneSet.has(b.id) ? 1 : 0;
    if (aChecked !== bChecked) return aChecked - bChecked;

    // ② 優先度 高 → 低
    if (a.priority !== b.priority) return b.priority - a.priority;

    // ③ ボリューム 低 → 高
    if (a.volume !== b.volume) return a.volume - b.volume;

    // ④ id 新 → 古（id降順）
    if (a.id !== b.id) return b.id.localeCompare(a.id);

    return 0;
  }

  const sortedHabits = [...habits].sort((a, b) => compareTask(a, b, doneTaskIds));
  const sortedOneoffs = [...visibleOneoffs].sort((a, b) => compareTask(a, b, doneTaskIds));

  function ActionEntryForm({ activeActions }: { activeActions: any[] }) {
    const [actionId, setActionId] = useState<string>(activeActions[0]?.id ?? "");
    const [detail, setDetail] = useState<string>("");
    const [volume, setVolume] = useState<number>(5);

    useEffect(() => {
      if (!actionId) {
        setActionId(activeActions[0]?.id ?? "");
        return;
      }
      // actionIdが「非表示化でリストから消えた」場合、先頭に寄せる
      if (activeActions.length > 0 && !activeActions.some((a) => a.id === actionId)) {
        setActionId(activeActions[0].id);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeActions.length]);

    return (
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setMsg("");

          try {
            const { error } = await supabase.from("action_entries").insert({
              user_id: userId,
              day,
              action_id: actionId,
              note: detail.trim() ? detail.trim() : null,
              volume: Math.min(10, Math.max(1, Number(volume))),
            });
            if (error) throw error;

            setDetail("");
            setVolume(5);
            await loadTodayEntries();
          } catch (err: any) {
            setMsg(err?.message ?? "追加エラー");
          }
        }}
        style={{ display: "grid", gap: 10 }}
      >
        <label>
          行動名
          <select value={actionId} onChange={(e) => setActionId(e.target.value)} style={{ width: "100%" }}>
            {activeActions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.kind ?? a.title}
              </option>
            ))}
          </select>
        </label>

        <label>
          詳細（自由入力）
          <input
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            style={{ width: "100%", boxSizing: "border-box" }}
          />
        </label>

        <label>
          ボリューム（1-10）: <b>{volume}</b>
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            style={{ width: "100%" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.7 }}>
            <span>1</span>
            <span>5</span>
            <span>10</span>
          </div>
        </label>

        <PrimaryBtn type="submit" disabled={!actionId}>
          行動ログを追加
        </PrimaryBtn>
      </form>
    );
  }

  function ActionEntryRow({ entry }: { entry: any }) {
    const a = actions.find((x) => x.id === entry.action_id);

    const [editing, setEditing] = useState(false);
    const [note, setNote] = useState<string>(entry.note ?? "");
    const [volume, setVolume] = useState<number>(Number(entry.volume ?? 5));
    const [actionId, setActionId] = useState<string>(entry.action_id);

    useEffect(() => {
      setActionId(entry.action_id);
      setNote(entry.note ?? "");
      setVolume(Number(entry.volume ?? 5));
      setEditing(false);
    }, [entry.id, entry.action_id, entry.note, entry.volume]);

    if (!editing) {
      return (
        <li>
          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: "10px 12px",
              background: "var(--card)",
              display: "flex",
              justifyContent: "space-between",
              gap: 10,
              alignItems: "center",
            }}
          >
            <div style={{ minWidth: 0, display: "grid", gap: 4 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0 }}>
                <div style={{ fontWeight: 700, minWidth: 0, wordBreak: "break-word", lineHeight: 1.3 }}>
                  {a ? (a.kind ?? a.title) : "（不明）"}
                </div>
                <div style={{ flexShrink: 0, opacity: 0.85 }}>
                  <CategoryBadge category={a?.category} />
                </div>
              </div>

              {entry.note ? <div style={{ opacity: 0.8, fontSize: 12, lineHeight: 1.3 }}>{entry.note}</div> : null}

              <div style={{ opacity: 0.75, display: "flex", alignItems: "center", gap: 8 }}>
                <VolBar value={entry.volume} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
              <IconBtn title="編集" onClick={() => setEditing(true)}>
                ✏️
              </IconBtn>

              <IconBtn
                title="削除"
                danger
                onClick={async () => {
                  if (!confirm("この行動ログを削除しますか？")) return;
                  const { error } = await supabase.from("action_entries").delete().eq("user_id", userId).eq("id", entry.id);
                  if (error) {
                    setMsg(error.message);
                    return;
                  }
                  await loadTodayEntries();
                  setMsg("行動ログを削除しました。");
                }}
              >
                🗑️
              </IconBtn>
            </div>
          </div>
        </li>
      );
    }

    return (
      <li style={{ marginBottom: 8 }}>
        <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 10, background: "var(--card)" }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>{a ? (a.kind ?? a.title) : "（不明）"}</div>

          <div style={{ display: "grid", gap: 10 }}>
            <label>
              行動の種類
              <select value={actionId} onChange={(e) => setActionId(e.target.value)} style={{ width: "100%" }} disabled={activeActions.length === 0}>
                {activeActions.length === 0 ? <option value="">（表示中の行動がありません）</option> : null}
                {activeActions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.kind ?? a.title}
                  </option>
                ))}
              </select>
            </label>

            <label>
              詳細
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                style={{ width: "100%", boxSizing: "border-box" }}
                placeholder="自由入力"
              />
            </label>

            <label>
              ボリューム（1-10）: <b>{volume}</b>
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                style={{ width: "100%" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.7 }}>
                <span>1</span>
                <span>5</span>
                <span>10</span>
              </div>
            </label>

            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
              <IconBtn
                title="保存"
                onClick={async () => {
                  try {
                    setMsg("");
                    await updateActionEntry(entry.id, {
                      action_id: actionId,
                      note: note.trim() ? note.trim() : null,
                      volume: Math.min(10, Math.max(1, Number(volume))),
                    });
                    setMsg("行動ログを更新しました。");
                  } catch (e: any) {
                    setMsg(e?.message ?? "更新エラー");
                  }
                }}
              >
                💾
              </IconBtn>

              <IconBtn
                title="キャンセル"
                onClick={() => {
                  setNote(entry.note ?? "");
                  setVolume(Number(entry.volume ?? 5));
                  setActionId(entry.action_id);
                  setEditing(false);
                }}
              >
                ✖️
              </IconBtn>
            </div>
          </div>
        </div>
      </li>
    );
  }

  return (
    <>
      {/* ✅ サブバー（segmented bar） */}
      <SegmentedBar
        items={segmentedItems as any}
        value={filter}
        onChange={setFilter}
        ariaLabel="記録の表示切り替え"
      />

      {/* ✅ カード群（フィルタに応じて出し分け） */}
      <div style={{ display: "grid", gap: space.lg, marginTop: space.md }}>
        {(filter === "all" || filter === "habit") && (
          <Card style={cardStyle}>
            <h3 style={{ marginTop: 0 }}>習慣</h3>
            {sortedHabits.length === 0 ? (
              <p>まだありません（タスクタブで追加）</p>
            ) : (
              <ul style={{ listStyle: "none", paddingLeft: 0, margin: 0, display: "grid", gap: 10 }}>
                {sortedHabits.map((t) => {
                  const isHidden = !!(t as any).is_hidden;
                  const checked = doneTaskIds.has(t.id);
                  const isPastDone = doneTaskIdsAnyDay.has(t.id);

                  return (
                    <li key={t.id}>
                      <label
                        style={{ ...rowLabelStyle, ...rowCard }}
                        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.01)")}
                        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => toggleTaskDone(t.id, e.target.checked)}
                          style={{ alignSelf: "center" }}
                        />

                        <div style={{ display: "grid", gap: 4 }}>
                          <div style={titleStyle(checked)}>{t.title}</div>

                          <div style={metaLineStyle}>
                            <PriorityBadge value={(t as any).priority} />
                            <VolBar value={(t as any).volume} />
                            {isHidden && (checked || isPastDone) ? (
                              <small style={{ opacity: 0.6 }}>（非表示・履歴のため表示）</small>
                            ) : null}
                          </div>
                        </div>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        )}

        {(filter === "all" || filter === "task") && (
          <Card style={cardStyle}>
            <h3 style={{ marginTop: 0 }}>タスク</h3>
            {sortedOneoffs.length === 0 ? (
              <p>タスクがありません（タスクタブで追加）</p>
            ) : (
              <ul style={{ listStyle: "none", paddingLeft: 0, margin: 0, display: "grid", gap: 10 }}>
                {sortedOneoffs.map((t) => {
                  const checked = doneTaskIds.has(t.id);
                  const isHidden = !!(t as any).is_hidden;

                  return (
                    <li key={t.id}>
                      <label
                        style={{ ...rowLabelStyle, ...rowCard }}
                        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.01)")}
                        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => toggleTaskDone(t.id, e.target.checked)}
                          style={{ alignSelf: "center" }}
                        />

                        <div style={{ display: "grid", gap: 4 }}>
                          <div style={titleStyle(checked)}>{t.title}</div>

                          <div style={metaLineStyle}>
                            <PriorityBadge value={(t as any).priority} />
                            <VolBar value={(t as any).volume} />
                            {isHidden && checked ? <small style={{ opacity: 0.6 }}>（非表示・当日完了のため表示）</small> : null}
                          </div>

                          {t.due_date ? (
                            <div style={dueStyle}>
                              <span style={{ marginRight: 4 }}>期限：</span>
                              {t.due_date}
                            </div>
                          ) : null}
                        </div>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        )}

        {(filter === "all" || filter === "action") && (
          <Card style={cardStyle}>
            <h3 style={{ marginTop: 0 }}>行動（都度入力）</h3>

            <ActionEntryForm activeActions={activeActions} />

            <div style={{ marginTop: space.md }}>
              <h4 style={{ margin: "12px 0 6px" }}>今日の行動ログ</h4>

              {todayActionEntries.length === 0 ? (
                <p>まだありません</p>
              ) : (
                <ul style={{ listStyle: "none", paddingLeft: 0, margin: 0, display: "grid", gap: 10 }}>
                  {(todayActionEntries ?? []).map((e: any) => (
                    <ActionEntryRow key={e.id} entry={e} />
                  ))}
                </ul>
              )}
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
