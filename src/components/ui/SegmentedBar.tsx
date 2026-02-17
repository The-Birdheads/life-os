import { theme } from "../../lib/ui/theme";
import { radius } from "../../lib/ui/radius";
import { shadow } from "../../lib/ui/shadow";

type Item<K extends string> = {
  key: K;
  label: string;
  badge?: number | string;
};

type Props<K extends string> = {
  items: Item<K>[];
  value: K;
  onChange: (key: K) => void;
  ariaLabel?: string;

  maxWidth?: number;   // 例: 720
  fullWidth?: boolean; // default true
};

export default function SegmentedBar<K extends string>({
  items,
  value,
  onChange,
  ariaLabel = "セグメント切り替え",
  maxWidth = 720,
  fullWidth = true,
}: Props<K>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      style={{
        width: fullWidth ? "100%" : "fit-content",
        maxWidth,
        margin: "0 auto",

        padding: 6,
        borderRadius: radius.lg,
        background: theme.card,                  // ✅ レールはカード色
        border: `1px solid ${theme.border}`,
        boxShadow: shadow.xs ?? "none",

        display: "flex",
        gap: 6,
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      {items.map((it) => {
        const active = it.key === value;

        return (
          <button
            key={it.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(it.key)}
            style={{
              flex: 1,
              minWidth: 0,

              height: 40,
              padding: "0 12px",
              borderRadius: radius.lg,

              border: `1px solid ${active ? theme.border : "transparent"}`,
              background: active ? "rgba(17,17,17,0.06)" : "transparent", // ✅ 選択中だけうっすら面
              color: theme.text,
              opacity: active ? 1 : 0.65,         // ✅ 未選択は薄め

              fontWeight: active ? 900 : 700,
              letterSpacing: "0.02em",

              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,

              cursor: "pointer",
              transition: "0.15s",
              userSelect: "none",
              WebkitTapHighlightColor: "transparent",
              outline: "none",

              // ✅ 選択中だけ “浮く” 感（やりすぎない）
              boxShadow: active ? (shadow.sm ?? "none") : "none",
            }}
            onMouseEnter={(e) => {
              if (active) return;
              e.currentTarget.style.background = "rgba(17,17,17,0.04)";
              e.currentTarget.style.opacity = "0.85";
            }}
            onMouseLeave={(e) => {
              if (active) return;
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.opacity = "0.65";
            }}
          >
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {it.label}
            </span>

            {it.badge != null && (
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 900,
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: active ? "rgba(17,17,17,0.10)" : "rgba(17,17,17,0.06)",
                  color: theme.text,
                  opacity: active ? 0.9 : 0.75,
                }}
              >
                {it.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
