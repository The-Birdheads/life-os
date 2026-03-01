import React, { useState, useEffect } from "react";
import type { Action, Task } from "../../../lib/types";
import { theme } from "../../../lib/ui/theme";
import Card from "../../ui/Card";
import IconBtn from "../../ui/IconBtn";
import PriorityBadge from "../../badges/PriorityBadge";
import VolBar from "../../badges/VolBar";
import CategoryBadge from "../../badges/CategoryBadge";
import PrimaryBtn from "../../ui/PrimaryBtn";
import SecondaryBtn from "../../ui/SecondaryBtn";
import SegmentedBar from "../../ui/SegmentedBar";
import TextInput from "../../ui/TextInput";
import Slider from "../../ui/Slider";
import Select from "../../ui/Select";

type SubTab = "shown" | "hidden";
const subTabItems = [
    { key: "shown", label: "表示中" },
    { key: "hidden", label: "非表示" },
] as const;

type Props = {
    openModal: "habit" | "oneoff" | "action" | null;
    setOpenModal: (m: "habit" | "oneoff" | "action" | null) => void;
    userId: string;
    day: string;
    tasks: Task[];
    actions: Action[];
    doneTaskIdsAnyDay: Set<string>;
    setMsg: (s: string) => void;
    supabase: any;
    loadBase: () => Promise<void>;
    loadTodayEntries: () => Promise<void>;
};

