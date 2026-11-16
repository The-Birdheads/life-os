import { useState } from "react";
import { theme } from "../../../lib/ui/theme";
import { AROUND, ELEMENT_COLORS } from "../../../lib/mandala/chart";
import { emptyDraft, type ChartDraft } from "../../../lib/mandala/useMandala";
import PrimaryBtn from "../../ui/PrimaryBtn";
import SecondaryBtn from "../../ui/SecondaryBtn";
import TextInput from "../../ui/TextInput";
import { ChevronLeftIcon, ChevronRightIcon } from "../../ui/Icon";
import ChartGridEditor from "./ChartGridEditor";

type Mode = "steps" | "grid";

// 前に選んだ作り方を覚えておく(端末ごと。読めなければステップで始める)
const MODE_KEY = "habitas.chartWizard.mode";
function readMode(): Mode {
    try { return localStorage.getItem(MODE_KEY) === "grid" ? "grid" : "steps"; } catch { return "steps"; }
}
function saveMode(m: Mode) {
    try { localStorage.setItem(MODE_KEY, m); } catch { /* 覚えられなくても、毎回ステップで始まるだけ */ }
}

/**
 * チャートの作成。作り方は2つから選べる(途中で切り替えても、書いた内容はそのまま)。
 * - ステップで作る: 大目標 → 8つの要素 → 要素ごとの行動目標(はじめての人向け)
 * - 9×9 で作る: 紙のマンダラチャートと同じ表に、好きな順で書く(マンダラチャートを使ったことがある人向け)
 * 全部埋めなくても「完了」できる。保存は最後にまとめて行う(キャンセルすると何も残らない)。
 * replacing: 今のチャートを終えて、新しいチャートを作るとき
 * initial: 今のチャートを引き継ぐときの下書き(大目標・要素・行動目標を入れた状態で始める)
 */
