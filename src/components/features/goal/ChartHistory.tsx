import { useState } from "react";
import { theme } from "../../../lib/ui/theme";
import type { MandalaReview } from "../../../lib/types";
import { AROUND, rateText, rateTint, type ChartModel } from "../../../lib/mandala/chart";
import { localDateLabel } from "../../../lib/mandala/dates";
import { parseSnapshot, RECORD_LABELS, recordKind, type ReviewSnapshot } from "../../../lib/mandala/review";
import PrimaryBtn from "../../ui/PrimaryBtn";
import TextInput from "../../ui/TextInput";
import { ChevronLeftIcon, ChevronRightIcon } from "../../ui/Icon";

/**
 * チャートの履歴。見直し・保存・終えたときの保存の一覧と、その時点のチャート(当時の進み具合・見るだけ)。
 * onSave があれば(使用中のチャート)、一覧の上に「今の状態を保存する」を出す。
 * compareNow なら、今と文言が違うマスに、今の文言を添える(何を変えたかを比べられるように)。
 */
export default function ChartHistory({
    title,
    backLabel,
    onBack,
    records,
    model,
    compareNow = false,
    onSave,
    pastCount = 0,
    onOpenPast,
    emptyText,
}: {
    title: string;
    backLabel: string;
    onBack: () => void;
    records: MandalaReview[];
    model: ChartModel;
    compareNow?: boolean;
    onSave?: (note: string) => Promise<void>;
    pastCount?: number;
    onOpenPast?: () => void;
    emptyText: string;
}) {
    const [openId, setOpenId] = useState<string | null>(null);
    const [note, setNote] = useState("");
    const [saving, setSaving] = useState(false);
    const record = records.find((r) => r.id === openId) ?? null;
    const snap = record ? parseSnapshot(record.snapshot) : null;

    if (record && snap) {
        const kind = recordKind(record);
        return (
            <div style={{ display: "grid", gap: 12 }}>
                <HistoryHeader title={`${localDateLabel(record.reviewed_at)} の${RECORD_LABELS[kind]}`} backLabel="履歴へ" onBack={() => setOpenId(null)} />
                <SnapshotView
                    snap={snap}
                    model={compareNow ? model : null}
                    intro={kind === "review" ? "見直す前のチャートと、その時点の進み具合" : "保存した時点のチャートと進み具合"}
                />
                {kind === "review" ? (
                    <div style={notesBox}>
                        <span style={notesLabel}>この見直しで決めたこと</span>
                        {record.decisions.length === 0
                            ? <span style={{ fontSize: 13, color: theme.subtext }}>（すべて「続ける」）</span>
                            : record.decisions.map((d, i) => <span key={i} style={{ fontSize: 13, lineHeight: 1.6 }}>・{d}</span>)}
                        <span style={{ ...notesLabel, marginTop: 6 }}>よかったこと</span>
                        <span style={{ fontSize: 13, lineHeight: 1.6 }}>{record.good_note || "（なし）"}</span>
                        <span style={{ ...notesLabel, marginTop: 6 }}>次に変えること</span>
                        <span style={{ fontSize: 13, lineHeight: 1.6 }}>{record.next_note || "（なし）"}</span>
                    </div>
                ) : record.good_note && (
                    <div style={notesBox}>
                        <span style={notesLabel}>メモ</span>
                        <span style={{ fontSize: 13, lineHeight: 1.6 }}>{record.good_note}</span>
                    </div>
                )}
            </div>
        );
    }

    const save = async () => {
        if (!onSave) return;
        setSaving(true);
        try {
            await onSave(note);
            setNote("");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{ display: "grid", gap: 12 }}>
            <HistoryHeader title={title} backLabel={backLabel} onBack={onBack} />
            {onSave && (
                <div style={{ display: "grid", gap: 8, background: theme.card, borderRadius: 16, padding: 14 }}>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>今の状態を保存する</span>
                    <span style={{ fontSize: 12, lineHeight: 1.6, color: theme.subtext }}>今のチャートと、直近 7 日の進み具合を履歴に残します</span>
                    <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="メモ（任意）" fullWidth />
                    <PrimaryBtn fullWidth disabled={saving} onClick={save}>保存する</PrimaryBtn>
                </div>
            )}
            {records.length === 0 && (
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: theme.subtext, background: theme.card, borderRadius: 14, padding: 14 }}>
                    {emptyText}
                </p>
            )}
            {[...records].reverse().map((r) => {
                const kind = recordKind(r);
                return (
                    <button key={r.id} type="button" onClick={() => setOpenId(r.id)} style={listItem}>
                        <span style={{ fontSize: 14, fontWeight: 700 }}>{localDateLabel(r.reviewed_at)} の{RECORD_LABELS[kind]}</span>
                        {kind === "review" && <span style={{ fontSize: 12, color: theme.subtext }}>決めたこと {r.decisions.length} 件</span>}
                        {kind === "review" && r.next_note && <span style={{ fontSize: 12, lineHeight: 1.6 }}>次に変えること：{r.next_note}</span>}
                        {kind !== "review" && r.good_note && <span style={{ fontSize: 12, lineHeight: 1.6 }}>メモ：{r.good_note}</span>}
                    </button>
                );
            })}
            {onOpenPast && pastCount > 0 && (
                <button type="button" onClick={onOpenPast} style={{ ...listItem, marginTop: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>過去のチャート（{pastCount}）</span>
                    <ChevronRightIcon size={18} />
                </button>
            )}
        </div>
    );
}