export default function RegisterModals({
    openModal,
    setOpenModal,
    userId,
    day,
    tasks,
    actions,
    doneTaskIdsAnyDay,
    setMsg,
    supabase,
    loadBase,
    loadTodayEntries,
}: Props) {
    // --- Action Category Modal State ---
    const [categoryModalOpen, setCategoryModalOpen] = useState(false);

    // --- DB Helpers ---
    async function addTask(form: { title: string; task_type: "habit" | "oneoff"; priority: number; volume: number; due_date: string | null; is_hidden: boolean; }) {
        const { error } = await supabase.from("tasks").insert({
            user_id: userId,
            title: form.title,
            task_type: form.task_type,
            priority: Math.min(5, Math.max(1, form.priority)),
            volume: Math.min(10, Math.max(1, form.volume)),
            due_date: form.task_type === "oneoff" ? form.due_date : null,
            is_hidden: form.is_hidden,
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

    async function addAction(form: { kind: string; category: string; is_hidden?: boolean }) {
        const { error } = await supabase.from("actions").insert({
            user_id: userId,
            kind: form.kind,
            category: form.category,
            is_hidden: form.is_hidden ?? false,
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

    // --- Styles ---
    const overlayStyle: React.CSSProperties = {
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)",
        zIndex: 100, display: "flex", justifyContent: "center", alignItems: "flex-end",
        transition: "opacity 0.2s ease",
    };
    const modalStyle: React.CSSProperties = {
        width: "100%", maxWidth: 600, maxHeight: "90vh",
        background: "var(--bg)", borderTopLeftRadius: 20, borderTopRightRadius: 20,
        padding: "24px 16px", overflowY: "auto",
        boxShadow: "0 -4px 20px rgba(0,0,0,0.15)",
        animation: "slideUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.2)",
    };
    const closeBtnStyle: React.CSSProperties = {
        position: "absolute", top: 16, right: 16, border: "none", background: "rgba(0,0,0,0.05)",
        width: 32, height: 32, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", fontSize: 20, lineHeight: 1, color: "var(--text)", paddingBottom: 2,
    };
    const rowCardStyle: React.CSSProperties = {
        border: "1px solid var(--border)", borderRadius: 12, padding: "10px 12px",
        background: "var(--card)", display: "flex", justifyContent: "space-between",
        gap: 10, alignItems: "center", width: "100%", boxSizing: "border-box",
    };

    // --- Internal Components ---
    function TaskListModal({ type, title }: { type: "habit" | "oneoff"; title: string }) {
        const [subTab, setSubTab] = useState<SubTab>("shown");
        const [adding, setAdding] = useState(false);
        const [editingItem, setEditingItem] = useState<Task | null>(null);

        // Add Form State
        const [newTitle, setNewTitle] = useState("");
        const [priority, setPriority] = useState(3);
        const [volume, setVolume] = useState(5);
        const [dueDate, setDueDate] = useState("");

        const shownTasks = tasks.filter((t) => t.task_type === type);
        const baseList = shownTasks.filter((t) => {
            if (t.task_type === "oneoff") return !doneTaskIdsAnyDay.has(t.id);
            return true;
        });
        const listForRender = baseList.filter((t) => {
            const hidden = !!(t as any).is_hidden;
            return subTab === "shown" ? !hidden : hidden;
        });

        return (
            <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                <button style={closeBtnStyle} onClick={() => setOpenModal(null)}>×</button>
                <h2 style={{ marginTop: 0, marginBottom: 16, fontSize: 20 }}>{title}の登録</h2>

                <SegmentedBar items={subTabItems as any} value={subTab} onChange={(v: any) => { setSubTab(v); setAdding(false); }} ariaLabel="表示切り替え" />

                <div style={{ marginTop: 16, marginBottom: 16 }}>
                    {!adding ? (
                        <PrimaryBtn fullWidth onClick={() => setAdding(true)}>＋ 新しい{title}を追加</PrimaryBtn>
                    ) : (
                        <Card style={{ padding: 16 }}>
                            <form onSubmit={async (e) => {
                                e.preventDefault();
                                setMsg("");
                                try {
                                    await addTask({
                                        title: newTitle, task_type: type, priority, volume,
                                        due_date: type === "oneoff" && dueDate ? dueDate : null,
                                        is_hidden: subTab === "hidden", // 追加時のタブ状態で決定
                                    });
                                    setNewTitle(""); setDueDate(""); setPriority(3); setVolume(5); setAdding(false);
                                    setMsg("追加しました。");
                                } catch (err: any) {
                                    setMsg(err?.message ?? "追加エラー");
                                }
                            }} style={{ display: "grid", gap: 12 }}>
                                <h3 style={{ margin: 0, fontSize: 16 }}>新規追加 ({subTab === "hidden" ? "非表示" : "表示中"})</h3>
                                <label>
                                    タイトル
                                    <TextInput value={newTitle} onChange={(e) => setNewTitle(e.target.value)} fullWidth required />
                                </label>
                                <label>
                                    優先度（1-5）: <b>{priority}</b>
                                    <Slider min="1" max="5" step="1" value={priority} onChange={(e) => setPriority(Number(e.target.value))} fullWidth />
                                </label>
                                <label>
                                    ボリューム（1-10）: <b>{volume}</b>
                                    <Slider min="1" max="10" step="1" value={volume} onChange={(e) => setVolume(Number(e.target.value))} fullWidth />
                                </label>
                                {type === "oneoff" && (
                                    <label>
                                        期限（任意）
                                        <TextInput type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} fullWidth />
                                    </label>
                                )}
                                <div style={{ display: "flex", gap: 8 }}>
                                    <PrimaryBtn type="submit" disabled={!newTitle.trim()}>追加</PrimaryBtn>
                                    <SecondaryBtn onClick={() => setAdding(false)}>キャンセル</SecondaryBtn>
                                </div>
                            </form>
                        </Card>
                    )}
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                    {listForRender.length === 0 && <p style={{ opacity: 0.7, textAlign: "center", margin: "24px 0" }}>項目がありません</p>}
                    {listForRender.map(t => <TaskRow key={t.id} task={t} />)}
                </div>

                {editingItem && <TaskEditModal item={editingItem} />}
            </div>
        );

        function TaskRow({ task }: { task: Task }) {
            const isHidden = !!(task as any).is_hidden;

            return (
                <div
                    style={{ ...rowCardStyle, cursor: "pointer" }}
                    onClick={() => setEditingItem(task)}
                    onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.01)")}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                >
                    <div style={{ flex: 1, minWidth: 0, display: "grid", gap: 4 }}>
                        <div style={{ fontWeight: 700, lineHeight: 1.3, wordBreak: "break-word" }}>{task.title}</div>
                        <div style={{ opacity: 0.75, display: "flex", alignItems: "center", gap: 8 }}>
                            <PriorityBadge value={(task as any).priority} />
                            <VolBar value={(task as any).volume} />
                        </div>
                        {task.due_date && <div style={{ fontSize: 12, opacity: 0.7 }}>期限：{task.due_date}</div>}
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                        <IconBtn title={isHidden ? "表示する" : "非表示にする"} onClick={() => updateTask(task.id, { is_hidden: !isHidden } as any)}>{isHidden ? "👁️" : "🙈"}</IconBtn>
                    </div>
                </div>
            );
        }

        function TaskEditModal({ item }: { item: Task }) {
            const [tTitle, setTTitle] = useState(item.title);
            const [tPriority, setTPriority] = useState((item as any).priority ?? 3);
            const [tVolume, setTVolume] = useState((item as any).volume ?? 5);
            const [tDueDate, setTDueDate] = useState(item.due_date ?? "");

            const handleSave = async (e: React.FormEvent) => {
                e.preventDefault();
                setMsg("");
                try {
                    await updateTask(item.id, {
                        title: tTitle.trim() || item.title,
                        priority: tPriority, volume: tVolume,
                        due_date: type === "oneoff" && tDueDate ? tDueDate : null
                    } as any);
                    setEditingItem(null);
                    setMsg("更新しました。");
                } catch (err: any) {
                    setMsg(err?.message ?? "更新エラー");
                }
            };

            const handleDelete = async () => {
                if (!confirm("本当に削除しますか？")) return;
                setMsg("");
                try {
                    await deleteTaskForever(item.id);
                    setEditingItem(null);
                    setMsg("削除しました。");
                } catch (err: any) {
                    setMsg(err?.message ?? "削除エラー");
                }
            };

            return (
                <div style={{ ...overlayStyle, zIndex: 110 }} onClick={() => setEditingItem(null)}>
                    <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                        <button style={closeBtnStyle} onClick={() => setEditingItem(null)}>×</button>
                        <h2 style={{ marginTop: 0, marginBottom: 20, fontSize: 20 }}>{title}の編集</h2>

                        <form onSubmit={handleSave} style={{ display: "grid", gap: 16 }}>
                            <label>
                                タイトル
                                <TextInput value={tTitle} onChange={(e) => setTTitle(e.target.value)} fullWidth required />
                            </label>
                            <label>
                                優先度（1-5）: <b>{tPriority}</b>
                                <Slider min="1" max="5" step="1" value={tPriority} onChange={(e) => setTPriority(Number(e.target.value))} fullWidth />
                            </label>
                            <label>
                                ボリューム（1-10）: <b>{tVolume}</b>
                                <Slider min="1" max="10" step="1" value={tVolume} onChange={(e) => setTVolume(Number(e.target.value))} fullWidth />
                            </label>
                            {type === "oneoff" && (
                                <label>
                                    期限（任意）
                                    <TextInput type="date" value={tDueDate} onChange={(e) => setTDueDate(e.target.value)} fullWidth />
                                </label>
                            )}

                            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                                <div style={{ flex: 1 }}>
                                    <PrimaryBtn type="submit" fullWidth>保存</PrimaryBtn>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <SecondaryBtn type="button" onClick={() => setEditingItem(null)} fullWidth>キャンセル</SecondaryBtn>
                                </div>
                            </div>
                            <div style={{ textAlign: "center", marginTop: 8 }}>
                                <button type="button" onClick={handleDelete} style={{ background: "none", border: "none", color: theme.danger, cursor: "pointer", textDecoration: "underline", fontSize: 14 }}>
                                    このアイテムを削除
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            );
        }
    }

    function ActionCategoryModal() {
        const [subTab, setSubTab] = useState<SubTab>("shown");
        const [adding, setAdding] = useState(false);
        const [editingItem, setEditingItem] = useState<Action | null>(null);

        const [kind, setKind] = useState("");
        const [category, setCategory] = useState("other");

        const shownActions = actions.filter((a) => !a.is_hidden);
        const hiddenActions = actions.filter((a) => a.is_hidden);
        const listForRender = subTab === "shown" ? shownActions : hiddenActions;

        return (
            <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                <button style={closeBtnStyle} onClick={() => setCategoryModalOpen(false)}>×</button>
                <h2 style={{ marginTop: 0, marginBottom: 16, fontSize: 20 }}>行動の種類の管理</h2>

                <SegmentedBar items={subTabItems as any} value={subTab} onChange={(v: any) => { setSubTab(v); setAdding(false); }} ariaLabel="表示切り替え" />

                <div style={{ marginTop: 16, marginBottom: 16 }}>
                    {!adding ? (
                        <PrimaryBtn fullWidth onClick={() => setAdding(true)}>＋ 新しい行動の種類を追加</PrimaryBtn>
                    ) : (
                        <Card style={{ padding: 16 }}>
                            <form onSubmit={async (e) => {
                                e.preventDefault();
                                setMsg("");
                                try {
                                    const finalKind = kind.trim();
                                    if (!finalKind) return;
                                    await addAction({ kind: finalKind, category, is_hidden: subTab === "hidden" });
                                    setKind(""); setCategory("other"); setAdding(false);
                                    setMsg("行動を追加しました。");
                                } catch (err: any) {
                                    setMsg(err?.message ?? "追加エラー");
                                }
                            }} style={{ display: "grid", gap: 12 }}>
                                <h3 style={{ margin: 0, fontSize: 16 }}>新規追加 ({subTab === "hidden" ? "非表示" : "表示中"})</h3>
                                <label>
                                    種類
                                    <TextInput value={kind} onChange={(e) => setKind(e.target.value)} fullWidth required />
                                </label>
                                <label>
                                    カテゴリ
                                    <Select value={category} onChange={(e) => setCategory(e.target.value)} fullWidth>
                                        <option value="hobby">趣味</option>
                                        <option value="recovery">回復</option>
                                        <option value="growth">成長</option>
                                        <option value="lifework">生活</option>
                                        <option value="other">その他</option>
                                    </Select>
                                </label>
                                <div style={{ display: "flex", gap: 8 }}>
                                    <PrimaryBtn type="submit" disabled={!kind.trim()}>追加</PrimaryBtn>
                                    <SecondaryBtn onClick={() => setAdding(false)}>キャンセル</SecondaryBtn>
                                </div>
                            </form>
                        </Card>
                    )}
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                    {listForRender.length === 0 && <p style={{ opacity: 0.7, textAlign: "center", margin: "24px 0" }}>項目がありません</p>}
                    {listForRender.map(a => <ActionRow key={a.id} actionItem={a} />)}
                </div>

                {editingItem && <ActionEditModal item={editingItem} />}
            </div>
        );

        function ActionRow({ actionItem }: { actionItem: Action }) {
            const isHidden = !!actionItem.is_hidden;
            return (
                <div
                    style={{ ...rowCardStyle, cursor: "pointer" }}
                    onClick={() => setEditingItem(actionItem)}
                    onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.01)")}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                >
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <div style={{ fontWeight: 700 }}>{(actionItem as any).kind}</div>
                        <CategoryBadge category={actionItem.category} />
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                        <IconBtn title={isHidden ? "表示する" : "非表示にする"} onClick={() => updateAction(actionItem.id, { is_hidden: !isHidden } as any)}>{isHidden ? "👁️" : "🙈"}</IconBtn>
                    </div>
                </div>
            );
        }

        function ActionEditModal({ item }: { item: Action }) {
            const [editKind, setEditKind] = useState((item as any).kind || "");
            const [editCategory, setEditCategory] = useState(item.category || "other");

            const handleSave = async (e: React.FormEvent) => {
                e.preventDefault();
                setMsg("");
                try {
                    const finalKind = editKind.trim();
                    if (!finalKind) return;
                    await updateAction(item.id, { kind: finalKind, category: editCategory } as any);
                    setEditingItem(null);
                    setMsg("更新しました。");
                } catch (err: any) {
                    setMsg(err?.message ?? "更新エラー");
                }
            };

            const handleDelete = async () => {
                if (!confirm("本当に削除しますか？\n(既に記録しているログにも影響が出る場合があります)")) return;
                setMsg("");
                try {
                    await deleteActionForever(item.id);
                    setEditingItem(null);
                    setMsg("削除しました。");
                } catch (err: any) {
                    setMsg(err?.message ?? "削除エラー");
                }
            };

            return (
                <div style={{ ...overlayStyle, zIndex: 110 }} onClick={() => setEditingItem(null)}>
                    <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                        <button style={closeBtnStyle} onClick={() => setEditingItem(null)}>×</button>
                        <h2 style={{ marginTop: 0, marginBottom: 20, fontSize: 20 }}>行動の種類の編集</h2>

                        <form onSubmit={handleSave} style={{ display: "grid", gap: 16 }}>
                            <label>
                                種類
                                <TextInput value={editKind} onChange={(e) => setEditKind(e.target.value)} fullWidth required />
                            </label>
                            <label>
                                カテゴリ
                                <Select value={editCategory} onChange={(e) => setEditCategory(e.target.value)} fullWidth>
                                    <option value="hobby">趣味</option>
                                    <option value="recovery">回復</option>
                                    <option value="growth">成長</option>
                                    <option value="lifework">生活</option>
                                    <option value="other">その他</option>
                                </Select>
                            </label>

                            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                                <div style={{ flex: 1 }}>
                                    <PrimaryBtn type="submit" fullWidth>保存</PrimaryBtn>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <SecondaryBtn type="button" onClick={() => setEditingItem(null)} fullWidth>キャンセル</SecondaryBtn>
                                </div>
                            </div>
                            <div style={{ textAlign: "center", marginTop: 8 }}>
                                <button type="button" onClick={handleDelete} style={{ background: "none", border: "none", color: theme.danger, cursor: "pointer", textDecoration: "underline", fontSize: 14 }}>
                                    この種類を削除
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            );
        }
    }

    function ActionEntryModal() {
        const activeActions = actions.filter((a) => (a as any).is_active !== false && !a.is_hidden);
        const [actionId, setActionId] = useState<string>(activeActions[0]?.id ?? "");
        const [detail, setDetail] = useState<string>("");
        const [volume, setVolume] = useState<number>(5);

        useEffect(() => {
            if (!actionId && activeActions.length > 0) {
                setActionId(activeActions[0].id);
            }
        }, [activeActions.length, actionId]);

        return (
            <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                <button style={closeBtnStyle} onClick={() => setOpenModal(null)}>×</button>
                <div style={{ marginBottom: 16 }}>
                    <h2 style={{ margin: 0, fontSize: 20 }}>行動の登録</h2>
                </div>

                <form onSubmit={async (e) => {
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
                        setOpenModal(null);
                        setMsg("行動ログを追加しました。");
                    } catch (err: any) {
                        setMsg(err?.message ?? "追加エラー");
                    }
                }} style={{ display: "grid", gap: 12 }}>
                    <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                            <label style={{ margin: 0, fontWeight: 600 }}>行動の種類</label>
                            <button type="button" onClick={() => setCategoryModalOpen(true)} style={{ background: "transparent", border: "none", color: theme.primary, textDecoration: "underline", fontSize: 13, cursor: "pointer", padding: 0 }}>種類の管理</button>
                        </div>
                        <Select value={actionId} onChange={(e) => setActionId(e.target.value)} fullWidth required>
                            {activeActions.length === 0 && <option value="">(まずは種類を追加してください)</option>}
                            {activeActions.map((a) => (
                                <option key={a.id} value={a.id}>{(a as any).kind}</option>
                            ))}
                        </Select>
                    </div>
                    <label>
                        詳細（任意）
                        <TextInput value={detail} onChange={(e) => setDetail(e.target.value)} fullWidth placeholder="自由入力" />
                    </label>
                    <label>
                        ボリューム（1-10）: <b>{volume}</b>
                        <Slider min="1" max="10" step="1" value={volume} onChange={(e) => setVolume(Number(e.target.value))} fullWidth />
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.7 }}>
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => <span key={n}>{n}</span>)}
                        </div>
                    </label>
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <PrimaryBtn type="submit" disabled={!actionId || activeActions.length === 0} fullWidth>行動ログを追加</PrimaryBtn>
                    </div>
                </form>
            </div>
        );
    }

    // --- Render logic ---
    if (!openModal && !categoryModalOpen) return null;

    return (
        <>
            <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
            <div style={overlayStyle} onClick={() => {
                if (categoryModalOpen) setCategoryModalOpen(false);
                else setOpenModal(null);
            }}>
                <div style={{ position: "relative", width: "100%", maxWidth: 720, margin: "0 auto", display: "flex", justifyContent: "center" }}>
                    {categoryModalOpen ? (
                        <ActionCategoryModal />
                    ) : openModal === "habit" ? (
                        <TaskListModal type="habit" title="習慣" />
                    ) : openModal === "oneoff" ? (
                        <TaskListModal type="oneoff" title="タスク" />
                    ) : openModal === "action" ? (
                        <ActionEntryModal />
                    ) : null}
                </div>
            </div>
        </>
    );
}
