import React from "react";
import { theme } from "../../lib/ui/theme";
import { radius } from "../../lib/ui/radius";

type Tab = "today" | "review" | "week";

type Props = {
  tab: Tab;
  setTab: (t: Tab) => void;
};

type TabItem = {
  key: Tab;
  label: string;
  emoji: string;
};
const items: TabItem[] = [
  { key: "today", label: "記録", emoji: "📝" },
  { key: "review", label: "振り返り", emoji: "🔎" },
  { key: "week", label: "週", emoji: "📅" },
];

export default function Tabs({ tab, setTab }: Props) {
  const wrapStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    padding: "6px",
    borderRadius: "16px",
    background: "rgba(255, 255, 255, 0.1)", /* ダーク背景用透け感 */
    backdropFilter: "blur(4px)",
    border: `1px solid rgba(255,255,255,0.1)`,
    boxShadow: "inset 0 1px 1px rgba(255,255,255,0.05)",
  };

  const rowStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 6,
  };

  const baseBtnStyle: React.CSSProperties = {
    appearance: "none",
    border: "1px solid transparent",
    background: "transparent",
    borderRadius: radius.md,
    padding: "10px 6px",
    cursor: "pointer",
    userSelect: "none",
    textAlign: "center",
    width: "100%",
    minWidth: 0,
    transition: "background-color .15s, border-color .15s, transform .05s, color .15s",
    whiteSpace: "nowrap", // ✅ 折り返し禁止
    overflow: "hidden",
    textOverflow: "ellipsis",
  };

  const iconStyle: React.CSSProperties = {
    fontSize: 16,
    lineHeight: "16px",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: "bold",
    lineHeight: 1.1,
    marginTop: 4,
  };

  return (
    <nav aria-label="Tabs" style={wrapStyle}>
      <div style={rowStyle}>
        {items.map((it) => {
          const active = it.key === tab;

          const activeStyle: React.CSSProperties = active
            ? {
              background: theme.surfaceDarkText, /* アクティブ時は白く光らせる */
              borderColor: "transparent",
              color: theme.primary, /* 文字色はメインのダークスレート */
              boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            }
            : {
              background: "transparent",
              borderColor: "transparent",
              color: "rgba(248, 250, 252, 0.7)", /* 非アクティブ時は薄い白抜き (surfaceDarkTextベース) */
            };

          return (
            <button
              key={it.key}
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => setTab(it.key)}
              style={{
                ...baseBtnStyle,
                ...activeStyle,
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.transform = "scale(0.98)";
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = "scale(1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              <div style={{ display: "grid", justifyItems: "center", minWidth: 0 }}>
                <span style={iconStyle} aria-hidden="true">
                  {it.emoji}
                </span>
                <span style={labelStyle}>{it.label}</span>
              </div>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
