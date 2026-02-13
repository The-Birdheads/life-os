type Props = {
  value?: number | null; // 1-5
  showLabel?: boolean;   // default true -> "優先度: "
};

export default function PriorityBadge({ value, showLabel = true }: Props) {
  const vRaw = Number(value);
  const v = Number.isFinite(vRaw) ? Math.min(5, Math.max(1, Math.trunc(vRaw))) : 1;

  // パワプロっぽい A(赤)〜E(青)
  // 5->A, 4->B, 3->C, 2->D, 1->E
  const palette: Record<number, { bg: string; fg: string; border: string }> = {
    5: { bg: "#FEE2E2", fg: "#B91C1C", border: "#FCA5A5" }, // A 赤
    4: { bg: "#FFEDD5", fg: "#C2410C", border: "#FDBA74" }, // B 橙
    3: { bg: "#FEF3C7", fg: "#B45309", border: "#FCD34D" }, // C 黄
    2: { bg: "#DCFCE7", fg: "#166534", border: "#86EFAC" }, // D 緑
    1: { bg: "#DBEAFE", fg: "#1D4ED8", border: "#93C5FD" }, // E 青
  };

  const p = palette[v];

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      {showLabel ? <span style={{ opacity: 0.7 }}>優先度:</span> : null}
      <span
        aria-label={`priority ${v}`}
        style={{
          display: "inline-block",
          padding: "1px 4px",
          borderRadius: 6, // 角丸四角
          border: `1px solid ${p.border}`,
          background: p.bg,
          color: p.fg,
          fontSize: 12, // small相当
          fontWeight: 700,
          lineHeight: "16px",
          fontVariantNumeric: "tabular-nums",
          minWidth: 22,
          textAlign: "center",
        }}
      >
        {v}
      </span>
    </span>
  );
}
