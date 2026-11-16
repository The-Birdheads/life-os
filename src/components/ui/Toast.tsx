import React, { useEffect } from "react";
import { theme } from "../../lib/ui/theme";
import { AlertIcon, CheckIcon, CloseIcon, InfoIcon } from "./Icon";

type ToastType = "success" | "error" | "loading" | "info";

function detectType(msg: string): ToastType {
  if (/エラー|失敗|できません|できませんでした|error/i.test(msg)) return "error";
  if (/中\.\.\.|中…/.test(msg)) return "loading";
  if (/しました|ました。?$|完了|保存|成功/.test(msg)) return "success";
  return "info";
}

const typeConfig: Record<ToastType, { accent: string; soft: string; label: string }> = {
  success: { accent: theme.success, soft: "#D1FAE5", label: "完了" },
  error: { accent: theme.danger, soft: "#FEE2E2", label: "エラー" },
  loading: { accent: "#475569", soft: "#E2E8F0", label: "処理中" },
  info: { accent: "#2563EB", soft: "#DBEAFE", label: "お知らせ" },
};

/** 表示する時間。長い文ほど長く、エラーは読めるように長めに。処理中は結果に置き換わるまで(念のため上限あり) */
function durationOf(msg: string, type: ToastType): number {
  if (type === "loading") return 15000;
  const base = Math.min(7000, 2500 + msg.length * 60);
  return type === "error" ? Math.max(base, 6000) : base;
}

type Props = {
  msg: string;
  wrapStyle: React.CSSProperties;
  /** 閉じる(× と、時間がたったとき) */
  onDismiss: () => void;
};

/**
 * アプリ内の通知(画面上部、ヘッダーの下に出る)。
 * 白いカードに種類ごとの色の印を付け、右に必ず × を置く。下の細い線が、自動で消えるまでの残り時間
 */
export default function Toast({ msg, wrapStyle, onDismiss }: Props) {
  const type = msg ? detectType(msg) : "info";
  const duration = durationOf(msg, type);

  useEffect(() => {
    if (!msg) return;
    const t = window.setTimeout(onDismiss, duration);
    return () => window.clearTimeout(t);
  }, [msg]);

  if (!msg) return null;
  const { accent, soft, label } = typeConfig[type];
  const icon = type === "success" ? <CheckIcon size={16} />
    : type === "error" ? <AlertIcon size={16} />
    : type === "loading" ? <span className="toast-spinner" style={{ borderColor: `${accent}55`, borderTopColor: accent }} />
    : <InfoIcon size={16} />;

  return (
    <div style={wrapStyle} aria-live={type === "error" ? "assertive" : "polite"} aria-atomic="true">
      <div
        key={msg}
        className="toast-slide-down"
        role={type === "error" ? "alert" : "status"}
        style={{
          pointerEvents: "auto",
          position: "relative",
          overflow: "hidden",
          maxWidth: 560,
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 6px 10px 12px",
          borderRadius: 16,
          background: theme.card,
          border: `1px solid ${theme.border}`,
          boxShadow: "0 10px 30px rgba(15,23,42,0.18), 0 2px 6px rgba(15,23,42,0.08)",
          color: theme.text,
        }}
      >
        <span aria-label={label} role="img"
          style={{ width: 32, height: 32, borderRadius: 16, flexShrink: 0, background: soft, color: accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {icon}
        </span>
        <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, lineHeight: 1.5, wordBreak: "break-word" }}>{msg}</span>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="通知を閉じる"
          style={{
            width: 44, height: 44, flexShrink: 0, border: "none", background: "none", padding: 0, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", color: theme.subtext, borderRadius: 12,
          }}
        >
          <CloseIcon size={18} />
        </button>
        {/* 自動で消えるまでの残り時間 */}
        <span aria-hidden
          style={{
            position: "absolute", left: 0, bottom: 0, height: 3, width: "100%", background: accent, opacity: 0.6,
            transformOrigin: "left", animation: `toast-countdown ${duration}ms linear forwards`,
          }} />
      </div>
    </div>
  );
}
