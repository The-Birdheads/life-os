import { theme } from "./theme";

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
  top: "calc(env(safe-area-inset-top, 0px) + 64px)", // ヘッダー(56px)の少し下
  insetInline: 0,
  display: "flex",
  justifyContent: "center",
  pointerEvents: "none",
  zIndex: 9999,
  paddingInline: 12,
  boxSizing: "border-box",
};
