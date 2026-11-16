export type GoalChipInfo = { label: string; color: string; element: number };

/** カードの下に出す、ひもづけた要素のチップ。タップで目標タブのその要素を開く(記録タブ・振り返りタブで共通) */
export default function GoalChip({ chip, onOpen }: { chip: GoalChipInfo | undefined; onOpen?: (element: number) => void }) {
    if (!chip) return null;
    return (
        <button
            type="button"
            aria-label={`目標「${chip.label}」のチャートを開く`}
            onClick={(e) => { e.stopPropagation(); onOpen?.(chip.element); }}
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
}
