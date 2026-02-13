type Props = {
  value?: number | null; // 1-10
  max?: number;          // default 10
  showNumber?: boolean;  // default true
};

export default function VolBar({ value, max = 10, showNumber = true }: Props) {
  const vRaw = Number(value);
  const v = Number.isFinite(vRaw) ? Math.min(max, Math.max(0, vRaw)) : 0;
  const pct = max === 0 ? 0 : (v / max) * 100;

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span
        aria-label={`volume ${v}/${max}`}
        style={{
          width: 64,
          height: 10,
          borderRadius: 999,
          background: "#e5e7eb",
          overflow: "hidden",
          display: "inline-block",
          verticalAlign: "middle",
        }}
      >
        <span
          style={{
            display: "block",
            height: "100%",
            width: `${pct}%`,
            background: "#60a5fa",
          }}
        />
      </span>
      {showNumber ? (
        <small style={{ opacity: 0.75, fontVariantNumeric: "tabular-nums" }}>{v}</small>
      ) : null}
    </span>
  );
}
