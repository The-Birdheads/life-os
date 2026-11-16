import { useEffect, useRef, useState } from "react";
import { theme } from "../../../lib/ui/theme";
import { ELEMENT_COLORS } from "../../../lib/mandala/chart";
import { sameSlot, slotAt, slotOrder, type Slot } from "../../../lib/mandala/gridSlots";
import type { ChartDraft } from "../../../lib/mandala/useMandala";
import TextInput from "../../ui/TextInput";
import { ChevronLeftIcon, ChevronRightIcon } from "../../ui/Icon";

/**
 * マンダラチャートを、最初から 9×9 の表で作る(紙のマンダラチャートと同じ並び)。
 * マスをタップすると、上の入力欄でそのマスを書ける。要素は、中央のブロックとまわりのブロックの真ん中のどちらで書いても同じ
 */
export default function ChartGridEditor({
    draft,
    setDraft,
}: {
    draft: ChartDraft;
    setDraft: (fn: (d: ChartDraft) => ChartDraft) => void;
}) {
    const [sel, setSel] = useState<Slot>({ kind: "title" });
    const inputRef = useRef<HTMLInputElement>(null);

    const valueOf = (s: Slot) =>
        s.kind === "title" ? draft.title : s.kind === "element" ? draft.elements[s.e] : draft.actions[s.e][s.a];
    const setValue = (s: Slot, v: string) => setDraft((d) => {
        if (s.kind === "title") return { ...d, title: v };
        if (s.kind === "element") return { ...d, elements: d.elements.map((x, i) => (i === s.e ? v : x)) };
        return { ...d, actions: d.actions.map((row, i) => (i === s.e ? row.map((x, j) => (j === s.a ? v : x)) : row)) };
    });

    const label = (s: Slot) => {
        if (s.kind === "title") return "大目標（まん中）";
        if (s.kind === "element") return `要素 ${s.e + 1}`;
        const name = draft.elements[s.e].trim();
        return `${name || `要素 ${s.e + 1}`} › 行動目標 ${s.a + 1}`;
    };
    const placeholder = (s: Slot) =>
        s.kind === "title" ? "例: 健康的な体をつくる" : s.kind === "element" ? "例: 睡眠" : "例: 23時に寝る";
    // 名前の無い要素の行動目標は書けない(保存されないため)
    const blocked = sel.kind === "action" && !draft.elements[sel.e].trim();

    const order = slotOrder(draft);
    const idx = order.findIndex((s) => sameSlot(s, sel));
    const move = (d: 1 | -1) => {
        if (idx < 0) return setSel(order[0]);
        setSel(order[(idx + d + order.length) % order.length]);
    };

    // マスを選んだら入力欄へ(開いた直後はキーボードを出さない)
    const first = useRef(true);
    useEffect(() => {
        if (first.current) { first.current = false; return; }
        if (!blocked) inputRef.current?.focus({ preventScroll: true });
    }, [sel, blocked]);

    const colorOf = (e: number) => ELEMENT_COLORS[e];

    return (
        <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gap: 8, background: theme.card, borderRadius: 14, padding: 12, border: `1px solid ${theme.border}` }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700 }}>
                    {sel.kind !== "title" && <span style={{ width: 10, height: 10, borderRadius: 5, background: colorOf(sel.e) }} />}
                    {label(sel)}
                </span>
                {blocked ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 12, lineHeight: 1.6, color: theme.subtext }}>
                        <span>先に、このブロックの真ん中に要素の名前を書いてください。</span>
                        <button type="button" onClick={() => sel.kind === "action" && setSel({ kind: "element", e: sel.e })}
                            style={{ minHeight: 36, flexShrink: 0, border: "none", background: "none", color: theme.habit, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                            要素を書く
                        </button>
                    </div>
                ) : (
                    <TextInput
                        ref={inputRef}
                        value={valueOf(sel)}
                        onChange={(e) => setValue(sel, e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); move(1); } }}
                        enterKeyHint="next"
                        placeholder={placeholder(sel)}
                        aria-label={label(sel)}
                        fullWidth
                    />
                )}
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <button type="button" onClick={() => move(-1)} style={stepBtn}><ChevronLeftIcon size={16} />前のマス</button>
                    <button type="button" onClick={() => move(1)} style={stepBtn}>次のマス<ChevronRightIcon size={16} /></button>
                </div>
            </div>

            <div role="grid" aria-label="マンダラチャート（9×9）" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 5 }}>
                {Array.from({ length: 9 }, (_, bp) => (
                    <div key={bp} role="row" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 2 }}>
                        {Array.from({ length: 9 }, (_, q) => {
                            const s = slotAt(bp, q);
                            const v = valueOf(s).trim();
                            const selected = sameSlot(s, sel);
                            let bg = "#FFFFFF";
                            let fg = "#334155";
                            let border = "#E2E8F0";
                            if (s.kind === "title") { bg = "#1E293B"; fg = "#F8FAFC"; border = "#1E293B"; }
                            else if (s.kind === "element") {
                                const c = colorOf(s.e);
                                bg = v ? c : `${c}1F`; fg = v ? "#FFFFFF" : c; border = c;
                            } else if (v) { border = `${colorOf(s.e)}80`; bg = `${colorOf(s.e)}12`; }
                            return (
                                <button key={q} type="button" role="gridcell" aria-label={`${label(s)}${v ? `：${v}` : "（空き）"}`} aria-selected={selected}
                                    onClick={() => setSel(s)}
                                    style={{
                                        height: 40, minWidth: 0, borderRadius: 4, padding: 2, boxSizing: "border-box",
                                        border: selected ? "2px solid #F59E0B" : `1px solid ${border}`,
                                        background: bg, color: fg, fontSize: 8, fontWeight: s.kind === "action" ? 500 : 700, lineHeight: 1.25,
                                        overflow: "hidden", cursor: "pointer", fontFamily: "inherit", wordBreak: "break-all",
                                        boxShadow: selected ? "0 0 0 2px rgba(245,158,11,0.25)" : "none",
                                    }}>
                                    {v || (s.kind === "title" ? "大目標" : s.kind === "element" ? `要素${s.e + 1}` : "")}
                                </button>
                            );
                        })}
                    </div>
                ))}
            </div>
            <p style={{ margin: 0, fontSize: 12, lineHeight: 1.7, color: theme.subtext }}>
                紙のマンダラチャートと同じ並びです。まん中が大目標、そのまわりの 8 マスが要素で、要素は外側のブロックの真ん中にも同じものが入ります。外側のブロックのまわりに、行動目標を書きます。
            </p>
        </div>
    );
}

const stepBtn: React.CSSProperties = {
    minHeight: 36, display: "inline-flex", alignItems: "center", gap: 2, border: `1px solid ${theme.border}`, borderRadius: 10,
    background: "transparent", color: "var(--text)", fontSize: 12, fontWeight: 700, padding: "0 10px", cursor: "pointer", fontFamily: "inherit",
};
