import React from "react";
import { shadow } from "../../lib/ui/shadow";
import { radius } from "../../lib/ui/radius";
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

        boxShadow: shadow.sm,
        borderRadius: radius.md,

        background: "var(--card)",
        border: "1px solid var(--border)",

        ...style, // ← 外部指定で上書き可能
      }}
    >
      {children}
    </div>
  );
}
