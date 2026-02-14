import React from "react";

type Props = {
  msg: string;
  wrapStyle: React.CSSProperties;
  toastStyle: React.CSSProperties;
};

export default function Toast({ msg, wrapStyle, toastStyle }: Props) {
  if (!msg) return null;

  return (
    <div style={wrapStyle} aria-live="polite" aria-atomic="true">
      <div style={toastStyle}>{msg}</div>
    </div>
  );
}
