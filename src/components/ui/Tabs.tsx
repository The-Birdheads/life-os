import React from "react";
import { theme } from "../../lib/ui/theme";
import { shadow } from "../../lib/ui/shadow";
import { radius } from "../../lib/ui/radius";

type Tab = "today" | "review" | "week" | "register";

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
  { key: "register", label: "登録", emoji: "➕" },
];

export default function Tabs({ tab, setTab }: Props) {
  const wrapStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    padding: 6,
    borderRadius: radius.lg,
    background: theme.card,
    border: `1px solid ${theme.border}`,
    boxShadow: shadow.sm,
  };

  const rowStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
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
    fontWeight: 800,
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
                background: theme.primarySoft,
                borderColor: theme.border,
                color: theme.primary,
              }
            : {
                background: "transparent",
                borderColor: "transparent",
                color: theme.subtext, // ✅ 非選択でも読める（PCで白文字事故を防ぐ）
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
