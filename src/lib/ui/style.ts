export const theme = {
  bg: "var(--bg)",
  text: "var(--text)",
  card: "var(--card)",
  border: "var(--border)",
  toastBg: "var(--toast-bg)",
  toastText: "var(--toast-text)",
};

export const cardStyle: React.CSSProperties = {
  background: theme.card,
  border: `1px solid ${theme.border}`,
  borderRadius: 12,
  padding: 14,
};

export const layoutStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  width: "100%",
  background: theme.bg,
  color: theme.text,
  minHeight: "100vh",
};

export const containerStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 720,
  margin: "0 auto",
  padding: "0 12px",
  boxSizing: "border-box",
};

export const toastWrapStyle: React.CSSProperties = {
  position: "fixed",
  top: 12,
  left: 0,
  right: 0,
  display: "flex",
  justifyContent: "center",
  pointerEvents: "none",
  zIndex: 9999,
  padding: "0 12px",
  boxSizing: "border-box",
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
