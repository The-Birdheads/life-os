import { theme } from "../../lib/ui/theme";
import { radius } from "../../lib/ui/radius";

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

  maxWidth?: number;     // 例: 720
  stickyTop?: number;    // 指定すれば sticky になり上からの距離を設定
};

export default function SegmentedBar<K extends string>({
  items,
  value,
  onChange,
  ariaLabel = "セグメント切り替え",
  maxWidth = 720,
  stickyTop,
}: Props<K>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      style={{
        padding: "8px 12px",

        // コンテナのpadding:12pxを打ち消して画面いっぱいにする
        margin: "0 -12px",
        background: "#64748b", // Slate 500 (12:00更新)
        color: theme.surfaceDarkText,

        // sticky対応
        ...(stickyTop !== undefined ? {
          position: "sticky",
          top: stickyTop,
          marginTop: -16, // AppShell側の paddingTop16px によるヘッダーとの隙間を埋める
          zIndex: 60,
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)", // ヘッダーと同じ階層感の影
        } : {}),

        display: "flex",
        justifyContent: "center",
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", gap: 6, width: "100%", maxWidth }}>
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
                height: 36,
                padding: "0 12px",
                borderRadius: radius.md,
                border: "none",

                // 追加要望10: アクティブ時は白背景・黒文字（反転）
                background: active ? "#ffffff" : "transparent",
                color: active ? "#111111" : theme.surfaceDarkText,
                opacity: active ? 1 : 0.7,

                fontWeight: active ? 800 : 600,
                fontSize: 14,
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
                boxShadow: active ? "0 2px 4px rgba(0,0,0,0.1)" : "none",
              }}
              onMouseEnter={(e) => {
                if (active) return;
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
                e.currentTarget.style.opacity = "0.9";
              }}
              onMouseLeave={(e) => {
                if (active) return;
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.opacity = "0.7";
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
                    background: active ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.15)",
                    color: active ? "#111111" : theme.surfaceDarkText,
                    opacity: 1,
                  }}
                >
                  {it.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
