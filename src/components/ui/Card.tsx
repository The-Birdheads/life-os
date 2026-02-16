import React from "react";

type Props = {
  children: React.ReactNode;
  style?: React.CSSProperties;
};

export default function Card({ children, style }: Props) {
  return <div style={{
        display: "block",
        width: "100%",
        boxSizing: "border-box",
        minWidth: 0,
        ...style,
      }}>{children}</div>;
}
