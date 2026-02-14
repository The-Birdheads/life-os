import { useEffect, useState } from "react";
import type { Action, Task } from "../lib/types";

import Card from "../components/ui/Card";
import DateNav from "../components/ui/DateNav";
import IconBtn from "../components/ui/IconBtn";

import CategoryBadge from "../components/badges/CategoryBadge";
import PriorityBadge from "../components/badges/PriorityBadge";
import VolBar from "../components/badges/VolBar";

type Props = {
  userId: string;
  day: string;
  setDay: (d: string) => void;

  tasks: Task[];
  actions: Action[];

  doneTaskIds: Set<string>;
  setDoneTaskIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  doneTaskIdsAnyDay: Set<string>;

  todayActionEntries: any[];
  setMsg: (s: string) => void;
  supabase: any;

  cardStyle: React.CSSProperties;

  loadTodayEntries: () => Promise<void>;
};

export default function TodayView({
  userId,
  day,
  setDay,
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
  const habits = tasks.filter((t) => t.is_active && t.task_type === "habit");
  const activeActions = actions.filter((a) => a.is_active);
  const activeOneoffs = tasks.filter((t) => t.is_active && t.task_type === "oneoff");

  // ✅ 非表示ルール：過去完了済み かつ 今日完了ではない → 隠す
  const visibleOneoffs = activeOneoffs.filter(
    (t) => !doneTaskIdsAnyDay.has(t.id) || doneTaskIds.has(t.id)
  );

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

  function ActionEntryForm({ activeActions }: { activeActions: any[] }) {
    const [actionId, setActionId] = useState<string>(activeActions[0]?.id ?? "");
    const [detail, setDetail] = useState<string>("");
    const [volume, setVolume] = useState<number>(5);

    useEffect(() => {
      if (!actionId && activeActions[0]?.id) setActionId(activeActions[0].id);
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

        <button type="submit" disabled={!actionId}>
          行動ログを追加
        </button>
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
        <li style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>
                {a ? (a.kind ?? a.title) : "（不明）"}
                <small style={{ marginLeft: 8, opacity: 0.7 }}>
                  <CategoryBadge category={a?.category} /> <VolBar value={entry.volume} />
                </small>
              </div>
              {entry.note ? <div style={{ opacity: 0.8, fontSize: 12 }}>{entry.note}</div> : null}
            </div>

            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <IconBtn title="編集" onClick={() => setEditing(true)}>
                ✏️
              </IconBtn>

              <IconBtn
                title="削除"
                danger
                onClick={async () => {
                  if (!confirm("この行動ログを削除しますか？")) return;
                  const { error } = await supabase
                    .from("action_entries")
                    .delete()
                    .eq("user_id", userId)
                    .eq("id", entry.id);
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
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 10 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>{a ? (a.kind ?? a.title) : "（不明）"}</div>

          <div style={{ display: "grid", gap: 10 }}>
            <label>
              行動の種類
              <select
                value={actionId}
                onChange={(e) => setActionId(e.target.value)}
                style={{ width: "100%", boxSizing: "border-box" }}
              >
                {activeActions.map((x: any) => (
                  <option key={x.id} value={x.id}>
                    {x.kind ?? x.title}
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
                <span>1</span><span>5</span><span>10</span>
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
      <Card style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <DateNav day={day} setDay={setDay} />
        </div>
      </Card>

      <Card style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>習慣</h3>
        {habits.length === 0 ? (
          <p>まだありません（タスクタブで追加）</p>
        ) : (
          <ul style={{ listStyle: "none", paddingLeft: 0, margin: 0 }}>
            {habits.map((t) => {
              const checked = doneTaskIds.has(t.id);
              return (
                <li key={t.id} style={{ marginBottom: 6 }}>
                  <label style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => toggleTaskDone(t.id, e.target.checked)}
                    />
                    <span style={{ opacity: checked ? 1 : 0.4, minWidth: 0 }}>{t.title}</span>
                    <small style={{ opacity: 0.7 }}>
                      <PriorityBadge value={(t as any).priority} /> <VolBar value={(t as any).volume} />
                    </small>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>タスク</h3>
        {visibleOneoffs.length === 0 ? (
          <p>タスクがありません（タスクタブで追加）</p>
        ) : (
          <ul style={{ listStyle: "none", paddingLeft: 0, margin: 0 }}>
            {visibleOneoffs.map((t) => {
              const checked = doneTaskIds.has(t.id);
              return (
                <li key={t.id} style={{ marginBottom: 6 }}>
                  <label style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => toggleTaskDone(t.id, e.target.checked)}
                    />
                    <span style={{ opacity: checked ? 1 : 0.4, minWidth: 0 }}>{t.title}</span>
                    <small style={{ opacity: 0.7 }}>
                      <PriorityBadge value={(t as any).priority} /> <VolBar value={(t as any).volume} />
                      <br />
                      {t.due_date ? `期限: ${t.due_date}` : ""}
                    </small>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>行動（都度入力）</h3>

        <ActionEntryForm activeActions={activeActions} />

        <div style={{ marginTop: 12 }}>
          <h4 style={{ margin: "12px 0 6px" }}>今日の行動ログ</h4>

          {todayActionEntries.length === 0 ? (
            <p>まだありません</p>
          ) : (
            <ul style={{ paddingLeft: 18 }}>
              {(todayActionEntries ?? []).map((e: any) => (
                <ActionEntryRow key={e.id} entry={e} />
              ))}
            </ul>
          )}
        </div>
      </Card>
    </>
  );
}
