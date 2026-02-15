import React from "react";

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

  return (
    <button
      {...props}
      style={{
        width: fullWidth ? "100%" : undefined,
        padding: "10px 14px",
        borderRadius: 12,
        fontWeight: 700,
        cursor: props.disabled ? "not-allowed" : "pointer",
        opacity: props.disabled ? 0.55 : 1,
        transition: "0.15s",
        boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
        ...theme,
        ...style,
      }}
    />
  );
}