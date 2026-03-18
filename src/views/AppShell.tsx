import { useEffect, useRef, useState } from "react";
import { APP_VERSION, RELEASE_NOTES } from "../lib/releaseNotes";
import { Capacitor } from "@capacitor/core";

import Toast from "../components/ui/Toast";
import Tabs from "../components/ui/Tabs";
import PrimaryBtn from "../components/ui/PrimaryBtn";
import { theme } from "../lib/ui/theme";


type Tab = "today" | "review" | "week";

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
  onSync?: () => Promise<void>;
  adHeight: number;
  onSignInWithGoogle?: () => void;
  onDateSelect?: (dateStr: string) => void;
  onOpenNotificationSettings?: () => void;
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
  onSync,
  adHeight,
  onSignInWithGoogle,
  onDateSelect,
  onOpenNotificationSettings,
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

  const headerIconBtnStyle: React.CSSProperties = {
    appearance: "none",
    border: "none", /* 追加要望6: ボーダーを削除してフラットに */
    background: "rgba(255, 255, 255, 0.05)", /* ダーク背景用透け感 */
    backdropFilter: "blur(4px)",
    color: theme.surfaceDarkText, /* 白抜き */
    borderRadius: "12px",
    width: "38px",
    height: "38px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    flexShrink: 0,
    transition: "all 0.2s ease",
  };

  return (
    <div style={layoutStyle}>
      <div style={{ ...containerStyle }}>
        {/* HEADER */}
        <div
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            zIndex: 70,
            background: theme.surfaceDark, /* シックなダーク背景 */
            backdropFilter: "blur(12px) saturate(180%)",
            WebkitBackdropFilter: "blur(12px) saturate(180%)",
            borderBottom: `1px solid rgba(255,255,255,0.05)`, /* ダーク用ボーダー */
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)", /* 落ちる影 */
            paddingTop: "max(env(safe-area-inset-top, 0px), 32px)", /* ノッチを確実に避ける余裕を確保 */
            color: theme.surfaceDarkText, /* テキストを白系に */
            top: 0,
          }}
        >
          <div style={{
            ...railStyle, height: topBarHeight, display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            alignItems: "center",
          }}>
            {/* LEFT */}
            <div style={{ justifySelf: "start", fontWeight: 900, fontSize: 18 }}>
              {/* Logo text removed */}
            </div>

            {/* CENTER */}
            <div style={{ justifySelf: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button style={headerIconBtnStyle} onClick={onPrevDay}>◀</button>

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
                      padding: "0 16px",
                      borderRadius: "12px",
                      border: "none", /* 追加要望6: ボーダーレス */
                      background: "rgba(255, 255, 255, 0.05)", /* ダーク背景に馴染む透け感 */
                      fontWeight: 700,
                      color: theme.surfaceDarkText, /* 白抜きで統一 */
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
                      const val = e.target.value;
                      console.log("[DatePicker] onChange fired:", val);
                      if (val) {
                        if (onDateSelect) {
                          console.log("[DatePicker] onDateSelect called with:", val);
                          onDateSelect(val);
                        } else {
                          window.dispatchEvent(
                            new CustomEvent("lifeos:setDay", { detail: val })
                          );
                        }
                      }
                    }}
                    onClick={(e) => {
                      console.log("[DatePicker] input clicked");
                      const el = e.currentTarget as any;
                      try {
                        if (el.showPicker) el.showPicker();
                      } catch (err) {
                        console.error("[DatePicker] showPicker error:", err);
                      }
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
                    ...headerIconBtnStyle,
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
            </div>

            {/* RIGHT */}
            <div ref={menuRef} style={{ justifySelf: "end", position: "relative" }}>
              <button onClick={() => setMenuOpen(v => !v)} style={{ ...headerIconBtnStyle, width: "40px", height: "40px" }}>
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path
                    d="M4 7h16M4 12h16M4 17h16"
                    stroke={theme.surfaceDarkText}
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>

              {menuOpen && (
                <div
                  style={{
                    position: "fixed",
                    top: topBarHeight + 12,
                    left: 0,
                    right: 0,
                    display: "flex",
                    justifyContent: "center",
                    pointerEvents: "none",
                    zIndex: 80,
                  }}
                >
                  <div
                    style={{
                      pointerEvents: "auto",
                      width: "min(92vw, 340px)",
                      borderRadius: "16px",
                      border: `1px solid rgba(255,255,255,0.5)`,
                      background: "rgba(255, 255, 255, 0.85)",
                      backdropFilter: "blur(16px) saturate(180%)",
                      WebkitBackdropFilter: "blur(16px) saturate(180%)",
                      color: theme.text,
                      boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
                      padding: "16px",
                      animation: "fadeInUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)", /* アニメーション追加 (App.cssで定義必要) */
                    }}
                  >
                    <PrimaryBtn fullWidth onClick={() => {
                      setMenuOpen(false);
                      setReleaseOpen(true);
                    }}>
                      リリースノート
                    </PrimaryBtn>

                    {Capacitor.isNativePlatform() && onOpenNotificationSettings && (
                      <>
                        <div style={{ height: 8 }} />
                        <PrimaryBtn fullWidth onClick={() => {
                          setMenuOpen(false);
                          onOpenNotificationSettings();
                        }}>
                          通知設定
                        </PrimaryBtn>
                      </>
                    )}

                    <div style={{ height: 8 }} />

                    {userEmail === "offline-user@local" || !userEmail ? (
                      <PrimaryBtn fullWidth onClick={() => {
                        setMenuOpen(false);
                        onSignInWithGoogle?.();
                      }}>
                        Googleでログイン
                      </PrimaryBtn>
                    ) : (
                      <>
                        <PrimaryBtn fullWidth onClick={() => {
                          setMenuOpen(false);
                          if (onSync) onSync();
                        }}>
                          クラウド同期
                        </PrimaryBtn>

                        <div style={{ height: 8 }} />

                        <PrimaryBtn fullWidth onClick={() => {
                          setMenuOpen(false);
                          onSignOut();
                        }}>
                          ログアウト
                        </PrimaryBtn>
                      </>
                    )}

                    <div style={{ fontSize: 12, opacity: .7, marginTop: 10 }}>
                      バージョン
                    </div>
                    <div style={{ fontWeight: 700 }}>v{APP_VERSION}</div>

                    <div style={{ fontSize: 12, opacity: .7, marginTop: 10 }}>
                      {userEmail === "offline-user@local" || !userEmail ? "ステータス" : "ログイン中のユーザ"}
                    </div>
                    <div style={{ fontWeight: 600 }}>
                      {userEmail === "offline-user@local" || !userEmail ? "オフラインモード" : userEmail}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <Toast msg={msg} wrapStyle={toastWrapStyle} toastStyle={toastStyle} />

        {/* MAIN CONTENT AREA */}
        <div
          style={{
            ...railStyle,
            minHeight: `calc(100vh - ${topBarHeight}px - ${bottomNavHeight}px)`,
            paddingTop: `calc(env(safe-area-inset-top, 0px) + ${topBarHeight + 20}px)`, /* 広告が下に移動したため adHeight を削除 */
            paddingBottom: 120,
            display: "flex",
            flexDirection: "column",
            alignItems: "stretch",
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
            bottom: adHeight > 0 ? adHeight + 5 : 0, /* 重なりを防ぎつつ隙間を最小限にする */
            zIndex: 60,
            background: theme.surfaceDark, /* ヘッダーと同じダークカラー */
            backdropFilter: "blur(12px) saturate(180%)",
            WebkitBackdropFilter: "blur(12px) saturate(180%)",
            borderTop: `1px solid rgba(255,255,255,0.05)`,
            paddingBottom: "max(env(safe-area-inset-bottom, 0px), 8px)", /* 枠を消したので余白を少し詰める */
          }}
        >
          <div style={{ ...railStyle, padding: "8px 12px" }}>
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
              background: "rgba(15, 23, 42, 0.4)", /* より洗練された暗色 */
              backdropFilter: "blur(4px)", /* 後ろをぼかす */
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 100,
              animation: "fadeIn 0.2s ease",
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "min(92vw, 720px)",
                maxHeight: "80vh",
                overflow: "auto",
                borderRadius: "20px",
                background: theme.card,
                border: "none", /* ボーダー削除でスッキリ */
                boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
                padding: "24px",
                animation: "slideUpFade 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
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
