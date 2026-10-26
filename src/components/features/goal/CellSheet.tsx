import { useEffect, useState } from "react";
import { theme } from "../../../lib/ui/theme";
import type { MandalaCell, MandalaCellEvent, Task } from "../../../lib/types";
import type { ElementModel } from "../../../lib/mandala/chart";
import type { MandalaState } from "../../../lib/mandala/useMandala";
import { currentFrequency, frequencyLabel, isValidFrequency, type Frequency } from "../../../lib/mandala/frequency";
import { isCounted, taskProgress, weekCountStatus } from "../../../lib/mandala/progress";
import PrimaryBtn from "../../ui/PrimaryBtn";
import SecondaryBtn from "../../ui/SecondaryBtn";
import TextInput from "../../ui/TextInput";
import { CloseIcon } from "../../ui/Icon";
import FrequencyPicker from "../register/FrequencyPicker";

const DAILY: Frequency = { kind: "daily", count: null, days: null };

/** 保存時刻(ISO、UTC)を、端末の日付(YYYY/MM/DD)で表す */
function localDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso.slice(0, 10).replace(/-/g, "/");
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

type Mode = "main" | "create-habit" | "create-task" | "pick";

/**
 * マスの詳細(下から出るシート)。行動目標の文言、ひもづいた習慣・タスク、
 * 習慣・タスクの作成とひもづけ、変更の履歴。
 * cellIndex が null のときは、要素の名前を書くシート。
 */
