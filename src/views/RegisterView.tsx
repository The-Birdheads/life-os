import { useEffect, useState } from "react";
import type { Action, Task } from "../lib/types";

import Card from "../components/ui/Card";
import IconBtn from "../components/ui/IconBtn";

import CategoryBadge from "../components/badges/CategoryBadge";
import PriorityBadge from "../components/badges/PriorityBadge";
import VolBar from "../components/badges/VolBar";

type RegisterTab = "habit" | "oneoff" | "action";

type Props = {
  userId: string;
  tasks: Task[];
  actions: Action[];
  doneTaskIdsAnyDay: Set<string>;

  setMsg: (s: string) => void;
  supabase: any;
  cardStyle: React.CSSProperties;

  loadBase: () => Promise<void>;
};

export default function RegisterView({
  userId,
  tasks,
  actions,
  doneTaskIdsAnyDay,
  setMsg,
  supabase,
  cardStyle,
  loadBase,
}: Props) {
  const [registerTab, setRegisterTab] = useState<RegisterTab>("habit");

  // ------- DB helpers (Register専用) -------
  async function addTask(form: {
    title: string;
    task_type: "habit" | "oneoff";
    priority: number;
    volume: number;
    due_date: string | null;
  }) {
    const { error } = await supabase.from("tasks").insert({
      user_id: userId,
      title: form.title,
      task_type: form.task_type,
      priority: Math.min(5, Math.max(1, form.priority)),
      volume: Math.min(10, Math.max(1, form.volume)),
      due_date: form.task_type === "oneoff" ? form.due_date : null,
    });
    if (error) throw error;
    await loadBase();
  }

  async function updateTask(taskId: string, patch: Partial<Task>) {
    const { error } = await supabase.from("tasks").update(patch).eq("user_id", userId).eq("id", taskId);
    if (error) throw error;
    await loadBase();
  }

  async function archiveTask(taskId: string) {
    await updateTask(taskId, { is_active: false } as any);
  }
  async function unarchiveTask(taskId: string) {
    await updateTask(taskId, { is_active: true } as any);
  }

  async function deleteTaskForever(taskId: string) {
    const { error } = await supabase.from("tasks").delete().eq("user_id", userId).eq("id", taskId);
    if (error) throw error;
    await loadBase();
  }

  async function addAction(form: { kind: string; category: string }) {
    const { error } = await supabase.from("actions").insert({
      user_id: userId,
      kind: form.kind,
      category: form.category,
    });
    if (error) throw error;
    await loadBase();
  }

  async function updateAction(actionId: string, patch: Partial<Action>) {
    const { error } = await supabase.from("actions").update(patch).eq("user_id", userId).eq("id", actionId);
    if (error) throw error;
    await loadBase();
  }

  async function archiveAction(actionId: string) {
    await updateAction(actionId, { is_active: false } as any);
  }
  async function unarchiveAction(actionId: string) {
    await updateAction(actionId, { is_active: true } as any);
  }

  async function deleteActionForever(actionId: string) {
    const { error } = await supabase.from("actions").delete().eq("user_id", userId).eq("id", actionId);
    if (error) throw error;
    await loadBase();
  }

  const rowCard: React.CSSProperties = {
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: "10px 12px",
    background: "var(--card)",
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "center", // ✅ 右ボタンを上下中央
  };

  const metaLine: React.CSSProperties = {
    opacity: 0.75,
    display: "flex",
    alignItems: "center",
    gap: 8,
    paddingLeft: 4, // ✅ 「1文字スペース」的な余白
  };

  const titleLine: React.CSSProperties = {
    fontWeight: 700,
    lineHeight: 1.3,
    wordBreak: "break-word",
  };

  const smallLabel: React.CSSProperties = {
    fontSize: 12,
  };


  // ------- 内部コンポーネント -------

  function TasksView({ fixedType, title }: { fixedType: "habit" | "oneoff"; title: string }) {
    const taskType = fixedType;
    const [newTitle, setNewTitle] = useState("");
    const [priority, setPriority] = useState(3);
    const [volume, setVolume] = useState(5);
    const [dueDate, setDueDate] = useState<string>("");

    const shownTasks = tasks.filter((t) => t.task_type === fixedType);

    const visibleTasks = shownTasks.filter((t) => {
      if (t.task_type === "habit") return true;
      return !doneTaskIdsAnyDay.has(t.id);
    });

    function TaskRow({ task, onSave }: { task: Task; onSave: (patch: Partial<Task>) => Promise<void> }) {
      const [editing, setEditing] = useState(false);
      const [title, setTitle] = useState(task.title);
      const [priority, setPriority] = useState<number>((task as any).priority ?? 3);
      const [volume, setVolume] = useState<number>((task as any).volume ?? 5);
      const [dueDate, setDueDate] = useState<string>(task.due_date ?? "");

      useEffect(() => {
        setTitle(task.title);
        setPriority((task as any).priority ?? 3);
        setVolume((task as any).volume ?? 5);
        setDueDate(task.due_date ?? "");
      }, [task]);

      if (!editing) {
        return (
          <div style={rowCard}>
            {/* 左：3行（タイトル / 優先度+ボリューム / 期限） */}
            <div style={{ minWidth: 0, display: "grid", gap: 4 }}>
              {/* 1行目：タイトル */}
              <div style={titleLine}>{task.title}</div>

              {/* 2行目：優先度 + ボリューム */}
              <div style={metaLine}>
                <PriorityBadge value={(task as any).priority} />
                <VolBar value={(task as any).volume} />
              </div>

              {/* 3行目：期限（タスクのみ） */}
              {task.due_date ? (
                <div style={{ ...metaLine, opacity: 0.7 }}>
                  <span style={smallLabel}>期限：</span>
                  <span style={smallLabel}>{task.due_date}</span>
                </div>
              ) : null}
            </div>

            {/* 右：ボタン（左右位置そのまま・上下中央） */}
            <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
              <IconBtn title="編集" onClick={() => setEditing(true)}>
                ✏️
              </IconBtn>

              {task.is_active ? (
                <IconBtn
                  title="アーカイブ"
                  onClick={async () => {
                    if (!confirm("このタスクをアーカイブしますか？")) return;
                    await archiveTask(task.id);
                  }}
                >
                  📦
                </IconBtn>
              ) : (
                <IconBtn title="復帰" onClick={() => unarchiveTask(task.id)}>
                  ♻️
                </IconBtn>
              )}

              <IconBtn
                title="完全削除"
                danger
                onClick={async () => {
                  if (!confirm("完全削除しますか？")) return;
                  await deleteTaskForever(task.id);
                }}
              >
                🗑️
              </IconBtn>
            </div>
          </div>
        );
      }


      return (
        <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 10 }}>
          <div style={{ display: "grid", gap: 8 }}>
            <label>
              タイトル
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{ width: "100%", boxSizing: "border-box" }}
                placeholder={fixedType === "habit" ? "習慣名を入力" : "タスク名を入力"}
              />
            </label>

            <label>
              優先度（1-5）: <b>{priority}</b>
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                style={{ width: "100%" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.7 }}>
                <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
              </div>
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
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => <span key={n}>{n}</span>)}
              </div>
            </label>

            {taskType === "oneoff" && (
              <label>
                期限（任意）
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  style={{ width: "100%", boxSizing: "border-box" }}
                />
              </label>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={async () => {
                  await onSave({
                    title: title.trim() || task.title,
                    task_type: fixedType,
                    priority: Math.min(5, Math.max(1, priority)),
                    volume: Math.min(10, Math.max(1, volume)),
                    due_date: fixedType === "oneoff" ? (dueDate ? dueDate : null) : null,
                  } as any);
                  setEditing(false);
                }}
              >
                保存
              </button>
              <button
                onClick={() => {
                  setTitle(task.title);
                  setPriority((task as any).priority ?? 3);
                  setVolume((task as any).volume ?? 5);
                  setDueDate(task.due_date ?? "");
                  setEditing(false);
                }}
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <>
        <Card style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>{title}追加</h2>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setMsg("");
              try {
                await addTask({
                  title: newTitle,
                  task_type: fixedType,
                  priority: Math.min(5, Math.max(1, priority)),
                  volume: Math.min(10, Math.max(1, volume)),
                  due_date: fixedType === "oneoff" ? (dueDate ? dueDate : null) : null,
                });
                setNewTitle("");
                setDueDate("");
                setPriority(3);
                setVolume(5);
                setMsg("タスクを追加しました。");
              } catch (err: any) {
                setMsg(err?.message ?? "追加エラー");
              }
            }}
            style={{ display: "grid", gap: 10 }}
          >
            <label>
              タイトル
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                style={{ width: "100%", boxSizing: "border-box" }}
                placeholder={fixedType === "habit" ? "習慣名を入力" : "タスク名を入力"}
              />
            </label>

            <label>
              優先度（1-5）: <b>{priority}</b>
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                style={{ width: "100%" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.7 }}>
                <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
              </div>
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
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => <span key={n}>{n}</span>)}
              </div>
            </label>

            {taskType === "oneoff" && (
              <label>
                期限（任意）
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  style={{ width: "100%", boxSizing: "border-box" }}
                />
              </label>
            )}

            <button type="submit" disabled={!newTitle.trim()}>
              追加
            </button>
          </form>
        </Card>

        <Card style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>登録済み{title}（編集）</h3>

          {tasks.length === 0 ? (
            <p>まだありません</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {visibleTasks.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  onSave={async (patch) => {
                    try {
                      setMsg("");
                      const finalPatch = patch.task_type === "habit" ? { ...patch, due_date: null } : patch;
                      await updateTask(t.id, finalPatch as any);
                      setMsg("タスクを更新しました。");
                    } catch (e: any) {
                      setMsg(e?.message ?? "更新エラー");
                    }
                  }}
                />
              ))}
            </div>
          )}
        </Card>
      </>
    );
  }

  function ActionsView() {
    const [kind, setKind] = useState("");
    const [category, setCategory] = useState("other");

    function ActionRow({ actionItem, onSave }: { actionItem: Action; onSave: (patch: Partial<Action>) => Promise<void> }) {
      const [editing, setEditing] = useState(false);
      const initialKind = (actionItem as any).kind ?? actionItem.title;

      const [kind, setKind] = useState<string>(initialKind);
      const [category, setCategory] = useState(actionItem.category);

      useEffect(() => {
        const k = (actionItem as any).kind ?? actionItem.title;
        setKind(k);
        setCategory(actionItem.category);
      }, [actionItem]);

      if (!editing) {
        return (
          <div style={rowCard}>
            {/* 左：1行目（行動名 + カテゴリ） */}
            <div style={{ minWidth: 0, display: "grid", gap: 4 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0 }}>
                <div style={{ ...titleLine, minWidth: 0 }}>
                  {(actionItem as any).kind ?? actionItem.title}
                </div>
                <div style={{ flexShrink: 0, opacity: 0.85 }}>
                  <CategoryBadge category={actionItem.category} />
                </div>
              </div>
            </div>

            {/* 右：ボタン（上下中央） */}
            <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
              <IconBtn title="編集" onClick={() => setEditing(true)}>
                ✏️
              </IconBtn>

              {actionItem.is_active ? (
                <IconBtn
                  title="アーカイブ"
                  onClick={async () => {
                    if (!confirm("この行動をアーカイブしますか？")) return;
                    await archiveAction(actionItem.id);
                  }}
                >
                  📦
                </IconBtn>
              ) : (
                <IconBtn title="復帰" onClick={() => unarchiveAction(actionItem.id)}>
                  ♻️
                </IconBtn>
              )}

              <IconBtn
                title="完全削除"
                danger
                onClick={async () => {
                  if (!confirm("完全削除しますか？")) return;
                  await deleteActionForever(actionItem.id);
                }}
              >
                🗑️
              </IconBtn>
            </div>
          </div>
        );
      }


      return (
        <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 10 }}>
          <div style={{ display: "grid", gap: 8 }}>
            <label>
              種類
              <input value={kind} onChange={(e) => setKind(e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} />
            </label>

            <label>
              カテゴリ
              <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: "100%", boxSizing: "border-box" }}>
                <option value="hobby">趣味</option>
                <option value="recovery">回復</option>
                <option value="growth">成長</option>
                <option value="lifework">生活</option>
                <option value="other">その他</option>
              </select>
            </label>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={async () => {
                  const finalKind = (kind.trim() || initialKind).trim();
                  await onSave({ category, kind: finalKind as any, title: finalKind } as any);
                  setEditing(false);
                }}
                disabled={!kind.trim()}
              >
                保存
              </button>

              <button
                onClick={() => {
                  setKind(initialKind);
                  setCategory(actionItem.category);
                  setEditing(false);
                }}
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <>
        <Card style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>行動（種類）追加</h2>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setMsg("");
              try {
                const finalKind = kind.trim();
                if (!finalKind) return;

                await addAction({ kind: finalKind, category } as any);
                setKind("");
                setCategory("other");
                setMsg("行動を追加しました。");
              } catch (err: any) {
                setMsg(err?.message ?? "追加エラー");
              }
            }}
            style={{ display: "grid", gap: 10 }}
          >
            <label>
              種類
              <input
                value={kind}
                onChange={(e) => setKind(e.target.value)}
                style={{ width: "100%", boxSizing: "border-box" }}
                placeholder="行動の種類を入力"
              />
            </label>

            <label>
              カテゴリ
              <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: "100%", boxSizing: "border-box" }}>
                <option value="hobby">趣味</option>
                <option value="recovery">回復</option>
                <option value="growth">成長</option>
                <option value="lifework">生活</option>
                <option value="other">その他</option>
              </select>
            </label>

            <button type="submit" disabled={!kind.trim()}>
              追加
            </button>
          </form>
        </Card>

        <Card style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>登録済みの行動の種類（編集）</h3>

          {actions.length === 0 ? (
            <p>まだありません</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {actions.map((a) => (
                <ActionRow
                  key={a.id}
                  actionItem={a}
                  onSave={async (patch) => {
                    try {
                      setMsg("");
                      const k = (patch as any).kind;
                      const finalPatch = typeof k === "string" ? ({ ...(patch as any), title: k } as any) : patch;
                      await updateAction(a.id, finalPatch as any);
                      setMsg("行動を更新しました。");
                    } catch (e: any) {
                      setMsg(e?.message ?? "更新エラー");
                    }
                  }}
                />
              ))}
            </div>
          )}
        </Card>
      </>
    );
  }

  return (
    <>
      <Card style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>登録</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setRegisterTab("habit")} disabled={registerTab === "habit"}>
            習慣
          </button>
          <button onClick={() => setRegisterTab("oneoff")} disabled={registerTab === "oneoff"}>
            タスク
          </button>
          <button onClick={() => setRegisterTab("action")} disabled={registerTab === "action"}>
            行動
          </button>
        </div>
      </Card>

      {registerTab === "habit" && <TasksView fixedType="habit" title="習慣" />}
      {registerTab === "oneoff" && <TasksView fixedType="oneoff" title="タスク" />}
      {registerTab === "action" && <ActionsView />}
    </>
  );
}