export function HistoryHeader({ title, backLabel, onBack }: { title: string; backLabel: string; onBack: () => void }) {
    return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <button type="button" onClick={onBack} style={backBtn}><ChevronLeftIcon size={18} />{backLabel}</button>
            <span style={{ fontSize: 15, fontWeight: 700, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
            <span style={{ width: 64, flexShrink: 0 }} />
        </div>
    );
}

/**
 * 保存したチャート(3×3 と、選んだ要素の行動目標)。見るだけ。
 * model を渡すと、今と文言が違うマスに今の文言を添える
 */
export function SnapshotView({ snap, model, intro }: { snap: ReviewSnapshot; model: ChartModel | null; intro: string }) {
    const [elem, setElem] = useState<number | null>(null);
    const el = elem !== null ? snap.elements[elem] : null;
    const range = `${snap.period.from.slice(5).replace("-", "/")}〜${snap.period.to.slice(5).replace("-", "/")}`;

    return (
        <>
            <p style={{ margin: "-6px 0 0", fontSize: 12, lineHeight: 1.7, color: theme.subtext }}>
                {intro}（{range}）です。要素をタップすると中身を表示します。
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6 }}>
                {Array.from({ length: 9 }, (_, pos) => {
                    if (pos === 4) {
                        return <div key={pos} style={{ ...tile, background: "#1E293B", color: "#F8FAFC", border: "2px solid #1E293B" }}><span style={{ fontSize: 12, fontWeight: 700 }}>{snap.title}</span></div>;
                    }
                    const e = AROUND.indexOf(pos as (typeof AROUND)[number]);
                    const s = snap.elements[e];
                    if (!s?.name) return <div key={pos} style={{ ...tile, background: "#F8FAFC", border: "2px solid #E2E8F0" }} />;
                    const t = rateTint(s.color, s.rate);
                    return (
                        <button key={pos} type="button" aria-label={`${s.name} 当時 ${rateText(s.rate)}`} onClick={() => setElem(e)}
                            style={{ ...tile, background: t.bg, color: t.fg, border: `2px solid ${elem === e ? "#0F172A" : t.border}`, cursor: "pointer", fontFamily: "inherit" }}>
                            <span style={{ fontSize: 12, fontWeight: 700 }}>{s.name}</span>
                            <span style={{ fontSize: 12, fontWeight: 700 }}>{rateText(s.rate)}</span>
                        </button>
                    );
                })}
            </div>

            {el && (
                <div style={{ display: "grid", gap: 0, background: theme.card, borderRadius: 16, padding: "12px 12px 4px" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 5, background: el.color }} />{el.name}（当時）
                    </span>
                    {el.cells.length === 0 && <span style={{ fontSize: 12, color: theme.subtext, padding: "8px 0" }}>行動目標はありませんでした</span>}
                    {el.cells.map((c) => {
                        const nowText = model ? model.elements[el.index]?.actions[c.index]?.text ?? "" : c.text;
                        return (
                            <div key={c.index} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 0", borderTop: "1px solid #F1F5F9" }}>
                                <span style={{ flex: 1, minWidth: 0, display: "grid", gap: 3 }}>
                                    <span style={{ fontSize: 13, fontWeight: 700 }}>{c.text}</span>
                                    <span style={{ fontSize: 11, color: theme.subtext }}>
                                        {c.status === "paused" ? "休止中 ・ " : c.status === "achieved" ? "達成 ・ " : ""}
                                        {c.tasks.length ? c.tasks.map((t) => `${t.title}${t.frequency ? `（${t.frequency}）` : ""}`).join("、") : "習慣・タスクなし"}
                                    </span>
                                    {nowText !== c.text && (
                                        <span style={{ justifySelf: "start", fontSize: 11, fontWeight: 700, color: "#9A3412", background: "#FFEDD5", borderRadius: 6, padding: "2px 6px" }}>
                                            今は「{nowText || "（空き）"}」
                                        </span>
                                    )}
                                </span>
                                <b style={{ fontSize: 13 }}>{c.status === "paused" ? "休止" : rateText(c.rate)}</b>
                            </div>
                        );
                    })}
                </div>
            )}
        </>
    );
}

const tile: React.CSSProperties = {
    height: 84, borderRadius: 12, boxSizing: "border-box", padding: 6, display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center", gap: 4, textAlign: "center",
};
const backBtn: React.CSSProperties = {
    minHeight: 44, border: "none", background: "none", color: "#1D4ED8", fontSize: 14, fontWeight: 700,
    padding: 0, display: "flex", alignItems: "center", gap: 2, cursor: "pointer", flexShrink: 0,
};
const listItem: React.CSSProperties = {
    border: `1px solid ${theme.border}`, borderRadius: 14, background: theme.card, color: "var(--text)",
    textAlign: "left", padding: "12px 14px", display: "grid", gap: 4, cursor: "pointer", fontFamily: "inherit",
};
const notesBox: React.CSSProperties = { display: "grid", gap: 6, background: theme.card, borderRadius: 16, padding: 14 };
const notesLabel: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: theme.subtext };
