import { useMemo, useState } from "react";
import { theme } from "../../../lib/ui/theme";
import type { MandalaCell, Task } from "../../../lib/types";
import type { MandalaState } from "../../../lib/mandala/useMandala";
import { actionRate, elementRate, namedElements, rateText, type ElementModel } from "../../../lib/mandala/chart";
import { currentFrequency, frequencyLabel, isValidFrequency, type Frequency } from "../../../lib/mandala/frequency";
import { isCounted } from "../../../lib/mandala/progress";
import { isRepeating, KIND_LABEL } from "../../../lib/taskKind";
import { DECISION_LABELS, parseSnapshot, RECORD_LABELS, recordKind, type ReviewDecision } from "../../../lib/mandala/review";
import { localDateLabel } from "../../../lib/mandala/dates";
import PrimaryBtn from "../../ui/PrimaryBtn";
import SecondaryBtn from "../../ui/SecondaryBtn";
import TextInput from "../../ui/TextInput";
import { CloseIcon } from "../../ui/Icon";
import FrequencyPicker from "../register/FrequencyPicker";

const DAILY: Frequency = { kind: "daily", count: null, days: null };
const FIRST_SHOWN = 5;

type Row = { element: ElementModel; cell: MandalaCell; rate: number | null; linked: Task[]; sort: number };

/**
 * チャートの見直し(好きなタイミングで行う)。
 * 1. 結果を見る(要素ごとの進み具合と、前回の見直しとの差)
 * 2. マスごとに次の手を決める(保存するまでチャートは変わらない)
 * 3. メモを残して保存 → 見直す前のチャートと結果・決めたこと・メモが記録として残る
 */
