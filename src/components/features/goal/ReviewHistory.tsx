import { useState } from "react";
import { theme } from "../../../lib/ui/theme";
import type { MandalaReview } from "../../../lib/types";
import { AROUND, rateText, rateTint, type ChartModel } from "../../../lib/mandala/chart";
import { localDateLabel } from "../../../lib/mandala/dates";
import { parseSnapshot } from "../../../lib/mandala/review";
import { ChevronLeftIcon } from "../../ui/Icon";

/**
 * 見直しの履歴。見直しの一覧と、見直す前のチャート(当時の進み具合・見るだけ)。
 * 今と文言が違うマスには、今の文言を添える(何を変えたかを比べられるように)。
 */
export default function ReviewHistory({
    reviews,
    model,
    onBack,
}: {
    reviews: MandalaReview[];
    model: ChartModel;
    onBack: () => void;
}) {
    const [openId, setOpenId] = useState<string | null>(null);
    const [elem, setElem] = useState<number | null>(null);
    const review = reviews.find((r) => r.id === openId) ?? null;
    const snap = review ? parseSnapshot(review.snapshot) : null;

    const header = (title: string, back: () => void, backLabel: string) => (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <button type="button" onClick={back} style={backBtn}><ChevronLeftIcon size={18} />{backLabel}</button>
            <span style={{ fontSize: 15, fontWeight: 700 }}>{title}</span>
            <span style={{ width: 64 }} />
        </div>
    );

    if (!review || !snap) {
        return (
            <div style={{ display: "grid", gap: 12 }}>
                {header("見直しの履歴", onBack, "中心へ")}
                {reviews.length === 0 && (
                    <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: theme.subtext, background: theme.card, borderRadius: 14, padding: 14 }}>
                        まだ見直しをしていません。チャートの「見直す」から、好きなタイミングで見直せます。
                    </p>
                )}
                {[...reviews].reverse().map((r) => (
                    <button key={r.id} type="button" onClick={() => { setOpenId(r.id); setElem(null); }}
                        style={{ border: `1px solid ${theme.border}`, borderRadius: 14, background: theme.card, color: "var(--text)", textAlign: "left", padding: "12px 14px", display: "grid", gap: 4, cursor: "pointer", fontFamily: "inherit" }}>
                        <span style={{ fontSize: 14, fontWeight: 700 }}>{localDateLabel(r.reviewed_at)} の見直し</span>
                        <span style={{ fontSize: 12, color: theme.subtext }}>決めたこと {r.decisions.length} 件</span>
                        {r.next_note && <span style={{ fontSize: 12, lineHeight: 1.6 }}>次に変えること：{r.next_note}</span>}
                    </button>
                ))}
            </div>
        );
    }

    const el = elem !== null ? snap.elements[elem] : null;
    return (
        <div style={{ display: "grid", gap: 12 }}>
            {header(`${localDateLabel(review.reviewed_at)} の見直し`, () => setOpenId(null), "履歴へ")}
            <p style={{ margin: "-6px 0 0", fontSize: 12, lineHeight: 1.7, color: theme.subtext }}>
                見直す前のチャートと、その時点の進み具合（{snap.period.from.slice(5).replace("-", "/")}〜{snap.period.to.slice(5).replace("-", "/")}）です。要素をタップすると中身を表示します。
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
                        const nowText = model.elements[el.index]?.actions[c.index]?.text ?? "";
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

            <div style={{ display: "grid", gap: 6, background: theme.card, borderRadius: 16, padding: 14 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: theme.subtext }}>この見直しで決めたこと</span>
                {review.decisions.length === 0
                    ? <span style={{ fontSize: 13, color: theme.subtext }}>（すべて「続ける」）</span>
                    : review.decisions.map((d, i) => <span key={i} style={{ fontSize: 13, lineHeight: 1.6 }}>・{d}</span>)}
                <span style={{ marginTop: 6, fontSize: 13, fontWeight: 700, color: theme.subtext }}>よかったこと</span>
                <span style={{ fontSize: 13, lineHeight: 1.6 }}>{review.good_note || "（なし）"}</span>
                <span style={{ marginTop: 6, fontSize: 13, fontWeight: 700, color: theme.subtext }}>次に変えること</span>
                <span style={{ fontSize: 13, lineHeight: 1.6 }}>{review.next_note || "（なし）"}</span>
            </div>
        </div>
    );
}

const tile: React.CSSProperties = {
    height: 84, borderRadius: 12, boxSizing: "border-box", padding: 6, display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center", gap: 4, textAlign: "center",
};
const backBtn: React.CSSProperties = {
    minHeight: 44, border: "none", background: "none", color: "#1D4ED8", fontSize: 14, fontWeight: 700,
    padding: 0, display: "flex", alignItems: "center", gap: 2, cursor: "pointer",
};
