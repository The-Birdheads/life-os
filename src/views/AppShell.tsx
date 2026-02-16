import { useEffect, useRef, useState } from "react";
import { APP_VERSION, RELEASE_NOTES } from "../lib/releaseNotes";

import Toast from "../components/ui/Toast";
import Tabs from "../components/ui/Tabs";

import PrimaryBtn from "../components/ui/PrimaryBtn";
import { theme } from "../lib/ui/style";

type Tab = "today" | "review" | "week" | "register";

type Props = {
  userEmail: string | null;
  onSignOut: () => void;

  msg: string;

  tab: Tab;
  setTab: (t: Tab) => void;

  layoutStyle: React.CSSProperties;
  containerStyle: React.CSSProperties;
  toastWrapStyle: React.CSSProperties;
  toastStyle: React.CSSProperties;

  children: React.ReactNode;
};

export default function AppShell({
  userEmail,
  onSignOut,
  msg,
  tab,
  setTab,
  layoutStyle,
  containerStyle,
  toastWrapStyle,
  toastStyle,
  children,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const [releaseOpen, setReleaseOpen] = useState(false);
  const releaseRef = useRef<HTMLDivElement | null>(null);

  // ✅ レーン幅をここ1箇所に統一（PC=720固定 / モバイル=100%）
  const contentRailStyle: React.CSSProperties = {
    width: 720,
    maxWidth: "100%",
    margin: "40px auto",
    paddingLeft: 12,
    paddingRight: 12,
    boxSizing: "border-box",
    fontFamily: "sans-serif",
  };

  // メニュー：クリック外で閉じる
  useEffect(() => {
    if (!menuOpen) return;

    const onDown = (e: MouseEvent) => {
      const el = menuRef.current;
      if (!el) return;
      if (!el.contains(e.target as Node)) setMenuOpen(false);
    };

    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  // リリースノート：Escで閉じる
  useEffect(() => {
    if (!releaseOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setReleaseOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [releaseOpen]);

  return (
    <div style={layoutStyle}>
      <div style={{ ...containerStyle, overflowX: "hidden" }}>
        {/* ✅ ここから全部同じ固定レーン */}
        <div style={contentRailStyle}>
          {/* Header */}
          <header
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "4px 0",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <h1
                style={{
                  margin: 0,
                  fontSize: 22,
                  lineHeight: 1.2,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                Life OS
              </h1>
            </div>

            <div ref={menuRef} style={{ position: "relative", flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="メニュー"
                aria-expanded={menuOpen}
                style={{
                  appearance: "none",
                  border: `1px solid ${theme.border}`,
                  background: theme.menuBg,
                  borderRadius: 10,
                  padding: "8px 10px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M4 7h16M4 12h16M4 17h16"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>

              {menuOpen && (
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "calc(100% + 8px)",
                    width: "min(86vw, 340px)",
                    borderRadius: 12,
                    border: `1px solid ${theme.menuBorder}`,
                    background: theme.menuBg,
                    color: theme.menuText,
                    boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
                    padding: 10,
                    zIndex: 50,
                  }}
                >
                  <PrimaryBtn
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setReleaseOpen(true);
                    }}
                    fullWidth
                  >
                    リリースノート
                  </PrimaryBtn>

                  <div style={{ height: 8 }} />

                  <PrimaryBtn
                    type="button"
                    onClick={async () => {
                      setMenuOpen(false);
                      await onSignOut();
                    }}
                    fullWidth
                  >
                    ログアウト
                  </PrimaryBtn>

                  <div style={{ fontSize: 12, opacity: 0.75, marginTop: 10, marginBottom: 6 }}>
                    バージョン
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      marginBottom: 10,
                    }}
                  >
                    v{APP_VERSION}
                  </div>

                  <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>ログイン中のユーザ</div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      marginBottom: 5,
                    }}
                    title={userEmail ?? ""}
                  >
                    {userEmail ?? "（不明）"}
                  </div>
                </div>
              )}
            </div>
          </header>

          <hr />

          {/* Toastはfixedだけど、表示上はこのレーン前提でOK */}
          <Toast msg={msg} wrapStyle={toastWrapStyle} toastStyle={toastStyle} />

          <Tabs tab={tab} setTab={setTab} />
          {children}
        </div>
      </div>

      {/* Release Notes Modal */}
      {releaseOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="リリースノート"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            color: theme.text,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 100,
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setReleaseOpen(false);
          }}
        >
          <div
            ref={releaseRef}
            style={{
              width: "min(92vw, 720px)",
              maxHeight: "80vh",
              overflow: "auto",
              borderRadius: 14,
              background: theme.card,
              border: `1px solid ${theme.border}`,
              color: theme.text,
              boxShadow: "0 14px 50px rgba(0,0,0,0.30)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "14px 14px 10px 14px",
                borderBottom: "1px solid rgba(0,0,0,0.08)",
                position: "sticky",
                top: 0,
                background: theme.card,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.2 }}>リリースノート</div>
                <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>
                  現在のバージョン：v{APP_VERSION}
                </div>
              </div>

              <button
                type="button"
                aria-label="閉じる"
                onClick={() => setReleaseOpen(false)}
                style={{
                  appearance: "none",
                  border: `1px solid ${theme.border}`,
                  background: theme.card,
                  borderRadius: 10,
                  padding: "6px 10px",
                  fontWeight: 800,
                }}
              >
                ×
              </button>
            </div>

            <div style={{ padding: 14 }}>
              {RELEASE_NOTES.map((rn) => (
                <div
                  key={`${rn.date}-${rn.version}`}
                  style={{
                    border: `1px solid ${theme.border}`,
                    borderRadius: 12,
                    padding: 12,
                    marginBottom: 10,
                  }}
                >
                  <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 900 }}>v{rn.version}</div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>{rn.date}</div>
                  </div>
                  <ul style={{ margin: "10px 0 0 18px" }}>
                    {rn.items.map((it, i) => (
                      <li key={i} style={{ marginBottom: 6, lineHeight: 1.5 }}>
                        {it}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

              <div style={{ fontSize: 12, opacity: 0.6 }}>
                ヒント：Escキー（PC）/ 背景タップ（スマホ）でも閉じられます
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
