import { useEffect, useState } from "react";
import { theme } from "../../../lib/ui/theme";
import type { MandalaCell, MandalaCellEvent, Task } from "../../../lib/types";
import type { ElementModel } from "../../../lib/mandala/chart";
import type { MandalaState } from "../../../lib/mandala/useMandala";
import { currentFrequency, frequencyLabel, isValidFrequency, type Frequency } from "../../../lib/mandala/frequency";
import { isCounted, taskProgress, weekCountStatus } from "../../../lib/mandala/progress";
import { localDateLabel } from "../../../lib/mandala/dates";
import PrimaryBtn from "../../ui/PrimaryBtn";
import SecondaryBtn from "../../ui/SecondaryBtn";
import TextInput from "../../ui/TextInput";
import { CheckIcon, CloseIcon, RepeatIcon, ShieldIcon } from "../../ui/Icon";
import RuleAnswerButtons from "../tasks/RuleAnswerButtons";
import { isRepeating, KIND_LABEL, type RuleAnswer } from "../../../lib/taskKind";
import FrequencyPicker from "../register/FrequencyPicker";
import TaskPicker from "./TaskPicker";
import { nextOnLongPress, nextOnTap, type TaskState } from "../../../lib/taskState";
import TaskCard from "../tasks/TaskCard";
import TaskStatusBox from "../../ui/TaskStatusBox";
import Checkbox from "../../ui/Checkbox";
import SectionTitle from "../../ui/SectionTitle";

const DAILY: Frequency = { kind: "daily", count: null, days: null };

