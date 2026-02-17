import { useEffect, useState } from "react";
import type { Action, Task } from "../lib/types";

import Card from "../components/ui/Card";
import IconBtn from "../components/ui/IconBtn";

import CategoryBadge from "../components/badges/CategoryBadge";
import PriorityBadge from "../components/badges/PriorityBadge";
import VolBar from "../components/badges/VolBar";
import PrimaryBtn from "../components/ui/PrimaryBtn";
import SecondaryBtn from "../components/ui/SecondaryBtn";
import SegmentedBar from "../components/ui/SegmentedBar";
import SectionTitle from "../components/ui/SectionTitle";

import { space } from "../lib/ui/spacing";

type RegisterTab = "habit" | "oneoff" | "action";

const registerItems = [
  { key: "habit", label: "習慣" },
  { key: "oneoff", label: "タスク" },
  { key: "action", label: "行動" },
] as const;

type SubTab = "shown" | "hidden";
const subTabItems = [
  { key: "shown", label: "表示中" },
  { key: "hidden", label: "非表示" },
] as const;

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
    alignItems: "center",
    width: "100%",
    boxSizing: "border-box",
  };

  const metaLine: React.CSSProperties = {
    opacity: 0.75,
    display: "flex",
    alignItems: "center",
    gap: 8,
    paddingLeft: 4,
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

    // ✅ 表示中 / 非表示 サブタブ（SegmentedBar化）
    const [subTab, setSubTab] = useState<SubTab>("shown");

    // 対象タイプだけ
    const shownTasks = tasks.filter((t) => t.task_type === fixedType);

    // ✅ oneoffは「過去に完了済み」なら表示しない
    const baseList = shownTasks.filter((t) => {
      if (t.task_type === "oneoff") return !doneTaskIdsAnyDay.has(t.id);
      return true;
    });

    // ✅ サブタブで表示切替（is_hidden）
    const listForRender = baseList.filter((t) => {
      const hidden = !!(t as any).is_hidden;
      return subTab === "shown" ? !hidden : hidden;
    });

    function TaskRow({ task, onSave }: { task: Task; onSave: (patch: Partial<Task>) => Promise<void> }) {
      const [editing, setEditing] = useState(false);

      const [title, setTitle] = useState(task.title);
      const [priority, setPriority] = useState<number>((task as any).priority ?? 3);
      const [volume, setVolume] = useState<number>((task as any).volume ?? 5);
      const [dueDate, setDueDate] = useState<string>(task.due_date ?? "");

      const isHidden = !!(task as any).is_hidden;

      useEffect(() => {
        setTitle(task.title);
        setPriority((task as any).priority ?? 3);
        setVolume((task as any).volume ?? 5);
        setDueDate(task.due_date ?? "");
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [task.id, task.title, (task as any).priority, (task as any).volume, task.due_date]);

      if (!editing) {
        return (
          <div style={rowCard}>
            {/* 左：3行（タイトル / 優先度+ボリューム / 期限） */}
            <div style={{ flex: 1, minWidth: 0, display: "grid", gap: 4 }}>
              <div style={titleLine}>{task.title}</div>

              <div style={metaLine}>
                <PriorityBadge value={(task as any).priority} />
                <VolBar value={(task as any).volume} />
              </div>

              {task.due_date ? (
                <div style={{ ...metaLine, opacity: 0.7 }}>
                  <span style={smallLabel}>期限：</span>
                  <span style={smallLabel}>{task.due_date}</span>
                </div>
              ) : null}
            </div>

            {/* 右：ボタン */}
            <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
              <IconBtn title="編集" onClick={() => setEditing(true)}>
                ✏️
              </IconBtn>

              {isHidden ? (
                <IconBtn
                  title="表示する"
                  onClick={async () => {
                    await updateTask(task.id, { is_hidden: false } as any);
                  }}
                >
                  👁️
                </IconBtn>
              ) : (
                <IconBtn
                  title="非表示にする"
                  onClick={async () => {
                    await updateTask(task.id, { is_hidden: true } as any);
                  }}
                >
                  🙈
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
              <PrimaryBtn
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
              </PrimaryBtn>

              <SecondaryBtn
                onClick={() => {
                  setTitle(task.title);
                  setPriority((task as any).priority ?? 3);
                  setVolume((task as any).volume ?? 5);
                  setDueDate(task.due_date ?? "");
                  setEditing(false);
                }}
              >
                キャンセル
              </SecondaryBtn>
            </div>
          </div>
        </div>
      );
    }

    return (
      <>
        {/* 追加カード */}
        <SectionTitle title={`${title}追加`} />
        <Card style={cardStyle}>
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

            <PrimaryBtn type="submit" disabled={!newTitle.trim()} fullWidth>
              追加
            </PrimaryBtn>
          </form>
        </Card>

        {/* 登録済み（編集） */}
        <SectionTitle title={`登録済み${title}（編集）`} />
        <Card style={cardStyle}>
          {/* ✅ 表示中/非表示 サブタブ：SegmentedBar */}
          <SegmentedBar
            items={subTabItems as any}
            value={subTab}
            onChange={(v: any) => setSubTab(v as SubTab)}
            ariaLabel={`${title}の表示切り替え`}
          />

          <div style={{ height: 12 }} />

          {listForRender.length === 0 ? (
            <p style={{ opacity: 0.7 }}>
              {subTab === "shown" ? "表示中の項目はありません" : "非表示の項目はありません"}
            </p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {listForRender.map((t) => (
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
    type ActionSubTab = "shown" | "hidden";
    const [actionSubTab, setActionSubTab] = useState<ActionSubTab>("shown");
    const [kind, setKind] = useState("");
    const [category, setCategory] = useState("other");

    function ActionRow({ actionItem, onSave }: { actionItem: Action; onSave: (patch: Partial<Action>) => Promise<void> }) {
      const [editing, setEditing] = useState(false);
      const initialKind = (actionItem as any).kind;

      const [kind, setKind] = useState<string>(initialKind);
      const [category, setCategory] = useState(actionItem.category);

      useEffect(() => {
        const k = (actionItem as any).kind ;
        setKind(k);
        setCategory(actionItem.category);
      }, [actionItem]);

      if (!editing) {
        return (
          <div style={rowCard}>
            <div style={{ flex: 1, minWidth: 0, display: "grid", gap: 4 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0 }}>
                <div style={{ ...titleLine, minWidth: 0 }}>
                  {(actionItem as any).kind}
                </div>
                <div style={{ flexShrink: 0, opacity: 0.85 }}>
                  <CategoryBadge category={actionItem.category} />
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
              <IconBtn title="編集" onClick={() => setEditing(true)}>
                ✏️
              </IconBtn>

              {actionItem.is_hidden ? (
                <IconBtn
                  title="表示する"
                  onClick={async () => {
                    await updateAction(actionItem.id, { is_hidden: false } as any);
                    setMsg("行動を表示に戻しました。");
                  }}
                >
                  👁️
                </IconBtn>
              ) : (
                <IconBtn
                  title="非表示にする"
                  onClick={async () => {
                    await updateAction(actionItem.id, { is_hidden: true } as any);
                    setMsg("行動を非表示にしました。");
                  }}
                >
                  🙈
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
              <PrimaryBtn
                onClick={async () => {
                  const safeKind = (kind ?? "").trim() || (initialKind ?? "").trim();
                  if (!safeKind) {
                    setMsg("行動名を入力してください");
                    return;
                  }

                  await onSave({
                    category: category ?? "other",
                    kind: safeKind,
                  } as any);

                  setEditing(false);
                }}
              >
                保存
              </PrimaryBtn>

              <SecondaryBtn
                onClick={() => {
                  setKind(initialKind);
                  setCategory(actionItem.category);
                  setEditing(false);
                }}
              >
                キャンセル
              </SecondaryBtn>
            </div>
          </div>
        </div>
      );
    }

    const shownActions = actions.filter((a) => !a.is_hidden);
    const hiddenActions = actions.filter((a) => a.is_hidden);
    const listForRender = actionSubTab === "shown" ? shownActions : hiddenActions;

    return (
      <>
        <SectionTitle title={`行動の種類追加`} />
        <Card style={cardStyle}>
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

            <PrimaryBtn type="submit" disabled={!kind.trim()} fullWidth>
              追加
            </PrimaryBtn>
          </form>
        </Card>

        <SectionTitle title={`登録済みの行動の種類（編集）`} />
        <Card style={cardStyle}>
          {/* ✅ 表示中/非表示 サブタブ：SegmentedBar */}
          <SegmentedBar
            items={subTabItems as any}
            value={actionSubTab}
            onChange={(v: any) => setActionSubTab(v as ActionSubTab)}
            ariaLabel="行動の表示切り替え"
          />

          <div style={{ height: 12 }} />

          {listForRender.length === 0 ? (
            <p style={{ opacity: 0.7 }}>
              {actionSubTab === "shown" ? "表示中の行動はありません" : "非表示の行動はありません"}
            </p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {listForRender.map((a) => (
                <ActionRow
                  key={a.id}
                  actionItem={a}
                  onSave={async (patch) => {
                    try {
                      setMsg("");

                      await updateAction(a.id, patch as any);

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
      <div style={{ display: "grid", gap: space.lg }}>
        {/* ✅ Register上部：SegmentedBarで切替（all無し） */}
        <SegmentedBar
          items={registerItems as any}
          value={registerTab}
          onChange={(v: any) => setRegisterTab(v as RegisterTab)}
          ariaLabel="登録の表示切り替え"
        />

        {registerTab === "habit" && <TasksView fixedType="habit" title="習慣" />}
        {registerTab === "oneoff" && <TasksView fixedType="oneoff" title="タスク" />}
        {registerTab === "action" && <ActionsView />}
      </div>
    </>
  );
}
