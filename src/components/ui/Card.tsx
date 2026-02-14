import React from "react";

type Props = {
  children: React.ReactNode;
  style?: React.CSSProperties;
};

export default function Card({ children, style }: Props) {
  return <div style={style}>{children}</div>;
}
