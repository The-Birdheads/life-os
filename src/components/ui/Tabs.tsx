import React from "react";

type Tab = "today" | "register" | "review" | "week";

type Props = {
  tab: Tab;
  setTab: (t: Tab) => void;
};

const tabList: { key: Tab; label: string }[] = [
  { key: "today", label: "記録" },
  { key: "register", label: "登録" },
  { key: "review", label: "振り返り" },
  { key: "week", label: "週" },
];

export default function Tabs({ tab, setTab }: Props) {
  return (
    <div
      style={{
        display: "grid",

        // ⭐ 重要：均等幅グリッド（絶対はみ出さない）
        gridTemplateColumns: "repeat(4, minmax(0,1fr))",

        gap: 8,
        marginBottom: 16,

        // ⭐ 念のため横はみ出し防止
        overflowX: "hidden",
      }}
    >
      {tabList.map((t) => {
        const active = tab === t.key;

        return (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            disabled={active}
            style={{
              width: "100%",              // ← 重要（幅固定）
              minWidth: 0,                // ← 重要（縮小許可）
              padding: "10px 6px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: active ? "var(--card)" : "transparent",
              color: active ? "var(--text)" : "#6b7280",
              fontWeight: 700,
              cursor: active ? "default" : "pointer",
              whiteSpace: "nowrap",       // 折り返し防止
              overflow: "hidden",
              textOverflow: "ellipsis",   // 長文対応
              transition: "0.15s",
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
