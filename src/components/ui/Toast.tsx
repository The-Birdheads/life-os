import React from "react";
import { theme } from "../../lib/ui/theme";

type ToastType = "success" | "error" | "loading" | "info";

function detectType(msg: string): ToastType {
  if (/エラー|失敗|error/i.test(msg)) return "error";
  if (/完了|保存|成功/.test(msg)) return "success";
  if (/中\.\.\./.test(msg)) return "loading";
  return "info";
}

const typeConfig: Record<ToastType, { accent: string; icon: string }> = {
  success: { accent: theme.success, icon: "✓" },
  error:   { accent: theme.danger,  icon: "✕" },
  loading: { accent: "#94a3b8",     icon: "⟳" },
  info:    { accent: "#94a3b8",     icon: "●" },
};

type Props = {
  msg: string;
  wrapStyle: React.CSSProperties;
  onDismiss?: () => void;
};

export default function Toast({ msg, wrapStyle, onDismiss }: Props) {
  if (!msg) return null;
  const type = detectType(msg);
  const { accent, icon } = typeConfig[type];

  return (
    <div style={wrapStyle} aria-live="polite" aria-atomic="true">
      <div
        className="toast-slide-down"
        style={{
          pointerEvents: "auto",
          maxWidth: 720,
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "11px 14px",
          borderRadius: 14,
          background: theme.surfaceDark,
          backdropFilter: "blur(16px) saturate(180%)",
          WebkitBackdropFilter: "blur(16px) saturate(180%)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
          borderLeft: `3px solid ${accent}`,
          color: theme.surfaceDarkText,
          fontSize: 14,
          fontWeight: 500,
        }}
      >
        <span
          style={{
            color: accent,
            fontSize: 15,
            flexShrink: 0,
            fontWeight: 700,
            width: 18,
            textAlign: "center",
          }}
        >
          {icon}
        </span>
        <span style={{ flex: 1, lineHeight: 1.45 }}>{msg}</span>
        {onDismiss && (
          <button
            onClick={onDismiss}
            aria-label="閉じる"
            style={{
              border: "none",
              background: "rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.55)",
              width: 26,
              height: 26,
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flexShrink: 0,
              fontSize: 16,
              lineHeight: 1,
              padding: 0,
              transition: "background 0.15s ease, color 0.15s ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.16)";
              (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.9)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.08)";
              (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.55)";
            }}
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
