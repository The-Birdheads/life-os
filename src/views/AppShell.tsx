import { useEffect, useRef, useState } from "react";
import { APP_VERSION, RELEASE_NOTES } from "../lib/releaseNotes";

import Toast from "../components/ui/Toast";
import Tabs from "../components/ui/Tabs";
import PrimaryBtn from "../components/ui/PrimaryBtn";
import { theme } from "../lib/ui/theme";
import { shadow } from "../lib/ui/shadow";


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

  headerDateLabel?: string;
  onPrevDay?: () => void;
  onNextDay?: () => void;
  canGoNext?: boolean;
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
  headerDateLabel,
  onPrevDay,
  onNextDay,
  canGoNext,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const [releaseOpen, setReleaseOpen] = useState(false);

  const bottomNavHeight = 64;
  const topBarHeight = 56;

  const railStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: 720,
    margin: "0 auto",
    paddingLeft: 12,
    paddingRight: 12,
    boxSizing: "border-box",
    minWidth: 0,
    fontFamily: "sans-serif",
  };

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

  useEffect(() => {
    if (!releaseOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setReleaseOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [releaseOpen]);

  const iconBtnStyle: React.CSSProperties = {
    appearance: "none",
    border: `1px solid ${theme.border}`,
    background: theme.card,
    color: theme.text,
    borderRadius: 12,
    width: 38,
    height: 38,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    flexShrink: 0,
  };

  return (
    <div style={layoutStyle}>
      <div style={{ ...containerStyle, overflowX: "hidden" }}>
        {/* HEADER */}
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 70,
            background: theme.bg,
            borderBottom: `1px solid ${theme.border}`,
            boxShadow: shadow.sm,
            paddingTop: "env(safe-area-inset-top, 0px)",
          }}
        >
          <div style={{
            ...railStyle, height: topBarHeight, display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            alignItems: "center",
          }}>
            {/* LEFT */}
            <div style={{ justifySelf: "start", fontWeight: 900, fontSize: 18 }}>
              Life OS
            </div>

            {/* CENTER */}
            <div style={{ justifySelf: "center" }}>
              {tab === "register" ? (
                <div style={{ fontWeight: 800 }}>登録</div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button style={iconBtnStyle} onClick={onPrevDay}>◀</button>

                  <div
                    style={{
                      position: "relative",
                      height: 38,
                      minWidth: 150,
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "0 12px",
                        borderRadius: 12,
                        border: `1px solid ${theme.border}`,
                        background: theme.card,
                        fontWeight: 900,
                        whiteSpace: "nowrap",
                        pointerEvents: "none",
                      }}
                    >
                      {headerDateLabel}
                    </div>

                    <input
                      type="date"
                      value={headerDateLabel?.replaceAll(" / ", "-")}
                      max={new Date().toISOString().slice(0, 10)}
                      onChange={(e) => {
                        const val = e.target.value
                        if (val) {
                          window.dispatchEvent(
                            new CustomEvent("lifeos:setDay", { detail: val })
                          )
                        }
                      }}
                      onPointerDown={(e) => {
                        const el = e.currentTarget as any
                        if (el.showPicker) el.showPicker()
                      }}
                      style={{
                        position: "absolute",
                        inset: 0,
                        opacity: 0,
                        cursor: "pointer",
                      }}
                    />

                  </div>


                  <button
                    style={{
                      ...iconBtnStyle,
                      opacity: canGoNext ? 1 : 0.4,
                      cursor: canGoNext ? "pointer" : "default",
                    }}
                    onClick={() => {
                      if (canGoNext && onNextDay) onNextDay();
                    }}
                  >
                    ▶
                  </button>

                </div>
              )}
            </div>

            {/* RIGHT */}
            <div ref={menuRef} style={{ justifySelf: "end", position: "relative" }}>
              <button onClick={() => setMenuOpen(v => !v)} style={{ ...iconBtnStyle, width: 40, height: 40 }}>
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path
                    d="M4 7h16M4 12h16M4 17h16"
                    stroke={theme.text}
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
                    border: `1px solid ${theme.border}`,
                    background: theme.card,
                    color: theme.text,
                    boxShadow: shadow.md,
                    padding: 10,
                    zIndex: 80,
                  }}
                >
                  <PrimaryBtn fullWidth onClick={() => {
                    setMenuOpen(false);
                    setReleaseOpen(true);
                  }}>
                    リリースノート
                  </PrimaryBtn>

                  <div style={{ height: 8 }} />

                  <PrimaryBtn fullWidth onClick={onSignOut}>
                    ログアウト
                  </PrimaryBtn>

                  <div style={{ fontSize: 12, opacity: .7, marginTop: 10 }}>
                    バージョン
                  </div>
                  <div style={{ fontWeight: 700 }}>v{APP_VERSION}</div>

                  <div style={{ fontSize: 12, opacity: .7, marginTop: 10 }}>
                    ログイン中のユーザ
                  </div>
                  <div style={{ fontWeight: 600 }}>{userEmail ?? "不明"}</div>
                </div>
              )}
            </div>
          </div>
        </div>

        <Toast msg={msg} wrapStyle={toastWrapStyle} toastStyle={toastStyle} />

        {/* MAIN */}
        <div
          style={{
            ...railStyle,
            paddingTop: `calc(${topBarHeight}px + 12px)`,
            paddingBottom: `calc(${bottomNavHeight}px + 12px)`,
          }}
        >
          {children}
        </div>

        {/* BOTTOM NAV */}
        <div
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 60,
            background: theme.bg,
            borderTop: `1px solid ${theme.border}`,
            boxShadow: shadow.sm,
          }}
        >
          <div style={{ ...railStyle, padding: 8 }}>
            <Tabs tab={tab} setTab={setTab} />
          </div>
        </div>
      </div>

      {/* RELEASE MODAL */}
      {
        releaseOpen && (
          <div
            onClick={() => setReleaseOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.45)",
              boxShadow: shadow.lg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 100,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "min(92vw, 720px)",
                maxHeight: "80vh",
                overflow: "auto",
                borderRadius: 14,
                background: theme.card,
                border: `1px solid ${theme.border}`,
                padding: 14,
              }}
            >
              <b>リリースノート</b>

              {RELEASE_NOTES.map(r => (
                <div key={r.version} style={{ marginTop: 12 }}>
                  <b>v{r.version}</b> ({r.date})
                  <ul>
                    {r.items.map((t, i) => <li key={i}>{t}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )
      }
    </div >
  );
}
