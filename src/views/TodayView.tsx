import React, { useEffect, useState } from "react";
import type { Action, Task } from "../lib/types";
import FrequencyPicker from "../components/features/register/FrequencyPicker";
import { changeFrequencyPatch, currentFrequency, frequencyAt, frequencyLabel, isScheduledOn, isValidFrequency, type Frequency } from "../lib/mandala/frequency";
import { doneDaysByTask, weekCountStatus } from "../lib/mandala/progress";
import { weekStart } from "../lib/mandala/dates";
import { todayJST } from "../lib/day";
import { sqliteRepo } from "../lib/db/instance";
import { useUserSettings } from "../lib/context/UserSettingsContext";
import { sortTasks } from "../lib/sortTasks";

import CategoryBadge from "../components/badges/CategoryBadge";
import PriorityBadge from "../components/badges/PriorityBadge";
import VolBar from "../components/badges/VolBar";
import SegmentedBar from "../components/ui/SegmentedBar";
import SectionTitle from "../components/ui/SectionTitle";
import { RepeatIcon, CheckIcon, ZapIcon, MemoIcon, BellIcon } from "../components/ui/Icon";
import ToggleSwitch from "../components/ui/ToggleSwitch";
import { checkOrRequestNotifPermission } from "../lib/notifications";
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
    yesterdayGoal: string | null;
    setMsg: (s: string) => void;

    loadTodayEntries: () => Promise<void>;
    loadBase: () => Promise<void>;
    onAfterWrite?: () => Promise<void>;
    adHeight?: number;
    /** マンダラチャートにひもづいた習慣・タスクの id → 要素(カードに色のチップを出す) */
    goalChips?: Map<string, { label: string; color: string; element: number }>;
    /** チップをタップしたときに、目標タブのその要素を開く */
    onOpenGoal?: (element: number) => void;
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
    yesterdayGoal,
    setMsg,
    loadTodayEntries,
    loadBase,
    onAfterWrite,
    adHeight = 0,
    goalChips,
    onOpenGoal,
}: Props) {
    const goalChip = (taskId: string) => {
        const chip = goalChips?.get(taskId);
        if (!chip) return null;
        return (
            <button
                type="button"
                aria-label={`目標「${chip.label}」のチャートを開く`}
                onClick={(e) => { e.stopPropagation(); onOpenGoal?.(chip.element); }}
                style={{
                    justifySelf: "start", minHeight: 28, display: "inline-flex", alignItems: "center", gap: 6,
                    background: "#FFFFFF", color: "#0F172A", border: "1px solid #CBD5E1", borderRadius: 999,
                    padding: "2px 10px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
                }}
            >
                <span style={{ width: 9, height: 9, borderRadius: 5, background: chip.color }} />
                {chip.label}
            </button>
        );
    };
    const { sortRule, prioritizeDue } = useUserSettings();

    // ✅ Segmented filter（コンポーネント内）
    const [filter, setFilter] = useState<Filter>("all");
    const [editingItem, setEditingItem] = useState<{ type: "habit" | "oneoff" | "action"; item: any } | null>(null);

    React.useEffect(() => {
        const handleSetFilter = (e: Event) => {
            setFilter((e as CustomEvent).detail);
        };
        window.addEventListener("lifeos:setTodayFilter", handleSetFilter);
        return () => window.removeEventListener("lifeos:setTodayFilter", handleSetFilter);
    }, []);

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
        // 曜日指定で予定のない日は出さない(完了にした記録があれば出す)
        if (!isScheduledOn(frequencyAt(t, day), day)) return doneTaskIds.has(t.id);
        if (!hidden) return true;

        // 非表示習慣は選択中の日付に完了している場合のみ表示
        return doneTaskIds.has(t.id);
    };

    // 曜日指定で、選択中の日に予定のない習慣(記録タブの下に名前だけ出す)
    const offDayHabits = activeHabits.filter(
        (t) => !t.is_hidden && !isScheduledOn(frequencyAt(t, day), day) && !doneTaskIds.has(t.id)
    );

    // 週n回の習慣の「今週 n/m回」のため、選択中の日を含む週(月曜〜選択中の日)の完了日
    const [weekDoneDays, setWeekDoneDays] = useState<Map<string, Set<string>>>(new Map());
    useEffect(() => {
        let cancelled = false;
        sqliteRepo.getTaskEntriesBetween(userId, weekStart(day), day).then((entries) => {
            if (!cancelled) setWeekDoneDays(doneDaysByTask(entries));
        }).catch(() => { /* 表示だけなので失敗は無視 */ });
        return () => { cancelled = true; };
    }, [userId, day, doneTaskIds]);

    const habitFrequencyNote = (t: Task): string | null => {
        const freq = frequencyAt(t, day);
        if (freq.kind === "weekly_count") {
            // チェックは保存より先に画面へ反映されるため、選択中の日は画面の状態(doneTaskIds)を使う
            const doneDays = new Set(weekDoneDays.get(t.id));
            if (doneTaskIds.has(t.id)) doneDays.add(day); else doneDays.delete(day);
            const { done, target } = weekCountStatus(t, doneDays, day);
            return `${frequencyLabel(freq)} ・ 今週 ${done}/${target}回${done >= target ? "（達成）" : ""}`;
        }
        if (freq.kind === "weekdays") return frequencyLabel(freq);
        return null;
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

            // 未完了: 浮き上がる影、完了: 沈み込む内側影
            boxShadow: isDone ? "inset 0 1px 3px rgba(0,0,0,0.15)" : "0 2px 8px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)",
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
        onAfterWrite?.();
    }

    const sortedHabits = sortTasks(habits, sortRule, false, doneTaskIds);
    const sortedOneoffs = sortTasks(visibleOneoffs, sortRule, prioritizeDue, doneTaskIds);



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
        const [dueDateCleared, setDueDateCleared] = useState(false);
        const [memo, setMemo] = useState(item.memo || "");
        const [showMemo, setShowMemo] = useState(!!(item.memo));
        const [remindOn, setRemindOn] = useState(item.remind_on ?? false);
        const [remindHour, setRemindHour] = useState(item.remind_hour ?? 8);
        const [remindMinute, setRemindMinute] = useState(item.remind_minute ?? 0);
        const [freq, setFreq] = useState<Frequency>(type === "habit" ? currentFrequency(item) : { kind: "daily", count: null, days: null });

        const [actionId, setActionId] = useState(item.action_id || "");
        const [note, setNote] = useState(item.note || "");

        const overlayStyle: React.CSSProperties = {
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)",
            zIndex: 100, display: "flex", justifyContent: "center", alignItems: "flex-end",
            animation: "fadeIn 0.2s ease",
        };
        const modalStyle: React.CSSProperties = {
            // 画面上部のバナー広告・ノッチに重ならない高さに抑える
            width: "100%", maxWidth: 600, maxHeight: `calc(100dvh - max(env(safe-area-inset-top, 0px), 24px) - ${adHeight}px)`,
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
                        due_date: type === "oneoff"
                                        ? dueDateCleared ? null : (dueDate || item.due_date || null)
                                        : null,
                        memo: memo.trim() || null,
                        ...(type === "habit" ? { remind_on: remindOn, remind_hour: remindHour, remind_minute: remindMinute } : {}),
                        // 頻度を変えたときは、変える前の頻度を昨日までの履歴に残す
                        ...(type === "habit" ? changeFrequencyPatch(item, freq, todayJST()) ?? {} : {}),
                    } as any);
                    await loadBase();
                    window.dispatchEvent(new CustomEvent('lifeos:scheduleNotifications'));
                }
                onAfterWrite?.();
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
                onAfterWrite?.();
                setEditingItem(null);
                setMsg("削除しました。");
            } catch (err: any) {
                setMsg(err?.message ?? "削除エラー");
            }
        };

        const handleToggleHidden = async () => {
            setMsg("");
            try {
                await sqliteRepo.updateTask(userId, item.id, { is_hidden: !item.is_hidden } as any);
                await loadBase();
                window.dispatchEvent(new CustomEvent('lifeos:scheduleNotifications'));
                setEditingItem(null);
                setMsg(item.is_hidden ? "表示に戻しました。" : "非表示にしました。");
            } catch (err: any) {
                setMsg(err?.message ?? "更新エラー");
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
                                {!showMemo ? (
                                    <button
                                        type="button"
                                        onClick={() => setShowMemo(true)}
                                        style={{ background: "none", border: "1px dashed #cbd5e1", borderRadius: 8, padding: "8px 12px", cursor: "pointer", color: "#64748b", fontSize: 13, display: "flex", alignItems: "center", gap: 6, width: "100%" }}
                                    >
                                        <MemoIcon size={14} />
                                        メモを追加
                                    </button>
                                ) : (
                                    <div>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                                            <span style={{ fontSize: 13, fontWeight: 600 }}>メモ</span>
                                            <button type="button" onClick={() => { setShowMemo(false); setMemo(""); }} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 12, padding: 0 }}>削除</button>
                                        </div>
                                        <textarea
                                            value={memo}
                                            onChange={(e) => setMemo(e.target.value)}
                                            placeholder="メモを入力..."
                                            rows={3}
                                            style={{ width: "100%", boxSizing: "border-box", borderRadius: 8, border: "1px solid #cbd5e1", padding: "8px 10px", fontSize: 14, resize: "vertical", fontFamily: "inherit", background: "var(--bg)", color: "var(--text)" }}
                                        />
                                    </div>
                                )}
                                <label>
                                    優先度（1-5）: <b>{priority}</b>
                                    <Slider min="1" max="5" step="1" value={priority} onChange={(e) => setPriority(Number(e.target.value))} fullWidth />
                                </label>
                                <label>
                                    ボリューム（1-10）: <b>{volume}</b>
                                    <Slider min="1" max="10" step="1" value={volume} onChange={(e) => setVolume(Number(e.target.value))} fullWidth />
                                </label>
                                {type === "habit" && <FrequencyPicker value={freq} onChange={setFreq} />}
                                {type === "habit" && (
                                    <div style={{ display: "grid", gap: 8 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                            <ToggleSwitch
                                                checked={remindOn}
                                                onChange={async (next) => {
                                                    if (next) {
                                                        const granted = await checkOrRequestNotifPermission();
                                                        if (!granted) {
                                                            setMsg("通知を有効にするには、設定アプリから通知を許可してください");
                                                            return;
                                                        }
                                                    }
                                                    setRemindOn(next);
                                                }}
                                                color={theme.habit}
                                            />
                                            <span style={{ fontSize: 14 }}>リマインド通知</span>
                                        </div>
                                        {remindOn && (
                                            <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 54 }}>
                                                <span style={{ fontSize: 14 }}>時間:</span>
                                                <Select value={String(remindHour)} onChange={(e) => setRemindHour(parseInt(e.target.value))} style={{ width: 82 }}>
                                                    {Array.from({length: 24}, (_, i) => i).map(h => <option key={h} value={h}>{String(h).padStart(2, "0")}</option>)}
                                                </Select>
                                                <span style={{ fontSize: 14, opacity: 0.7 }}>時</span>
                                                <Select value={String(remindMinute)} onChange={(e) => setRemindMinute(parseInt(e.target.value))} style={{ width: 82 }}>
                                                    {Array.from({length: 60}, (_, i) => i).map(m => <option key={m} value={m}>{String(m).padStart(2, "0")}</option>)}
                                                </Select>
                                                <span style={{ fontSize: 14, opacity: 0.7 }}>分</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {type === "oneoff" && (
                                    <div>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                                            <span style={{ fontSize: 14 }}>期限（任意）</span>
                                            {!dueDateCleared && (dueDate || item.due_date) && (
                                                <button
                                                    type="button"
                                                    onClick={() => { setDueDate(""); setDueDateCleared(true); }}
                                                    style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 12, padding: 0 }}
                                                >削除</button>
                                            )}
                                        </div>
                                        <TextInput type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} fullWidth />
                                    </div>
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
                                <PrimaryBtn type="submit" fullWidth disabled={type === "habit" && !isValidFrequency(freq)}>保存</PrimaryBtn>
                            </div>
                            <div style={{ flex: 1 }}>
                                <SecondaryBtn type="button" onClick={() => setEditingItem(null)} fullWidth>キャンセル</SecondaryBtn>
                            </div>
                        </div>
                        {(type === "habit" || type === "oneoff") && (
                            <div style={{ display: "flex", justifyContent: "center", gap: 24, marginTop: 8 }}>
                                <button type="button" onClick={handleToggleHidden} style={{ background: "none", border: "none", color: theme.subtext, cursor: "pointer", textDecoration: "underline", fontSize: 14 }}>
                                    {item.is_hidden ? "表示に戻す" : "非表示にする"}
                                </button>
                                <button type="button" onClick={handleDelete} style={{ background: "none", border: "none", color: theme.danger, cursor: "pointer", textDecoration: "underline", fontSize: 14 }}>
                                    削除する
                                </button>
                            </div>
                        )}
                        {type === "action" && (
                            <div style={{ textAlign: "center", marginTop: 8 }}>
                                <button type="button" onClick={handleDelete} style={{ background: "none", border: "none", color: theme.danger, cursor: "pointer", textDecoration: "underline", fontSize: 14 }}>
                                    削除する
                                </button>
                            </div>
                        )}
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
            {/* ✅ 今日の目標バナー（前日に tomorrow_note が入力されていた場合のみ表示） */}
            {yesterdayGoal && (
                <div style={{
                    margin: "-8px -24px 0",   // 上の8px余白を打ち消してヘッダーと直結、左右は画面端まで
                    width: "calc(100% + 48px)",
                    padding: "8px 24px 0",    // 下は0pxでSegmentedBarと直結
                    background: "#64748b",    // SegmentedBarと同色
                    boxSizing: "border-box",
                }}>
                    <div style={{
                        padding: "10px 14px",
                        borderRadius: 10,
                        background: "rgba(255,255,255,0.85)",  // 薄いグレー
                        display: "grid",
                        gap: 2,
                    }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#1e293b", letterSpacing: 0.5 }}>今日の目標</div>
                        <div style={{ fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap", color: "#1e293b" }}>{yesterdayGoal}</div>
                    </div>
                </div>
            )}

            {/* ✅ サブバー（segmented bar）: 目標なし時は上の8px余白を相殺 */}
            <div style={!yesterdayGoal ? { marginTop: -8 } : undefined}>
                <SegmentedBar
                    items={segmentedItems as any}
                    value={filter}
                    onChange={setFilter}
                    ariaLabel="記録の表示切り替え"
                    stickyTop={56} /* 追加要望10: ヘッダー下に追従固定 */
                />
            </div>

            {/* ✅ カード群（フィルタに応じて出し分け） */}
            <div style={{ display: "grid", gap: space.lg, marginTop: space.md }}>
                {(filter === "all" || filter === "habit") && (
                    <div>
                        <SectionTitle title="習慣" icon={<RepeatIcon size={18} />} accentColor={theme.habit} style={{ marginBottom: 8 }} />
                        {sortedHabits.length === 0 ? (
                            <p style={{ margin: 0, opacity: 0.5, fontSize: 14 }}>まだありません（＋ボタンから追加）</p>
                        ) : (
                            <ul style={{ listStyle: "none", paddingLeft: 0, margin: 0, display: "grid", gap: 8 }}>
                                    {sortedHabits.map((t) => {
                                        const isHidden = !!(t as any).is_hidden;
                                        const checked = doneTaskIds.has(t.id);

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
                                                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                            <div style={titleStyle(checked, theme.habit)}>{t.title}</div>
                                                            {t.remind_on && <BellIcon size={13} color={checked ? "rgba(255,255,255,0.8)" : theme.habit} style={{ flexShrink: 0, opacity: 0.8 }} />}
                                                        </div>
                                                        {t.memo && (
                                                            <div style={{ fontSize: 12, opacity: checked ? 0.8 : 0.6, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any, overflow: "hidden" }}>
                                                                {t.memo}
                                                            </div>
                                                        )}
                                                        <div style={metaLineStyle}>
                                                            <PriorityBadge value={(t as any).priority} />
                                                            <VolBar value={(t as any).volume} isReverse={checked} />
                                                            {isHidden && checked ? (
                                                                <small style={{ opacity: 0.6 }}>（非表示・当日完了のため表示）</small>
                                                            ) : null}
                                                        </div>
                                                        {habitFrequencyNote(t) && (
                                                            <div style={{ fontSize: 12, opacity: checked ? 0.85 : 0.7 }}>{habitFrequencyNote(t)}</div>
                                                        )}
                                                        {goalChip(t.id)}
                                                    </div>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                        )}
                        {offDayHabits.length > 0 && (
                            <p style={{ margin: "8px 0 0", fontSize: 12, opacity: 0.7 }}>
                                この日は予定のない習慣：{offDayHabits.map((t) => `${t.title}（${frequencyLabel(frequencyAt(t, day))}）`).join("、")}
                            </p>
                        )}
                    </div>
                )}

                {(filter === "all" || filter === "task") && (
                    <div>
                        <SectionTitle title="タスク" icon={<CheckIcon size={18} />} accentColor={theme.task} style={{ marginBottom: 8 }} />
                        {sortedOneoffs.length === 0 ? (
                            <p style={{ margin: 0, opacity: 0.5, fontSize: 14 }}>まだありません（＋ボタンから追加）</p>
                        ) : (
                            <ul style={{ listStyle: "none", paddingLeft: 0, margin: 0, display: "grid", gap: 8 }}>
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
                                                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                            <div style={titleStyle(checked, theme.task)}>{t.title}</div>
                                                        </div>
                                                        {t.memo && (
                                                            <div style={{ fontSize: 12, opacity: checked ? 0.8 : 0.6, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any, overflow: "hidden" }}>
                                                                {t.memo}
                                                            </div>
                                                        )}
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
                                                        {goalChip(t.id)}
                                                    </div>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                        )}
                    </div>
                )}

                {(filter === "all" || filter === "action") && (
                    <div>
                        <SectionTitle title="行動" icon={<ZapIcon size={18} />} accentColor={theme.action} style={{ marginBottom: 8 }} />
                        {todayActionEntries.length === 0 ? (
                            <p style={{ margin: 0, opacity: 0.5, fontSize: 14 }}>まだありません（＋ボタンから追加）</p>
                        ) : (
                            <ul style={{ listStyle: "none", paddingLeft: 0, margin: 0, display: "grid", gap: 8 }}>
                                {(todayActionEntries ?? []).map((e: any) => (
                                    <ActionEntryRow key={e.id} entry={e} />
                                ))}
                            </ul>
                        )}
                    </div>
                )}
            </div>

            {editingItem && <EditItemModal />}
        </>
    );
}
