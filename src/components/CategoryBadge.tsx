type Props = {
  category?: string | null;
};

export default function CategoryBadge({ category }: Props) {
  const c = category ?? "other";

  const labelMap: Record<string, string> = {
    hobby: "趣味",
    recovery: "回復",
    growth: "成長",
    lifework: "生活",
    other: "その他",
  };

  const styleMap: Record<string, React.CSSProperties> = {
    hobby: { background: "#FFE4E6", color: "#9F1239" },
    recovery: { background: "#DBEAFE", color: "#1D4ED8" },
    growth: { background: "#DCFCE7", color: "#166534" },
    lifework: { background: "#FEF3C7", color: "#92400E" },
    other: { background: "#E5E7EB", color: "#374151" },
  };

  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        ...(styleMap[c] ?? styleMap.other),
      }}
    >
      {labelMap[c] ?? labelMap.other}
    </span>
  );
}
