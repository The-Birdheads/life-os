import React from "react";
import { theme } from "../../lib/ui/theme";

type Props = {
  title: string;
  right?: React.ReactNode;
  style?: React.CSSProperties;
};

export default function SectionTitle({ title, right, style }: Props) {
  const wrap: React.CSSProperties = {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,

    background: theme.card,
    color: theme.text,

    borderTop: `1px solid ${theme.border}`,
    borderBottom: `1px solid ${theme.border}`,

    // 左アクセントライン（スタイリッシュ帯感）
    boxShadow: `inset 3px 0 0 ${theme.primary}`,

    padding: "10px 0",
  };

  const left: React.CSSProperties = {
    display: "flex",
    alignItems: "baseline",
    gap: 10,
    minWidth: 0,
    paddingLeft: 12,
  };

  const titleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: 0.6,
    whiteSpace: "nowrap",
  };

  const rightWrap: React.CSSProperties = {
    paddingRight: 12,
    display: "flex",
    alignItems: "center",
    gap: 6,
  };

  return (
    <div style={{ ...wrap, ...style }}>
      <div style={left}>
        <h3 style={titleStyle}>{title}</h3>
      </div>

      {right ? <div style={rightWrap}>{right}</div> : null}
    </div>
  );
}
