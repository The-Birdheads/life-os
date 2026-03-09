import React, { useState } from "react";
import type { Action, Task } from "../lib/types";
import { sqliteRepo } from "../lib/db/instance";

import Card from "../components/ui/Card";

import CategoryBadge from "../components/badges/CategoryBadge";
import PriorityBadge from "../components/badges/PriorityBadge";
import VolBar from "../components/badges/VolBar";
import SegmentedBar from "../components/ui/SegmentedBar";
import SectionTitle from "../components/ui/SectionTitle";
import { space } from "../lib/ui/spacing";
import Checkbox from "../components/ui/Checkbox";
import Select from "../components/ui/Select";
import TextInput from "../components/ui/TextInput";
import Slider from "../components/ui/Slider";
import PrimaryBtn from "../components/ui/PrimaryBtn";
import SecondaryBtn from "../components/ui/SecondaryBtn";
import { theme } from "../lib/ui/theme";

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

    cardStyle: React.CSSProperties;

    loadTodayEntries: () => Promise<void>;
    loadBase: () => Promise<void>;
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
    cardStyle,
    loadTodayEntries,
    loadBase,
}: Props) {
    // ✅ Segmented filter（コンポーネント内）
    const [filter, setFilter] = useState<Filter>("all");
    const [editingItem, setEditingItem] = useState<{ type: "habit" | "oneoff" | "action"; item: any } | null>(null);

    const activeHabits = tasks.filter((t) => t.is_active && t.task_type === "habit");
    const activeOneoffs = tasks.filter((t) => t.is_active && t.task_type === "oneoff");

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
                await sqliteRepo.upsertTaskEntry({
                    user_id: userId,
                    day,
                    task_id: taskId,
                    status: "done"
                } as any);
            } else {
                // To un-check, we change status or delete. Since we don't have a direct delete exposed in the interface for task_entries, we can upsert with a different status or we can add delete to the repo. Let's add delete to repo later, for now let's just use "todo" status as unchecked.
                await sqliteRepo.upsertTaskEntry({
                    user_id: userId,
                    day,
                    task_id: taskId,
                    status: "todo"
                } as any);
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
        columnGap: 14, // 左からチェックボックスまでの余白(約12px)と同等の余白をタイトルとの間にも空ける
        alignItems: "start",
    };

    // ✅ アイテム行の沈み込みと色反転（追加要望7＆8）
    const rowCard = (accentColor: string | undefined, checked: boolean = false): React.CSSProperties => {
        const isDone = checked;
        return {
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: "10px 12px",

            // Doneなら背景をテーマ色に、そうでなければ白系(var(--card))
            background: isDone && accentColor ? accentColor : "var(--card)",
            color: isDone && accentColor ? "#ffffff" : "var(--text)",

            // 未完了なら右下に影を持たせる、完了なら影を消して沈み込む位置へ
            boxShadow: !isDone && accentColor ? `3px 3px 0px ${accentColor} 40` : "0 1px 2px rgba(0,0,0,0.02)",
            transform: isDone ? "translate(3px, 3px)" : "translate(0, 0)",

            transition: "all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
        };
    };

    const titleStyle = (checked: boolean, accentColor?: string): React.CSSProperties => ({
        opacity: checked ? (accentColor ? 1 : 0.6) : 1, // 色付き背景ならopacity下げない
        minWidth: 0,
        wordBreak: "break-word",
        lineHeight: 1.3,
        fontWeight: 600,
        textDecoration: checked && !accentColor ? "line-through" : "none", // （通常は反転で表現）
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

        // update action entry via repo logic
        await sqliteRepo.updateActionEntry(userId, entryId, updateObj);

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



    function ActionEntryRow({ entry }: { entry: any }) {
        const a = actions.find((x) => x.id === entry.action_id);

        return (
            <li>
                <div
                    style={{
                        ...rowCard(theme.action, true), // 行動は常にDone扱いとして反転＋沈み込み
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                        alignItems: "center",
                        cursor: "pointer",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.01)")}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                    onClick={() => setEditingItem({ type: "action", item: entry })}
                >
                    <div style={{ minWidth: 0, display: "grid", gap: 4 }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0 }}>
                            <div style={{ fontWeight: 700, minWidth: 0, wordBreak: "break-word", lineHeight: 1.3 }}>
                                {a ? (a.kind) : "（不明）"}
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
                </div>
            </li>
        );
    }

    function EditItemModal() {
        if (!editingItem) return null;

        const { type, item } = editingItem;

        const [title, setTitle] = useState(item.title || "");
        const [priority, setPriority] = useState(item.priority ?? 3);
        const [volume, setVolume] = useState(item.volume ?? 5);
        const [dueDate, setDueDate] = useState(item.due_date || "");

        const [actionId, setActionId] = useState(item.action_id || "");
        const [note, setNote] = useState(item.note || "");

        const overlayStyle: React.CSSProperties = {
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)",
            zIndex: 100, display: "flex", justifyContent: "center", alignItems: "flex-end",
            animation: "fadeIn 0.2s ease",
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

        const handleSave = async (e: React.FormEvent) => {
            e.preventDefault();
            setMsg("");
            try {
                if (type === "action") {
                    await updateActionEntry(item.id, {
                        action_id: actionId,
                        note: note.trim() ? note.trim() : null,
                        volume: Math.min(10, Math.max(1, Number(volume))),
                    });
                } else {
                    await sqliteRepo.updateTask(userId, item.id, {
                        title: title.trim(),
                        priority,
                        volume,
                        due_date: type === "oneoff" && dueDate ? dueDate : null,
                    } as any);
                    await loadBase();
                }
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
                if (type === "action") {
                    await sqliteRepo.deleteActionEntry(userId, item.id);
                    await loadTodayEntries();
                } else {
                    await sqliteRepo.deleteTask(userId, item.id);
                    await loadBase();
                }
                setEditingItem(null);
                setMsg("削除しました。");
            } catch (err: any) {
                setMsg(err?.message ?? "削除エラー");
            }
        };

        const modalTitle = type === "habit" ? "習慣の編集" : type === "oneoff" ? "タスクの編集" : "行動ログの編集";
        const activeActions = actions.filter((a) => a.is_active && !a.is_hidden);

        return (
            <div style={overlayStyle} onClick={() => setEditingItem(null)}>
                <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                    <button style={closeBtnStyle} onClick={() => setEditingItem(null)}>×</button>
                    <h2 style={{ marginTop: 0, marginBottom: 20, fontSize: 20 }}>{modalTitle}</h2>

                    <form onSubmit={handleSave} style={{ display: "grid", gap: 16 }}>
                        {(type === "habit" || type === "oneoff") && (
                            <>
                                <label>
                                    タイトル
                                    <TextInput value={title} onChange={(e) => setTitle(e.target.value)} fullWidth required />
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
                            </>
                        )}

                        {type === "action" && (
                            <>
                                <label>
                                    行動の種類
                                    <Select value={actionId} onChange={(e) => setActionId(e.target.value)} fullWidth required>
                                        {activeActions.length === 0 && <option value="">（表示中の行動がありません）</option>}
                                        {activeActions.findIndex(a => a.id === actionId) === -1 && item.action_id === actionId && (
                                            <option value={actionId}>（現在の種類 - 非表示または削除済）</option>
                                        )}
                                        {activeActions.map((a) => (
                                            <option key={a.id} value={a.id}>{a.kind}</option>
                                        ))}
                                    </Select>
                                </label>
                                <label>
                                    詳細
                                    <TextInput value={note} onChange={(e) => setNote(e.target.value)} fullWidth placeholder="自由入力" />
                                </label>
                                <label>
                                    ボリューム（1-10）: <b>{volume}</b>
                                    <Slider min="1" max="10" step="1" value={volume} onChange={(e) => setVolume(Number(e.target.value))} fullWidth />
                                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.7 }}>
                                        <span>1</span>
                                        <span>5</span>
                                        <span>10</span>
                                    </div>
                                </label>
                            </>
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

    return (
        <>
            <style>{`
@keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
}
@keyframes slideUp {
                    from { transform: translateY(100 %); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
}
`}</style>
            {/* ✅ サブバー（segmented bar） */}
            <SegmentedBar
                items={segmentedItems as any}
                value={filter}
                onChange={setFilter}
                ariaLabel="記録の表示切り替え"
                stickyTop={56} /* 追加要望10: ヘッダー下に追従固定 */
            />

            {/* ✅ カード群（フィルタに応じて出し分け） */}
            <div style={{ display: "grid", gap: space.lg, marginTop: space.md }}>
                {(filter === "all" || filter === "habit") && (
                    <div>
                        <SectionTitle title="習慣" icon="🔁" accentColor={theme.habit} style={{ marginBottom: 8 }} />
                        <Card style={cardStyle}>
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
                                                <div
                                                    style={{ ...rowLabelStyle, ...rowCard(theme.habit, checked), cursor: "pointer" }}
                                                    onMouseEnter={(e) => { if (!checked) e.currentTarget.style.transform = "translate(0,0) scale(1.01)"; }}
                                                    onMouseLeave={(e) => { if (!checked) e.currentTarget.style.transform = "translate(0,0) scale(1)"; }}
                                                    onClick={() => setEditingItem({ type: "habit", item: t })}
                                                >
                                                    <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", alignSelf: "center" }}>
                                                        <Checkbox
                                                            checked={checked}
                                                            color={theme.habit}
                                                            onChange={(e) => toggleTaskDone(t.id, e.target.checked)}
                                                        />
                                                    </div>

                                                    <div style={{ display: "grid", gap: 4 }}>
                                                        <div style={titleStyle(checked, theme.habit)}>{t.title}</div>

                                                        <div style={metaLineStyle}>
                                                            <PriorityBadge value={(t as any).priority} />
                                                            <VolBar value={(t as any).volume} isReverse={checked || isPastDone} />
                                                            {isHidden && (checked || isPastDone) ? (
                                                                <small style={{ opacity: 0.6 }}>（非表示・履歴のため表示）</small>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </Card>
                    </div>
                )}

                {(filter === "all" || filter === "task") && (
                    <div>
                        <SectionTitle title="タスク" icon="✅" accentColor={theme.task} style={{ marginBottom: 8 }} />
                        <Card style={cardStyle}>
                            {sortedOneoffs.length === 0 ? (
                                <p>タスクがありません（タスクタブで追加）</p>
                            ) : (
                                <ul style={{ listStyle: "none", paddingLeft: 0, margin: 0, display: "grid", gap: 10 }}>
                                    {sortedOneoffs.map((t) => {
                                        const checked = doneTaskIds.has(t.id);
                                        const isHidden = !!(t as any).is_hidden;

                                        return (
                                            <li key={t.id}>
                                                <div
                                                    style={{ ...rowLabelStyle, ...rowCard(theme.task, checked), cursor: "pointer" }}
                                                    onMouseEnter={(e) => { if (!checked) e.currentTarget.style.transform = "translate(0,0) scale(1.01)"; }}
                                                    onMouseLeave={(e) => { if (!checked) e.currentTarget.style.transform = "translate(0,0) scale(1)"; }}
                                                    onClick={() => setEditingItem({ type: "oneoff", item: t })}
                                                >
                                                    <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", alignSelf: "center" }}>
                                                        <Checkbox
                                                            checked={checked}
                                                            color={theme.task}
                                                            onChange={(e) => toggleTaskDone(t.id, e.target.checked)}
                                                        />
                                                    </div>

                                                    <div style={{ display: "grid", gap: 4 }}>
                                                        <div style={titleStyle(checked, theme.task)}>{t.title}</div>

                                                        <div style={metaLineStyle}>
                                                            <PriorityBadge value={(t as any).priority} />
                                                            <VolBar value={(t as any).volume} isReverse={checked} />
                                                            {isHidden && checked ? <small style={{ opacity: 0.6 }}>（非表示・当日完了のため表示）</small> : null}
                                                        </div>

                                                        {t.due_date ? (
                                                            <div style={dueStyle}>
                                                                <span style={{ marginRight: 4 }}>期限：</span>
                                                                {t.due_date}
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </Card>
                    </div>
                )}

                {(filter === "all" || filter === "action") && (
                    <div>


                        <SectionTitle title="行動" icon="⚡" accentColor={theme.action} style={{ marginBottom: 8 }} />
                        <Card style={cardStyle}>
                            <div style={{ marginTop: 0 }}>
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
                    </div>
                )}
            </div>

            {editingItem && <EditItemModal />}
        </>
    );
}
