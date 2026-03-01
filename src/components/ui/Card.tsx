import React from "react";
import { space } from "../../lib/ui/spacing";

type Props = {
  children: React.ReactNode;
  style?: React.CSSProperties;
};

export default function Card({ children, style }: Props) {
  return (
    <div
      style={{
        display: "block",
        width: "100%",
        boxSizing: "border-box",
        minWidth: 0,

        padding: space.lg, // ⭐ デフォルト余白（最重要）

        boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -2px rgba(0,0,0,0.05)",
        borderRadius: 16,

        background: "var(--card)",
        border: "1px solid rgba(0,0,0,0.06)",

        ...style, // ← 外部指定で上書き可能
      }}
    >
      {children}
    </div>
  );
}