type Mode = "main" | "create-habit" | "create-task" | "create-rule" | "pick" | "achieve";

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
    // チェックしてから保存し終わるまでの状態(習慣・タスクの id → 押した状態)
    const [pending, setPending] = useState<Map<string, TaskState>>(new Map());
    // マイルールの ○× を押してから保存し終わるまで
    const [pendingRule, setPendingRule] = useState<Map<string, RuleAnswer>>(new Map());

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

    /** 習慣・マイルールの実施状況の文言。週n回は今週の回数、それ以外は数え始めた日からの回数(マイルールは ○ の日数) */
    const habitStat = (t: Task, p: { done: number; target: number }): string | null => {
        if (!isRepeating(t)) return null;
        const rule = t.task_type === "rule";
        const freq = currentFrequency(t);
        if (freq.kind === "weekly_count") {
            const w = weekCountStatus(t, mandala.doneByTask.get(t.id), mandala.period.to);
            return `${frequencyLabel(freq)} ・ 今週 ${rule ? "○ " : ""}${w.done}/${w.target}${rule ? "日" : "回"}`;
        }
        const from = t.mandala_linked_at && t.mandala_linked_at > mandala.period.from
            ? `${t.mandala_linked_at.slice(5).replace("-", "/")}から` : "直近7日";
        return `${frequencyLabel(freq)} ・ ${from} ${rule ? "○ " : ""}${p.done}/${p.target}${rule ? "日" : "回"}`;
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
    // 達成にするときに、続けるか終えるかを選ぶもの(習慣・マイルール)
    const activeHabits = activeLinked.filter(isRepeating);
    const habitsLabel = activeHabits.some((t) => t.task_type === "rule")
        ? activeHabits.some((t) => t.task_type === "habit") ? "習慣・マイルール" : "マイルール"
        : "習慣";
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
        padding: "20px 16px calc(24px + env(safe-area-inset-bottom, 0px))", overflowY: "auto", overflowX: "hidden",
        display: "grid", gap: 14, alignContent: "start",
    };
    const sectionTitle: React.CSSProperties = { margin: 0, fontSize: 13, fontWeight: 700, color: theme.subtext };

    /** 今日の状態。チェックしてから保存し終わるまでは、押した状態を先に出す */
    const today = mandala.period.to;
    const stateOf = (t: Task): TaskState => {
        const p = pending.get(t.id);
        if (p) return p;
        if (mandala.doneByTask.get(t.id)?.has(today)) return "done";
        return t.task_type === "habit" ? "todo" : mandala.taskStateOf(t.id);
    };
    const ruleAnswerOf = (t: Task): RuleAnswer => {
        if (pendingRule.has(t.id)) return pendingRule.get(t.id)!;
        if (mandala.doneByTask.get(t.id)?.has(today)) return "done";
        return mandala.missedToday.has(t.id) ? "missed" : null;
    };
    const changeRuleAnswer = async (t: Task, next: RuleAnswer) => {
        setPendingRule((m) => new Map(m).set(t.id, next));
        try {
            await mandala.setRuleAnswerToday(t, next);
        } catch (e: any) {
            setMsg(e?.message ?? "保存できませんでした");
        } finally {
            setPendingRule((m) => { const n = new Map(m); n.delete(t.id); return n; });
        }
    };
    const changeState = async (t: Task, next: TaskState) => {
        setPending((m) => new Map(m).set(t.id, next));
        try {
            await mandala.setTaskStateToday(t, next);
        } catch (e: any) {
            setMsg(e?.message ?? "保存できませんでした");
        } finally {
            setPending((m) => { const n = new Map(m); n.delete(t.id); return n; });
        }
    };

    /** ひもづいた習慣・タスク・マイルールを、記録タブと同じカードで並べる(今日の分をチェックできる) */
    const linkedSection = (type: Task["task_type"], list: Task[]) => {
        if (!cell || list.length === 0) return null;
        const color = type === "habit" ? theme.habit : type === "rule" ? theme.rule : theme.task;
        return (
            <div>
                <SectionTitle
                    title={KIND_LABEL[type]}
                    icon={type === "habit" ? <RepeatIcon size={18} /> : type === "rule" ? <ShieldIcon size={18} /> : <CheckIcon size={18} />}
                    accentColor={color}
                    // 見出しは余白 24px を打ち消して端まで広げる作りなので、シートの余白(16px)に合わせる(はみ出して横にスクロールできてしまうため)
                    style={{ margin: "0 -16px 8px", padding: "0 16px", width: "calc(100% + 32px)" }}
                />
                <div style={{ display: "grid", gap: 8 }}>
                    {list.map((t) => {
                        const p = taskProgress(t, mandala.doneByTask.get(t.id), mandala.period, cell.paused_periods);
                        const state = stateOf(t);
                        const checked = state === "done";
                        const answer = type === "rule" ? ruleAnswerOf(t) : null;
                        return (
                            <TaskCard
                                key={t.id}
                                task={t}
                                accentColor={color}
                                checked={type === "rule" ? answer === "done" : checked}
                                doingSince={state === "doing" ? mandala.doingSince.get(t.id) ?? "" : null}
                                check={type === "rule" ? undefined : type === "habit"
                                    ? <Checkbox checked={checked} color={color} disabled={busy} onChange={(e) => changeState(t, e.target.checked ? "done" : "todo")} />
                                    : <TaskStatusBox
                                        state={state}
                                        color={color}
                                        title={t.title}
                                        onTap={() => changeState(t, nextOnTap(state))}
                                        onLongPress={() => {
                                            const next = nextOnLongPress(state);
                                            changeState(t, next);
                                            setMsg(next === "doing" ? `「${t.title}」を対応中にしました` : `「${t.title}」を未完了に戻しました`);
                                        }}
                                    />}
                                notes={[habitStat(t, p)]}
                                // マイルールは右に % と「外す」があるので、今日の ○× は下に出す
                                footer={type === "rule" && (
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <span style={{ fontSize: 12, opacity: 0.8 }}>今日</span>
                                        <RuleAnswerButtons value={answer} title={t.title} onAccent={answer === "done"} onChange={(next) => changeRuleAnswer(t, next)} />
                                    </div>
                                )}
                                right={
                                    // 縦に積むとカードが高くなり、下に余白ができるため横に並べる
                                    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                                        <b style={{ fontSize: 14 }}>{p.rate === null ? "-" : `${p.rate}%`}</b>
                                        <button type="button" aria-label={`${t.title}のひもづけを外す`} disabled={busy}
                                            onClick={() => run(() => mandala.unlinkTask(t), "ひもづけを外しました")}
                                            style={{ minHeight: 32, border: "none", background: "none", color: "inherit", opacity: 0.7, fontSize: 12, cursor: "pointer", padding: "0 0 0 8px", fontFamily: "inherit" }}>外す</button>
                                    </div>
                                }
                            />
                        );
                    })}
                </div>
            </div>
        );
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

                {cell && cellIndex !== null && cell.status !== "active" && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 12, padding: "8px 8px 8px 12px" }}>
                        <span style={{ fontSize: 13, fontWeight: 700 }}>
                            {cell.status === "paused" ? "このマスは休止中です（進み具合に数えません）" : "このマスは達成済みです（100% として数えます）"}
                        </span>
                        {cell.status === "paused" && (
                            <PrimaryBtn disabled={busy} style={{ whiteSpace: "nowrap", flexShrink: 0 }} onClick={() => run(() => mandala.resumeCell(cell), "再開しました。習慣が記録タブに戻ります")}>再開する</PrimaryBtn>
                        )}
                        {cell.status === "achieved" && (
                            <SecondaryBtn disabled={busy} style={{ whiteSpace: "nowrap", flexShrink: 0 }} onClick={() => run(() => mandala.unachieveCell(cell), "達成を取り消しました")}>取り消す</SecondaryBtn>
                        )}
                    </div>
                )}

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
                        <h3 style={sectionTitle}>ひもづいた習慣・タスク・マイルール</h3>
                        {activeLinked.length === 0 && (
                            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: theme.subtext }}>まだありません。下のボタンから作るか、登録済みのものをひもづけてください。</p>
                        )}
                        {linkedSection("habit", activeLinked.filter((t) => t.task_type === "habit"))}
                        {linkedSection("oneoff", activeLinked.filter((t) => t.task_type === "oneoff"))}
                        {linkedSection("rule", activeLinked.filter((t) => t.task_type === "rule"))}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                            <PrimaryBtn fullWidth onClick={() => { setFormTitle(savedText); setFormFreq(DAILY); setMode("create-habit"); }}>＋ 習慣を作る</PrimaryBtn>
                            <SecondaryBtn fullWidth onClick={() => { setFormTitle(savedText); setFormDue(""); setMode("create-task"); }}>＋ タスクを作る</SecondaryBtn>
                            <SecondaryBtn fullWidth style={{ gridColumn: "1 / -1" }} onClick={() => { setFormTitle(savedText); setFormFreq(DAILY); setMode("create-rule"); }}>＋ マイルールを作る</SecondaryBtn>
                        </div>
                        <button type="button" onClick={() => setMode("pick")}
                            style={{ minHeight: 44, border: "none", background: "none", color: theme.habit, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                            登録済みの習慣・タスク・マイルールをひもづける
                        </button>
                        {cell.status === "active" && (
                            <SecondaryBtn fullWidth onClick={() => setMode("achieve")}>✓ このマスを達成にする</SecondaryBtn>
                        )}

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
                                            <span style={{ color: theme.subtext, whiteSpace: "nowrap" }}>{localDateLabel(ev.created_at)}</span>
                                            <span>{ev.note}</span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </>
                )}

                {cell && (mode === "create-habit" || mode === "create-task" || mode === "create-rule") && (
                    <div style={{ display: "grid", gap: 12, borderTop: `1px solid ${theme.border}`, paddingTop: 14 }}>
                        <h3 style={{ margin: 0, fontSize: 16 }}>{mode === "create-habit" ? "習慣を作る" : mode === "create-rule" ? "マイルールを作る" : "タスクを作る"}</h3>
                        {mode === "create-rule" && (
                            <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: theme.subtext }}>一日を通して守りたいことです。記録タブで、一日の終わりに ○ / × をつけます。</p>
                        )}
                        <label style={{ display: "grid", gap: 6, fontSize: 14 }}>
                            タイトル
                            <TextInput value={formTitle} onChange={(e) => setFormTitle(e.target.value)} fullWidth />
                        </label>
                        {(mode === "create-habit" || mode === "create-rule") && <FrequencyPicker value={formFreq} onChange={setFormFreq} />}
                        {mode === "create-task" && (
                            <label style={{ display: "grid", gap: 6, fontSize: 14 }}>
                                期限（任意）
                                <TextInput type="date" value={formDue} onChange={(e) => setFormDue(e.target.value)} fullWidth />
                            </label>
                        )}
                        {mode !== "create-rule" && <p style={{ margin: 0, fontSize: 12, color: theme.subtext }}>優先度・ボリューム・リマインドは、作ったあとに記録タブの編集で設定できます。</p>}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                            <SecondaryBtn fullWidth onClick={() => setMode("main")}>キャンセル</SecondaryBtn>
                            <PrimaryBtn
                                fullWidth
                                disabled={busy || !formTitle.trim() || (mode !== "create-task" && !isValidFrequency(formFreq))}
                                onClick={() => run(async () => {
                                    await mandala.createTaskForCell(cell, mode === "create-task"
                                        ? { type: "oneoff", title: formTitle, dueDate: formDue || null }
                                        : { type: mode === "create-rule" ? "rule" : "habit", title: formTitle, frequency: formFreq });
                                    setMode("main");
                                }, `${mode === "create-habit" ? "習慣" : mode === "create-rule" ? "マイルール" : "タスク"}を追加しました。記録タブに出ます`)}
                            >追加</PrimaryBtn>
                        </div>
                    </div>
                )}

                {cell && mode === "achieve" && (
                    <div style={{ display: "grid", gap: 12, borderTop: `1px solid ${theme.border}`, paddingTop: 14 }}>
                        <h3 style={{ margin: 0, fontSize: 16 }}>「{savedText}」を達成にする</h3>
                        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: theme.subtext }}>
                            達成にしたマスは、進み具合で 100% として数えます。あとから取り消せます。
                        </p>
                        {activeHabits.length > 0 ? (
                            <>
                                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7 }}>
                                    ひもづいた{habitsLabel}（{activeHabits.map((t) => `「${t.title}」`).join("")}）はどうしますか？
                                    終えた{habitsLabel}は記録タブに出なくなります（これまでの記録は残ります）。
                                </p>
                                <PrimaryBtn fullWidth disabled={busy}
                                    onClick={() => run(async () => { await mandala.achieveCell(cell, false); setMode("main"); }, "達成にしました")}>
                                    達成にする（{habitsLabel}は続ける）
                                </PrimaryBtn>
                                <SecondaryBtn fullWidth disabled={busy}
                                    onClick={() => run(async () => { await mandala.achieveCell(cell, true); setMode("main"); }, `達成にしました。${habitsLabel}を終えました`)}>
                                    達成にする（{habitsLabel}も終える）
                                </SecondaryBtn>
                                <button type="button" onClick={() => setMode("main")}
                                    style={{ minHeight: 44, border: "none", background: "none", color: theme.subtext, fontSize: 14, cursor: "pointer" }}>キャンセル</button>
                            </>
                        ) : (
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                <SecondaryBtn fullWidth onClick={() => setMode("main")}>キャンセル</SecondaryBtn>
                                <PrimaryBtn fullWidth disabled={busy}
                                    onClick={() => run(async () => { await mandala.achieveCell(cell, false); setMode("main"); }, "達成にしました")}>
                                    達成にする
                                </PrimaryBtn>
                            </div>
                        )}
                    </div>
                )}

                {cell && mode === "pick" && (
                    <TaskPicker
                        tasks={tasks}
                        currentCellId={cell.id}
                        taskStateOf={mandala.taskStateOf}
                        cellLabel={cellLabel}
                        busy={busy}
                        onPick={(t) => run(async () => { await mandala.linkTask(t, cell); setMode("main"); }, "ひもづけました")}
                        onCancel={() => setMode("main")}
                    />
                )}
            </div>
        </div>
    );
}