export default function ReviewFlow({
    mandala,
    adHeight,
    setMsg,
    onDone,
}: {
    mandala: MandalaState;
    adHeight: number;
    setMsg: (s: string) => void;
    onDone: () => void;
}) {
    const model = mandala.model!;
    const [decisions, setDecisions] = useState<Map<string, ReviewDecision>>(new Map());
    const [good, setGood] = useState("");
    const [next, setNext] = useState("");
    const [showAll, setShowAll] = useState(false);
    const [editing, setEditing] = useState<Row | null>(null);
    const [saving, setSaving] = useState(false);

    const lastReview = mandala.reviews.length ? mandala.reviews[mandala.reviews.length - 1] : null;
    const lastSnap = lastReview ? parseSnapshot(lastReview.snapshot) : null;
    const named = namedElements(model);

    const rows: Row[] = useMemo(() => {
        const out: Row[] = [];
        for (const el of model.elements) {
            if (!el.name) continue;
            for (const c of el.actions) {
                if (!c || !c.text.trim()) continue;
                const linked = (mandala.byCell.get(c.id) ?? []).filter(isCounted);
                if (!linked.length && c.status === "active") continue;
                const rate = actionRate(c, mandala.byCell, mandala.doneByTask, mandala.period);
                const sort = c.status === "achieved" ? 1000 : c.status === "paused" ? 999 : rate ?? 998;
                out.push({ element: el, cell: c, rate, linked, sort });
            }
        }
        return out.sort((a, b) => a.sort - b.sort);
    }, [model, mandala.byCell, mandala.doneByTask, mandala.period]);

    const decide = (cellId: string, d: ReviewDecision) => {
        setDecisions((prev) => new Map(prev).set(cellId, d));
        setEditing(null);
    };

    const save = async () => {
        setSaving(true);
        try {
            await mandala.saveReview(decisions, { good, next });
            setMsg("見直しを保存しました。見直す前のチャートは「見直しの履歴」で見られます");
            onDone();
        } catch (e: any) {
            setMsg(e?.message ?? "保存できませんでした");
        } finally {
            setSaving(false);
        }
    };

    const h2: React.CSSProperties = { margin: "4px 0 0", fontSize: 15 };
    const shown = showAll ? rows : rows.slice(0, FIRST_SHOWN);

    return (
        <div style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <button type="button" onClick={onDone} style={{ minHeight: 44, border: "none", background: "none", color: theme.subtext, fontSize: 13, cursor: "pointer", padding: 0 }}>キャンセル</button>
                <span style={{ fontSize: 16, fontWeight: 700 }}>チャートの見直し</span>
                <span style={{ width: 64 }} />
            </div>
            <p style={{ margin: "-6px 0 0", fontSize: 12, lineHeight: 1.7, color: theme.subtext }}>
                {lastReview
                    ? `直近7日の結果と、前回の${RECORD_LABELS[recordKind(lastReview)]}（${localDateLabel(lastReview.reviewed_at)}）との差です。`
                    : "直近7日の結果です。初めての見直しです。"}
                決めた内容は、保存したときにチャートと習慣に反映されます。
            </p>

            <h2 style={h2}>1. 結果を見る</h2>
            <div style={{ background: theme.card, borderRadius: 16, padding: "4px 14px" }}>
                {named.map((e) => {
                    const el = model.elements[e];
                    const now = elementRate(el, mandala.byCell, mandala.doneByTask, mandala.period);
                    const prev = lastSnap?.elements[e]?.rate ?? null;
                    const delta = now !== null && prev !== null ? now - prev : null;
                    return (
                        <div key={e} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid #F1F5F9" }}>
                            <span style={{ width: 10, height: 10, borderRadius: 5, background: el.color, flexShrink: 0 }} />
                            <span style={{ width: 76, fontSize: 13, fontWeight: 700, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{el.name}</span>
                            <span style={{ flex: 1, height: 6, borderRadius: 3, background: "#E2E8F0", overflow: "hidden" }}>
                                <span style={{ display: "block", height: 6, width: `${now ?? 0}%`, background: el.color }} />
                            </span>
                            <span style={{ width: 48, textAlign: "right", fontSize: 13, fontWeight: 700 }}>{rateText(now)}</span>
                            <span style={{ width: 44, textAlign: "right", fontSize: 12, fontWeight: 700, color: delta === null ? theme.subtext : delta > 0 ? "#15803D" : delta < 0 ? "#B91C1C" : theme.subtext }}>
                                {delta === null ? (lastSnap ? "新規" : "") : delta > 0 ? `+${delta}` : delta === 0 ? "±0" : delta}
                            </span>
                        </div>
                    );
                })}
            </div>

            <h2 style={h2}>2. マスごとに、次の手を決める</h2>
            <p style={{ margin: "-8px 0 0", fontSize: 12, color: theme.subtext }}>進み具合の低い順です。タップして選びます（選ばなければ「続ける」）</p>
            {rows.length === 0 && (
                <p style={{ margin: 0, fontSize: 13, color: theme.subtext }}>習慣・タスクがひもづいたマスがありません。</p>
            )}
            {shown.map((r) => {
                const d = decisions.get(r.cell.id);
                return (
                    <button key={r.cell.id} type="button" onClick={() => setEditing(r)}
                        style={{ minHeight: 64, border: `1px solid ${theme.border}`, borderRadius: 14, background: theme.card, color: "var(--text)", textAlign: "left", padding: "10px 12px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontFamily: "inherit" }}>
                        <span style={{ width: 10, height: 10, borderRadius: 5, background: r.element.color, flexShrink: 0 }} />
                        <span style={{ flex: 1, minWidth: 0, display: "grid", gap: 3 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.4 }}>{r.element.name} › {r.cell.text}</span>
                            <span style={{ fontSize: 11, color: theme.subtext }}>
                                {r.cell.status === "paused" ? "休止中" : r.cell.status === "achieved" ? "達成"
                                    : r.linked.map((t) => `${t.title}（${isRepeating(t) ? frequencyLabel(currentFrequency(t)) : "タスク"}）`).join("、")}
                            </span>
                            {d && d.kind !== "keep" && (
                                <span style={{ justifySelf: "start", fontSize: 11, fontWeight: 700, color: "#1E3A8A", background: "#DBEAFE", borderRadius: 6, padding: "2px 6px" }}>→ {DECISION_LABELS[d.kind]}</span>
                            )}
                        </span>
                        <b style={{ fontSize: 14 }}>{r.cell.status === "paused" ? "休止" : rateText(r.rate)}</b>
                    </button>
                );
            })}
            {rows.length > FIRST_SHOWN && (
                <button type="button" onClick={() => setShowAll((v) => !v)}
                    style={{ minHeight: 44, border: "none", background: "none", color: theme.habit, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    {showAll ? "少なく表示する" : `すべてのマスを表示（${rows.length}）`}
                </button>
            )}

            <h2 style={h2}>3. メモを残す</h2>
            <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 700 }}>
                よかったこと
                <textarea value={good} onChange={(e) => setGood(e.target.value)} rows={2} placeholder="例: 睡眠の習慣は、ほぼ毎日続けられた" style={textareaStyle} />
            </label>
            <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 700 }}>
                次に変えること
                <textarea value={next} onChange={(e) => setNext(e.target.value)} rows={2} placeholder="例: ジムは仕事の日は無理。家でできることに変える" style={textareaStyle} />
            </label>
            <PrimaryBtn fullWidth disabled={saving} onClick={save} style={{ minHeight: 52 }}>見直しを保存する</PrimaryBtn>
            <p style={{ margin: "-4px 0 8px", fontSize: 12, lineHeight: 1.7, color: theme.subtext }}>
                保存すると、見直す前のチャートと結果・決めたこと・メモが「見直しの履歴」に残ります。習慣・タスクの過去の記録は消えません。
            </p>

            {editing && (
                <DecisionSheet
                    row={editing}
                    current={decisions.get(editing.cell.id) ?? null}
                    adHeight={adHeight}
                    onClose={() => setEditing(null)}
                    onDecide={(d) => decide(editing.cell.id, d)}
                />
            )}
        </div>
    );
}

type Mode = "choose" | "lower" | "change" | "achieve" | "remove";

/** 見直しで、1つのマスの次の手を選ぶシート */
function DecisionSheet({
    row,
    current,
    adHeight,
    onClose,
    onDecide,
}: {
    row: Row;
    current: ReviewDecision | null;
    adHeight: number;
    onClose: () => void;
    onDecide: (d: ReviewDecision) => void;
}) {
    // マイルールも習慣と同じく、頻度を直したり終えたりできる
    const habits = row.linked.filter(isRepeating);
    const [mode, setMode] = useState<Mode>("choose");
    const [taskId, setTaskId] = useState(habits[0]?.id ?? "");
    const target = habits.find((t) => t.id === taskId);
    const [title, setTitle] = useState(target?.title ?? "");
    const [freq, setFreq] = useState<Frequency>(target ? currentFrequency(target) : DAILY);
    const [newText, setNewText] = useState(row.cell.text);

    const pickHabit = (t: Task) => { setTaskId(t.id); setTitle(t.title); setFreq(currentFrequency(t)); };

    const options: { kind: ReviewDecision["kind"]; desc: string; onClick: () => void; disabled?: boolean }[] = [
        { kind: "keep", desc: "順調、または様子を見たい。何も変えません", onClick: () => onDecide({ kind: "keep" }) },
        {
            kind: "lower", desc: "やり方は合っているが、きつい。習慣の回数やタイトルを直します（記録はつながったまま）",
            onClick: () => { if (target) pickHabit(target); setMode("lower"); }, disabled: habits.length === 0,
        },
        { kind: "change", desc: "このやり方は合わなかった。今の習慣を終えて、新しい習慣を作ります", onClick: () => { setTitle(""); setFreq(DAILY); setMode("change"); } },
        { kind: "pause", desc: "今は優先しない。習慣を記録タブから外し、進み具合の計算からも外します", onClick: () => onDecide({ kind: "pause" }), disabled: row.cell.status === "paused" },
        { kind: "achieve", desc: "もう意識しなくてもできる。マスに「達成」の印を付けます", onClick: () => setMode("achieve"), disabled: row.cell.status === "achieved" },
        { kind: "remove", desc: "そもそも要らなかった。マスを空にします（変更の履歴は残ります）", onClick: () => setMode("remove") },
    ];

    return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", zIndex: 100, display: "flex", justifyContent: "center", alignItems: "flex-end" }} onClick={onClose}>
            <div role="dialog" aria-label="次の手を決める" onClick={(e) => e.stopPropagation()}
                style={{
                    width: "100%", maxWidth: 600, boxSizing: "border-box", background: "var(--bg)",
                    maxHeight: `calc(100dvh - max(env(safe-area-inset-top, 0px), 24px) - ${adHeight}px)`,
                    borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: "20px 16px calc(24px + env(safe-area-inset-bottom, 0px))",
                    overflowY: "auto", display: "grid", gap: 12, alignContent: "start",
                }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 5, background: row.element.color }} />
                        見直し ・ {row.element.name} › {row.cell.text}
                    </span>
                    <button type="button" aria-label="閉じる" onClick={onClose}
                        style={{ width: 44, height: 44, borderRadius: 22, border: "none", background: "rgba(0,0,0,0.05)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text)" }}>
                        <CloseIcon size={18} />
                    </button>
                </div>
                <div style={{ background: theme.card, borderRadius: 12, padding: "10px 12px", display: "grid", gap: 4 }}>
                    {row.linked.length === 0 && <span style={{ fontSize: 12, color: theme.subtext }}>習慣・タスクはひもづいていません</span>}
                    {row.linked.map((t) => (
                        <span key={t.id} style={{ fontSize: 12 }}>{KIND_LABEL[t.task_type]} ・ {t.title}（{isRepeating(t) ? frequencyLabel(currentFrequency(t)) : "タスク"}）</span>
                    ))}
                    <span style={{ fontSize: 12, fontWeight: 700 }}>直近7日：{row.cell.status === "paused" ? "休止中" : rateText(row.rate)}</span>
                </div>

                {mode === "choose" && options.map((o) => (
                    <button key={o.kind} type="button" disabled={o.disabled} onClick={o.onClick}
                        style={{
                            minHeight: 56, border: `1px solid ${current?.kind === o.kind ? theme.habit : theme.border}`, borderRadius: 12,
                            background: theme.card, color: "var(--text)", textAlign: "left", padding: "8px 12px", display: "grid", gap: 2,
                            cursor: o.disabled ? "default" : "pointer", opacity: o.disabled ? 0.45 : 1, fontFamily: "inherit",
                        }}>
                        <span style={{ fontSize: 14, fontWeight: 700 }}>{DECISION_LABELS[o.kind]}{current?.kind === o.kind ? "（選択中）" : ""}</span>
                        <span style={{ fontSize: 12, color: theme.subtext, lineHeight: 1.5 }}>{o.desc}</span>
                    </button>
                ))}

                {mode === "lower" && (
                    <>
                        <h3 style={{ margin: 0, fontSize: 16 }}>ハードルを下げる</h3>
                        <p style={{ margin: 0, fontSize: 12, color: theme.subtext }}>同じ習慣を直すので、これまでの記録はつながったままです。頻度を変えると、今日から新しい頻度で数えます。</p>
                        {habits.length > 1 && (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                {habits.map((t) => (
                                    <button key={t.id} type="button" aria-pressed={t.id === taskId} onClick={() => pickHabit(t)}
                                        style={{ minHeight: 40, borderRadius: 10, padding: "0 12px", fontSize: 13, fontWeight: 700, cursor: "pointer", border: `1px solid ${t.id === taskId ? theme.habit : theme.border}`, background: t.id === taskId ? theme.habit : theme.card, color: t.id === taskId ? "#fff" : "var(--text)" }}>
                                        {t.title}
                                    </button>
                                ))}
                            </div>
                        )}
                        <label style={{ display: "grid", gap: 6, fontSize: 14 }}>習慣のタイトル<TextInput value={title} onChange={(e) => setTitle(e.target.value)} fullWidth /></label>
                        <FrequencyPicker value={freq} onChange={setFreq} />
                        <FormButtons
                            onBack={() => setMode("choose")}
                            disabled={!title.trim() || !isValidFrequency(freq) || !taskId}
                            onSubmit={() => onDecide({ kind: "lower", taskId, title, frequency: freq })}
                        />
                    </>
                )}

                {mode === "change" && (
                    <>
                        <h3 style={{ margin: 0, fontSize: 16 }}>やり方を変える</h3>
                        <p style={{ margin: 0, fontSize: 12, color: theme.subtext }}>今の習慣は終了します（記録は残ります）。新しい習慣は、今日から数えます。</p>
                        <label style={{ display: "grid", gap: 6, fontSize: 14 }}>新しい行動目標（マスの文言）<TextInput value={newText} onChange={(e) => setNewText(e.target.value)} fullWidth /></label>
                        <label style={{ display: "grid", gap: 6, fontSize: 14 }}>新しい習慣（空ならマスの文言だけ変える）<TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例: 帰宅後にスクワット10回" fullWidth /></label>
                        {title.trim() && <FrequencyPicker value={freq} onChange={setFreq} />}
                        <FormButtons
                            onBack={() => setMode("choose")}
                            disabled={!newText.trim() || (!!title.trim() && !isValidFrequency(freq))}
                            onSubmit={() => onDecide({ kind: "change", newText, newHabit: title.trim() ? { title, frequency: freq } : null })}
                        />
                    </>
                )}

                {(mode === "achieve" || mode === "remove") && (
                    <>
                        <h3 style={{ margin: 0, fontSize: 16 }}>{DECISION_LABELS[mode]}</h3>
                        <p style={{ margin: 0, fontSize: 12, color: theme.subtext }}>
                            {mode === "achieve" ? "マスに「達成」の印が付き、要素の進み具合では 100% として数えます。" : "マスを空にします。変更の履歴は残ります。"}
                        </p>
                        <SecondaryBtn fullWidth onClick={() => onDecide({ kind: mode, endHabits: false })}>
                            {mode === "achieve" ? "習慣は続ける" : "習慣は記録タブに残す"}
                        </SecondaryBtn>
                        <PrimaryBtn fullWidth onClick={() => onDecide({ kind: mode, endHabits: true })}>習慣も終える（記録は残る）</PrimaryBtn>
                        <SecondaryBtn fullWidth onClick={() => setMode("choose")}>選び直す</SecondaryBtn>
                    </>
                )}
            </div>
        </div>
    );
}

function FormButtons({ onBack, onSubmit, disabled }: { onBack: () => void; onSubmit: () => void; disabled: boolean }) {
    return (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <SecondaryBtn fullWidth onClick={onBack}>選び直す</SecondaryBtn>
            <PrimaryBtn fullWidth disabled={disabled} onClick={onSubmit}>決める</PrimaryBtn>
        </div>
    );
}

const textareaStyle: React.CSSProperties = {
    resize: "none", borderRadius: 12, border: `1px solid ${theme.border}`, padding: "10px 14px", fontSize: 15,
    lineHeight: 1.5, fontFamily: "inherit", background: theme.card, color: "var(--text)", fontWeight: 400,
};
