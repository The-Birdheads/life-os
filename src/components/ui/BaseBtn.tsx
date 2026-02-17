import React from "react";
import { radius } from "../../lib/ui/radius";
import { shadow } from "../../lib/ui/shadow";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
  fullWidth?: boolean;
};

export default function BaseBtn({
  variant = "secondary",
  fullWidth,
  style,
  ...props
}: Props) {
  const theme = {
    primary: {
      background: "var(--text)",
      color: "var(--bg)",
      border: "1px solid var(--border)",
    },
    secondary: {
      background: "var(--card)",
      color: "var(--text)",
      border: "1px solid var(--border)",
    },
    danger: {
      background: "#ef4444",
      color: "white",
      border: "1px solid #dc2626",
    },
  }[variant];

  const baseShadow = shadow.sm;
  const hoverShadow = shadow.md;
  const activeShadow = shadow.inset;

  return (
    <button
      {...props}
      style={{
        width: fullWidth ? "100%" : undefined,
        padding: "10px 14px",

        borderRadius: radius.md, // ⭐統一角丸
        fontWeight: 700,

        cursor: props.disabled ? "not-allowed" : "pointer",
        opacity: props.disabled ? 0.55 : 1,

        transition:
          "box-shadow .15s, transform .05s, background .15s, border .15s",

        boxShadow: baseShadow,

        ...theme,
        ...style,
      }}
      onMouseEnter={(e) => {
        if (!props.disabled) e.currentTarget.style.boxShadow = hoverShadow;
      }}
      onMouseLeave={(e) => {
        if (!props.disabled) e.currentTarget.style.boxShadow = baseShadow;
      }}
      onMouseDown={(e) => {
        if (!props.disabled) {
          e.currentTarget.style.boxShadow = activeShadow;
          e.currentTarget.style.transform = "scale(0.98)";
        }
      }}
      onMouseUp={(e) => {
        if (!props.disabled) {
          e.currentTarget.style.boxShadow = hoverShadow;
          e.currentTarget.style.transform = "scale(1)";
        }
      }}
    />
  );
}