export default function ChartWizard({
    replacing = false,
    initial,
    onCancel,
    onSave,
}: {
    replacing?: boolean;
    initial?: ChartDraft;
    onCancel: () => void;
    onSave: (draft: ChartDraft) => Promise<void>;
}) {
    const [draft, setDraft] = useState<ChartDraft>(() => initial ?? emptyDraft());
    const carrying = !!initial;
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [wizElem, setWizElem] = useState(0);
    const [saving, setSaving] = useState(false);
    const [mode, setModeState] = useState<Mode>(readMode);
    const setMode = (m: Mode) => {
        setModeState(m);
        saveMode(m);
        // 9×9 で書いた内容に合わせて、ステップの位置を戻す(大目標が無ければ 1、要素が無ければ 2)
        if (m === "steps") setStep((s) => (!draft.title.trim() ? 1 : s === 3 && !draft.elements.some((x) => x.trim()) ? 2 : s));
    };

    const named = draft.elements.map((n, i) => (n.trim() ? i : -1)).filter((i) => i >= 0);
    const curElem = named.length ? named[Math.min(wizElem, named.length - 1)] : 0;

    const setElement = (e: number, v: string) =>
        setDraft((d) => ({ ...d, elements: d.elements.map((x, i) => (i === e ? v : x)) }));
    const setAction = (e: number, a: number, v: string) =>
        setDraft((d) => ({ ...d, actions: d.actions.map((row, i) => (i === e ? row.map((x, j) => (j === a ? v : x)) : row)) }));

    const save = async () => {
        setSaving(true);
        try {
            await onSave(draft);
        } finally {
            setSaving(false);
        }
    };

    const cellBox: React.CSSProperties = {
        height: 100, borderRadius: 12, boxSizing: "border-box", padding: 8,
        display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center",
        fontSize: 13, fontWeight: 700, lineHeight: 1.4, wordBreak: "break-word",
    };
    const textarea = (value: string, onChange: (v: string) => void, placeholder: string, label: string, color: string) => (
        <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            aria-label={label}
            rows={3}
            style={{
                ...cellBox, width: "100%", resize: "none", fontFamily: "inherit", fontWeight: 600, fontSize: 12,
                border: `2px solid ${value.trim() ? color : theme.border}`, background: theme.card, color: "var(--text)",
            }}
        />
    );

    return (
        <div style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: theme.subtext }}>
                    {replacing ? "新しいチャートの作成" : "チャートの作成"}{mode === "steps" && `　ステップ ${step}/3`}
                </span>
                <button type="button" onClick={onCancel} style={{ minHeight: 44, border: "none", background: "none", color: theme.subtext, fontSize: 13, cursor: "pointer" }}>キャンセル</button>
            </div>
            <div role="radiogroup" aria-label="作り方" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, padding: 4, borderRadius: 12, background: theme.card, border: `1px solid ${theme.border}`, marginTop: -8 }}>
                {([["steps", "ステップで作る", "はじめての人に"], ["grid", "9×9 で作る", "使ったことがある人に"]] as const).map(([m, title, sub]) => (
                    <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)}
                        style={{
                            minHeight: 48, borderRadius: 9, border: "none", cursor: "pointer", fontFamily: "inherit", display: "grid", gap: 1, alignContent: "center",
                            background: mode === m ? "#1E293B" : "transparent", color: mode === m ? "#F8FAFC" : "var(--text)",
                        }}>
                        <span style={{ fontSize: 13, fontWeight: 700 }}>{title}</span>
                        <span style={{ fontSize: 10, opacity: 0.75 }}>{sub}</span>
                    </button>
                ))}
            </div>
            {mode === "steps" && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6, marginTop: -4 }}>
                    {[1, 2, 3].map((n) => <span key={n} style={{ height: 4, borderRadius: 2, background: n <= step ? theme.habit : theme.border }} />)}
                </div>
            )}

            {mode === "grid" && (
                <div style={{ display: "grid", gap: 12 }}>
                    {carrying && (
                        <p style={{ margin: 0, fontSize: 12, lineHeight: 1.7, color: theme.subtext, background: theme.card, borderRadius: 10, padding: "8px 10px" }}>
                            今のチャートの内容が入っています。直したいマスだけ書き換えてください。文言を変えなかった行動目標は、ひもづいた習慣・タスクを引き継ぎます。
                        </p>
                    )}
                    <ChartGridEditor draft={draft} setDraft={setDraft} />
                    <label style={{ display: "grid", gap: 6, fontSize: 14 }}>
                        いつまでに（任意）
                        <TextInput type="date" value={draft.endDate ?? ""} onChange={(e) => setDraft({ ...draft, endDate: e.target.value || null })} fullWidth />
                    </label>
                    <PrimaryBtn fullWidth disabled={saving || !draft.title.trim()} onClick={save} style={{ minHeight: 52 }}>完了</PrimaryBtn>
                    <p style={{ margin: "-4px 0 0", fontSize: 12, lineHeight: 1.7, color: theme.subtext }}>
                        {draft.title.trim()
                            ? "全部埋めなくても、ここまでの内容で保存できます。空いたマスは、チャートからいつでも書けます。"
                            : "まん中の大目標を書くと、保存できます。"}
                    </p>
                </div>
            )}

            {mode === "steps" && step === 1 && (
                <div style={{ display: "grid", gap: 12 }}>
                    <h2 style={{ margin: "8px 0 0", fontSize: 20 }}>どんな自分になりたい？</h2>
                    {carrying && (
                        <p style={{ margin: 0, fontSize: 12, lineHeight: 1.7, color: theme.subtext, background: theme.card, borderRadius: 10, padding: "8px 10px" }}>
                            今のチャートの内容が入っています。直したいところだけ変えてください。文言を変えなかった行動目標は、ひもづいた習慣・タスクを引き継ぎます。進み具合は、作った日から数え直します。
                        </p>
                    )}
                    <label style={{ display: "grid", gap: 6, fontSize: 14 }}>
                        大目標
                        <TextInput value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="例: 健康的な体をつくる" fullWidth />
                    </label>
                    <label style={{ display: "grid", gap: 6, fontSize: 14 }}>
                        いつまでに（任意）
                        <TextInput type="date" value={draft.endDate ?? ""} onChange={(e) => setDraft({ ...draft, endDate: e.target.value || null })} fullWidth />
                    </label>
                    <PrimaryBtn fullWidth disabled={!draft.title.trim()} onClick={() => setStep(2)} style={{ marginTop: 12 }}>次へ</PrimaryBtn>
                </div>
            )}

            {mode === "steps" && step === 2 && (
                <div style={{ display: "grid", gap: 10 }}>
                    <h2 style={{ margin: "8px 0 0", fontSize: 18, lineHeight: 1.5 }}>大目標のために必要なことを、8 つ挙げよう</h2>
                    <p style={{ margin: 0, fontSize: 12, color: theme.subtext }}>マスに書き込みます。空いたマスは、あとで埋められます</p>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6 }}>
                        {Array.from({ length: 9 }, (_, pos) => {
                            if (pos === 4) return <div key={pos} style={{ ...cellBox, background: "#1E293B", color: "#F8FAFC" }}>{draft.title}</div>;
                            const e = AROUND.indexOf(pos as (typeof AROUND)[number]);
                            return <div key={pos}>{textarea(draft.elements[e], (v) => setElement(e, v), `要素 ${e + 1}`, `要素${e + 1}`, ELEMENT_COLORS[e])}</div>;
                        })}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
                        <SecondaryBtn fullWidth onClick={() => setStep(1)}>戻る</SecondaryBtn>
                        <PrimaryBtn fullWidth disabled={named.length === 0} onClick={() => { setWizElem(0); setStep(3); }}>次へ</PrimaryBtn>
                    </div>
                </div>
            )}

            {mode === "steps" && step === 3 && (
                <div style={{ display: "grid", gap: 10 }}>
                    <h2 style={{ margin: "8px 0 0", fontSize: 18, lineHeight: 1.5 }}>「{draft.elements[curElem]}」のために、できることは？</h2>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <button type="button" aria-label="前の要素" onClick={() => setWizElem((i) => (i - 1 + named.length) % named.length)} style={navBtn}><ChevronLeftIcon size={18} /></button>
                        <span style={{ fontSize: 13, fontWeight: 700 }}>{draft.elements[curElem]}（{named.indexOf(curElem) + 1}/{named.length}）</span>
                        <button type="button" aria-label="次の要素" onClick={() => setWizElem((i) => (i + 1) % named.length)} style={navBtn}><ChevronRightIcon size={18} /></button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6 }}>
                        {Array.from({ length: 9 }, (_, pos) => {
                            if (pos === 4) return <div key={pos} style={{ ...cellBox, background: ELEMENT_COLORS[curElem], color: "#fff" }}>{draft.elements[curElem]}</div>;
                            const a = AROUND.indexOf(pos as (typeof AROUND)[number]);
                            return <div key={pos}>{textarea(draft.actions[curElem][a], (v) => setAction(curElem, a, v), "行動目標", `行動目標${a + 1}`, ELEMENT_COLORS[curElem])}</div>;
                        })}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
                        <SecondaryBtn fullWidth disabled={saving} onClick={save}>あとで</SecondaryBtn>
                        <PrimaryBtn fullWidth disabled={saving} onClick={save}>完了</PrimaryBtn>
                    </div>
                    <p style={{ margin: 0, fontSize: 12, color: theme.subtext }}>
                        {carrying
                            ? "文言を変えた行動目標は、習慣・タスクのひもづけが外れます（習慣・タスクと記録は残ります）。"
                            : "「あとで」でも、ここまでの内容は保存されます。空いたマスは、チャートからいつでも書けます。"}
                    </p>
                </div>
            )}
        </div>
    );
}

const navBtn: React.CSSProperties = {
    width: 44, height: 44, borderRadius: 12, border: `1px solid ${theme.border}`, background: theme.card,
    display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text)",
};
