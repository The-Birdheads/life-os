export const theme = {
  bg: "var(--bg)",
  text: "var(--text)",
  card: "var(--card)",
  border: "var(--border)",
  toastBg: "var(--toast-bg)",
  toastText: "var(--toast-text)",

  // ▼追加
  menuBg: "var(--card)",
  menuBorder: "var(--border)",
  menuText: "var(--text)",
};

export const cardStyle: React.CSSProperties = {
  background: theme.card,
  border: `1px solid ${theme.border}`,
  borderRadius: 12,
  padding: 14,
};

export const layoutStyle: React.CSSProperties = {
  background: theme.bg,
  color: theme.text,
  minHeight: "100vh",
  display: "flex",
  justifyContent: "center",
};


export const containerStyle: React.CSSProperties = {
  width: "min(100%, 720px)",
  margin: "0 auto",
  padding: "0 12px",
  boxSizing: "border-box",
};

export const toastWrapStyle: React.CSSProperties = {
  position: "fixed",
  top: 12,
  insetInline: 0,       // left/right の代わり（安定）
  display: "flex",
  justifyContent: "center",
  pointerEvents: "none",
  zIndex: 9999,
  paddingInline: 12,    // padding の代わり（安定）
  boxSizing: "border-box",

  // ✅ 追加：トースト起因の横はみ出しを確実に封じる
  overflow: "hidden",
};


export const toastStyle: React.CSSProperties = {
  pointerEvents: "auto",
  maxWidth: 720,
  width: "100%",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  background: theme.toastBg,
  color: theme.toastText,
  boxShadow: "0 6px 18px rgba(0,0,0,0.12)",
  backdropFilter: "blur(6px)",
  WebkitBackdropFilter: "blur(6px)",
  fontSize: 14,
};
