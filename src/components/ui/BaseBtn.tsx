import React from "react";
import { theme } from "../../lib/ui/theme";

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
  const themeColors = {
    primary: {
      background: `linear-gradient(135deg, ${theme.primary}, ${theme.primaryHover})`,
      color: "#fff",
      border: "none",
      boxShadow: "0 4px 14px 0 rgba(99, 102, 241, 0.39)",
      hoverShadow: "0 6px 20px rgba(99, 102, 241, 0.45)",
    },
    secondary: {
      background: "#fff",
      color: theme.text,
      border: `1px solid ${theme.border}`,
      boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
      hoverShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
    },
    danger: {
      background: `linear-gradient(135deg, ${theme.danger}, #b91c1c)`,
      color: "white",
      border: "none",
      boxShadow: "0 4px 14px 0 rgba(239, 68, 68, 0.39)",
      hoverShadow: "0 6px 20px rgba(239, 68, 68, 0.45)",
    },
  }[variant];

  return (
    <button
      {...props}
      style={{
        width: fullWidth ? "100%" : undefined,
        padding: "10px 18px",
        borderRadius: "12px", // より丸みを持たせる
        fontWeight: 600, // 700だと少し重いため軽めに
        fontSize: "15px",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "6px",
        cursor: props.disabled ? "not-allowed" : "pointer",
        opacity: props.disabled ? 0.6 : 1,
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        ...themeColors,
        // 上書き用
        ...style,
      }}
      onMouseEnter={(e) => {
        if (!props.disabled) {
          e.currentTarget.style.boxShadow = themeColors.hoverShadow;
          e.currentTarget.style.transform = "translateY(-1px)";
        }
      }}
      onMouseLeave={(e) => {
        if (!props.disabled) {
          e.currentTarget.style.boxShadow = themeColors.boxShadow;
          e.currentTarget.style.transform = "translateY(0)";
        }
      }}
      onMouseDown={(e) => {
        if (!props.disabled) {
          e.currentTarget.style.transform = "scale(0.96)";
          e.currentTarget.style.boxShadow = themeColors.boxShadow;
        }
      }}
      onMouseUp={(e) => {
        if (!props.disabled) {
          e.currentTarget.style.transform = "scale(1)";
        }
      }}
    />
  );
}