export default function CellSheet({
    mandala,
    element,
    cellIndex,
    tasks,
    adHeight,
    setMsg,
    onClose,
    onOpenElement,
}: {
    mandala: MandalaState;
    element: ElementModel;
    cellIndex: number | null;
    tasks: Task[];
    adHeight: number;
    setMsg: (s: string) => void;
    onClose: () => void;
    onOpenElement: (elementIndex: number) => void;
}) {
    const cell: MandalaCell | null = cellIndex === null ? element.cell : element.actions[cellIndex];
    const [text, setText] = useState(cellIndex === null ? element.name : cell?.text ?? "");
    const [mode, setMode] = useState<Mode>("main");
    const [formTitle, setFormTitle] = useState("");
    const [formFreq, setFormFreq] = useState<Frequency>(DAILY);
    const [formDue, setFormDue] = useState("");
    const [events, setEvents] = useState<MandalaCellEvent[]>([]);
    const [busy, setBusy] = useState(false);

    // チャートを読み直すたび(作成・ひもづけなどの書き込みのあと)に、履歴も読み直す
    useEffect(() => {
        if (cell && cellIndex !== null) mandala.getEvents(cell.id).then(setEvents).catch(() => setEvents([]));
    }, [cell?.id, cellIndex, mandala.model, mandala.getEvents]);

    const run = async (fn: () => Promise<void>, done?: string) => {
        setBusy(true);
        try {
            await fn();
            if (done) setMsg(done);
        } catch (e: any) {
            setMsg(e?.message ?? "保存できませんでした");
        } finally {
            setBusy(false);
        }
    };

    /** 習慣の実施状況の文言。週n回は今週の回数、それ以外は数え始めた日からの回数 */
    const habitStat = (t: Task, p: { done: number; target: number }): string | null => {
        if (t.task_type !== "habit") return null;
        const freq = currentFrequency(t);
        if (freq.kind === "weekly_count") {
            const w = weekCountStatus(t, mandala.doneByTask.get(t.id), mandala.period.to);
            return `${frequencyLabel(freq)} ・ 今週 ${w.done}/${w.target}回`;
        }
        const from = t.mandala_linked_at && t.mandala_linked_at > mandala.period.from
            ? `${t.mandala_linked_at.slice(5).replace("-", "/")}から` : "直近7日";
        return `${frequencyLabel(freq)} ・ ${from} ${p.done}/${p.target}回`;
    };

    const savedText = cellIndex === null ? element.name : cell?.text ?? "";
    const dirty = text.trim() !== savedText;
    const saveText = () => run(async () => {
        if (cellIndex === null) await mandala.setElementName(element.index, text);
        else await mandala.setActionText(element.index, cellIndex, text);
    }, "保存しました");

    const linked = cell ? (mandala.byCell.get(cell.id) ?? []) : [];
    const activeLinked = linked.filter(isCounted);
    const endedLinked = linked.filter((t) => !isCounted(t));
    const pickable = tasks.filter((t) => !t.is_hidden && !t.ended_at && t.mandala_cell_id !== cell?.id);
    const cellLabel = (cellId: string | null | undefined) => {
        if (!cellId || !mandala.model) return null;
        for (const el of mandala.model.elements) {
            const a = el.actions.findIndex((c) => c?.id === cellId);
            if (a >= 0) return `${el.name} › ${el.actions[a]!.text}`;
        }
        return null;
    };

    const overlay: React.CSSProperties = {
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)",
        zIndex: 100, display: "flex", justifyContent: "center", alignItems: "flex-end",
    };
    const sheet: React.CSSProperties = {
        width: "100%", maxWidth: 600, boxSizing: "border-box",
        maxHeight: `calc(100dvh - max(env(safe-area-inset-top, 0px), 24px) - ${adHeight}px)`,
        background: "var(--bg)", borderTopLeftRadius: 20, borderTopRightRadius: 20,
        padding: "20px 16px calc(24px + env(safe-area-inset-bottom, 0px))", overflowY: "auto",
        display: "grid", gap: 14, alignContent: "start",
    };
    const sectionTitle: React.CSSProperties = { margin: 0, fontSize: 13, fontWeight: 700, color: theme.subtext };
    const row: React.CSSProperties = {
        display: "flex", alignItems: "center", gap: 10, background: theme.card, borderRadius: 12,
        padding: "8px 8px 8px 12px", border: `1px solid ${theme.border}`,
    };

    return (
        <div style={overlay} onClick={onClose}>
            <div role="dialog" aria-label="マスの詳細" style={sheet} onClick={(e) => e.stopPropagation()}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, minWidth: 0 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 5, background: element.color, flexShrink: 0 }} />
                        {cellIndex === null ? `要素 ${element.index + 1}` : `${element.name} › ${savedText || "行動目標"}`}
                    </span>
                    <button type="button" aria-label="閉じる" onClick={onClose}
                        style={{ width: 44, height: 44, borderRadius: 22, border: "none", background: "rgba(0,0,0,0.05)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text)" }}>
                        <CloseIcon size={18} />
                    </button>
                </div>

                <label style={{ display: "grid", gap: 6, fontSize: 14 }}>
                    {cellIndex === null ? "要素の名前" : "行動目標"}
                    <TextInput value={text} onChange={(e) => setText(e.target.value)} placeholder={cellIndex === null ? "例: 睡眠" : "例: 23時に寝る"} fullWidth />
                </label>
                {dirty && <PrimaryBtn fullWidth disabled={busy || (cellIndex === null && !text.trim())} onClick={saveText}>保存</PrimaryBtn>}

                {cellIndex === null && !dirty && element.name && (
                    <PrimaryBtn fullWidth onClick={() => onOpenElement(element.index)}>この要素の行動目標を書く</PrimaryBtn>
                )}

                {cellIndex !== null && !dirty && !savedText && (
                    <p style={{ margin: 0, fontSize: 13, color: theme.subtext }}>行動目標を書くと、ここから習慣・タスクを作れます。</p>
                )}

                {cellIndex !== null && !dirty && cell && savedText && mode === "main" && (
                    <>
                        <h3 style={sectionTitle}>ひもづいた習慣・タスク</h3>
                        {activeLinked.length === 0 && (
                            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: theme.subtext }}>まだありません。下のボタンから作るか、登録済みのものをひもづけてください。</p>
                        )}
                        {activeLinked.map((t) => {
                            const p = taskProgress(t, mandala.doneByTask.get(t.id), mandala.period, cell.paused_periods);
                            return (
                                <div key={t.id} style={row}>
                                    <span style={{ flex: 1, minWidth: 0, display: "grid", gap: 2 }}>
                                        <span style={{ fontSize: 14, fontWeight: 700 }}>{t.task_type === "habit" ? "習慣" : "タスク"} ・ {t.title}</span>
                                        <span style={{ fontSize: 12, color: theme.subtext }}>
                                            {habitStat(t, p) ?? (p.rate === 100 ? "完了" : t.due_date ? `期限 ${t.due_date.replace(/-/g, "/")} ・ 未完了` : "未完了")}
                                        </span>
                                    </span>
                                    <b style={{ fontSize: 14 }}>{p.rate === null ? "-" : `${p.rate}%`}</b>
                                    <button type="button" aria-label={`${t.title}のひもづけを外す`} disabled={busy}
                                        onClick={() => run(() => mandala.unlinkTask(t), "ひもづけを外しました")}
                                        style={{ minHeight: 44, border: "none", background: "none", color: theme.subtext, fontSize: 12, cursor: "pointer", padding: "0 8px" }}>外す</button>
                                </div>
                            );
                        })}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                            <PrimaryBtn fullWidth onClick={() => { setFormTitle(savedText); setFormFreq(DAILY); setMode("create-habit"); }}>＋ 習慣を作る</PrimaryBtn>
                            <SecondaryBtn fullWidth onClick={() => { setFormTitle(savedText); setFormDue(""); setMode("create-task"); }}>＋ タスクを作る</SecondaryBtn>
                        </div>
                        <button type="button" onClick={() => setMode("pick")}
                            style={{ minHeight: 44, border: "none", background: "none", color: theme.habit, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                            登録済みの習慣・タスクをひもづける
                        </button>

                        {endedLinked.length > 0 && (
                            <>
                                <h3 style={sectionTitle}>終了・非表示の習慣（記録は残っています）</h3>
                                {endedLinked.map((t) => (
                                    <span key={t.id} style={{ fontSize: 13, color: theme.subtext }}>
                                        {t.title}{t.ended_at ? `（${t.ended_at.replace(/-/g, "/")} に終了）` : "（非表示）"}
                                    </span>
                                ))}
                            </>
                        )}

                        {events.length > 0 && (
                            <>
                                <h3 style={sectionTitle}>このマスの変更の履歴</h3>
                                <div style={{ display: "grid", gap: 6 }}>
                                    {[...events].reverse().map((ev) => (
                                        <div key={ev.id} style={{ display: "flex", gap: 10, fontSize: 12, lineHeight: 1.6 }}>
                                            <span style={{ color: theme.subtext, whiteSpace: "nowrap" }}>{localDate(ev.created_at)}</span>
                                            <span>{ev.note}</span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </>
                )}

                {cell && (mode === "create-habit" || mode === "create-task") && (
                    <div style={{ display: "grid", gap: 12, borderTop: `1px solid ${theme.border}`, paddingTop: 14 }}>
                        <h3 style={{ margin: 0, fontSize: 16 }}>{mode === "create-habit" ? "習慣を作る" : "タスクを作る"}</h3>
                        <label style={{ display: "grid", gap: 6, fontSize: 14 }}>
                            タイトル
                            <TextInput value={formTitle} onChange={(e) => setFormTitle(e.target.value)} fullWidth />
                        </label>
                        {mode === "create-habit" && <FrequencyPicker value={formFreq} onChange={setFormFreq} />}
                        {mode === "create-task" && (
                            <label style={{ display: "grid", gap: 6, fontSize: 14 }}>
                                期限（任意）
                                <TextInput type="date" value={formDue} onChange={(e) => setFormDue(e.target.value)} fullWidth />
                            </label>
                        )}
                        <p style={{ margin: 0, fontSize: 12, color: theme.subtext }}>優先度・ボリューム・リマインドは、作ったあとに記録タブの編集で設定できます。</p>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                            <SecondaryBtn fullWidth onClick={() => setMode("main")}>キャンセル</SecondaryBtn>
                            <PrimaryBtn
                                fullWidth
                                disabled={busy || !formTitle.trim() || (mode === "create-habit" && !isValidFrequency(formFreq))}
                                onClick={() => run(async () => {
                                    await mandala.createTaskForCell(cell, mode === "create-habit"
                                        ? { type: "habit", title: formTitle, frequency: formFreq }
                                        : { type: "oneoff", title: formTitle, dueDate: formDue || null });
                                    setMode("main");
                                }, mode === "create-habit" ? "習慣を追加しました。記録タブに出ます" : "タスクを追加しました。記録タブに出ます")}
                            >追加</PrimaryBtn>
                        </div>
                    </div>
                )}

                {cell && mode === "pick" && (
                    <div style={{ display: "grid", gap: 8, borderTop: `1px solid ${theme.border}`, paddingTop: 14 }}>
                        <h3 style={{ margin: "0 0 4px", fontSize: 16 }}>ひもづける習慣・タスクを選ぶ</h3>
                        {pickable.length === 0 && <p style={{ margin: 0, fontSize: 13, color: theme.subtext }}>選べる習慣・タスクがありません。</p>}
                        {pickable.map((t) => {
                            const other = cellLabel(t.mandala_cell_id);
                            return (
                                <button key={t.id} type="button" disabled={busy}
                                    onClick={() => run(async () => { await mandala.linkTask(t, cell); setMode("main"); }, "ひもづけました")}
                                    style={{ ...row, minHeight: 52, textAlign: "left", cursor: "pointer", flexDirection: "column", alignItems: "stretch", gap: 2, color: "var(--text)" }}>
                                    <span style={{ fontSize: 14, fontWeight: 700 }}>{t.task_type === "habit" ? "習慣" : "タスク"} ・ {t.title}</span>
                                    <span style={{ fontSize: 12, color: theme.subtext }}>
                                        {other ? `「${other}」から付け替えます` : "まだどのマスにもひもづいていません"}
                                    </span>
                                </button>
                            );
                        })}
                        <SecondaryBtn fullWidth onClick={() => setMode("main")}>キャンセル</SecondaryBtn>
                    </div>
                )}
            </div>
        </div>
    );
}
