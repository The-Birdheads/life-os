import { useEffect, useRef, useState } from "react";
import { APP_VERSION, RELEASE_NOTES } from "../lib/releaseNotes";
import { Capacitor } from "@capacitor/core";

import Toast from "../components/ui/Toast";
import Tabs from "../components/ui/Tabs";
import PrimaryBtn from "../components/ui/PrimaryBtn";
import DangerBtn from "../components/ui/DangerBtn";
import SecondaryBtn from "../components/ui/SecondaryBtn";
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
  onSignInWithApple?: () => void;
  onDateSelect?: (dateStr: string) => void;
  onOpenNotificationSettings?: () => void;
  onOpenUserSettings?: () => void;
  onOpenOnboarding?: () => void;
  onOpenHabitTutorial?: () => void;
  onDeleteAccount?: () => Promise<void>;
  isDeleting?: boolean;
  isSyncing?: boolean;
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
  onSignInWithApple,
  onDateSelect,
  onOpenNotificationSettings,
  onOpenUserSettings,
  onOpenOnboarding,
  onOpenHabitTutorial,
  onDeleteAccount,
  isDeleting,
  isSyncing,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const [releaseOpen, setReleaseOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

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
    if (!menuOpen) { setTutorialOpen(false); setSettingsOpen(false); setAccountOpen(false); setLoginOpen(false); return; }

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

  useEffect(() => {
    if (!deleteConfirmOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDeleteConfirmOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleteConfirmOpen]);

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
        {/* AdMobとステータスバーの裏の空間（SafeAreaの白い隙間）をヘッダー色で塗りつぶす背景レイヤー */}
        {adHeight > 0 && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              height: `calc(env(safe-area-inset-top, 0px) + ${adHeight}px + 20px)`,
              background: theme.surfaceDark,
              zIndex: 69, /* ヘッダー(70)の直下 */
            }}
          />
        )}

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
            paddingTop: `calc(max(env(safe-area-inset-top, 0px), 32px) + ${adHeight}px)`, /* バナー広告 + ノッチ分を確保 */
            color: theme.surfaceDarkText, /* テキストを白系に */
            top: adHeight > 0 ? `calc(env(safe-area-inset-top, 0px) + ${adHeight}px)` : 0,
            transition: "top 0.2s ease, padding-top 0.2s ease",
          }}
        >
          <div style={{
            ...railStyle, height: topBarHeight, display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            alignItems: "center",
          }}>
            {/* LEFT */}
            <div style={{ justifySelf: "start" }}>
              <button
                style={{
                  ...headerIconBtnStyle,
                  width: "auto",
                  padding: "0 12px",
                  fontSize: 13,
                  fontWeight: 700,
                }}
                onClick={() => {
                  const today = new Date().toISOString().slice(0, 10);
                  if (onDateSelect) {
                    onDateSelect(today);
                  } else {
                    window.dispatchEvent(new CustomEvent("lifeos:setDay", { detail: today }));
                  }
                }}
              >
                今日
              </button>
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
              <button aria-label="メニュー" data-tutorial="hamburger" onClick={() => setMenuOpen(v => !v)} style={{ ...headerIconBtnStyle, width: "40px", height: "40px" }}>

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
                    top: `calc(max(env(safe-area-inset-top, 0px), 32px) + ${adHeight + topBarHeight + 8}px)`,
                    left: 0,
                    right: 0,
                    display: "flex",
                    justifyContent: "center",
                    pointerEvents: "none",
                    zIndex: 80,
                  }}
                >
                  <div
                    aria-label="ハンバーガーメニュー"
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
                    {(() => {
                      const isLoggedIn = !!(userEmail && userEmail !== "offline-user@local");
                      const btnL: React.CSSProperties = { justifyContent: "flex-start" };
                      const subL: React.CSSProperties = { background: theme.border, color: theme.text, justifyContent: "flex-start" };
                      const accordionInner = (label: string, open: boolean) => (
                        <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                          <span>{label}</span>
                          <span style={{ display: "inline-block", transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0deg)", fontSize: 12, opacity: 0.7 }}>▼</span>
                        </span>
                      );

                      const tutorialBlock = (onOpenOnboarding || onOpenHabitTutorial) ? (
                        <>
                          <PrimaryBtn fullWidth onClick={() => setTutorialOpen(o => !o)} style={btnL}>
                            {accordionInner("使い方を見る", tutorialOpen)}
                          </PrimaryBtn>
                          {tutorialOpen && (
                            <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 6 }}>
                              {onOpenOnboarding && (
                                <PrimaryBtn fullWidth onClick={() => { setMenuOpen(false); onOpenOnboarding(); }} style={subL}>
                                  アプリの基本操作
                                </PrimaryBtn>
                              )}
                              {onOpenHabitTutorial && (
                                <PrimaryBtn fullWidth onClick={() => { setMenuOpen(false); onOpenHabitTutorial(); }} style={subL}>
                                  習慣の追加
                                </PrimaryBtn>
                              )}
                            </div>
                          )}
                        </>
                      ) : null;

                      const settingsBlock = (onOpenUserSettings || (Capacitor.isNativePlatform() && onOpenNotificationSettings)) ? (
                        <>
                          <PrimaryBtn fullWidth onClick={() => setSettingsOpen(o => !o)} style={btnL}>
                            {accordionInner("設定", settingsOpen)}
                          </PrimaryBtn>
                          {settingsOpen && (
                            <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 6 }}>
                              {onOpenUserSettings && (
                                <PrimaryBtn fullWidth onClick={() => { setMenuOpen(false); onOpenUserSettings(); }} style={subL}>
                                  ユーザ設定
                                </PrimaryBtn>
                              )}
                              {Capacitor.isNativePlatform() && onOpenNotificationSettings && (
                                <PrimaryBtn fullWidth onClick={() => { setMenuOpen(false); onOpenNotificationSettings(); }} style={subL}>
                                  通知設定
                                </PrimaryBtn>
                              )}
                            </div>
                          )}
                        </>
                      ) : null;

                      const releaseBlock = (
                        <PrimaryBtn fullWidth onClick={() => { setMenuOpen(false); setReleaseOpen(true); }} style={btnL}>
                          リリースノート
                        </PrimaryBtn>
                      );

                      if (isLoggedIn) {
                        return (
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {tutorialBlock}
                            {settingsBlock}
                            {releaseBlock}
                            <PrimaryBtn fullWidth onClick={() => { setMenuOpen(false); if (onSync) onSync(); }} style={btnL}>
                              クラウド同期
                            </PrimaryBtn>
                            <PrimaryBtn fullWidth onClick={() => setAccountOpen(o => !o)} style={btnL}>
                              {accordionInner("アカウント", accountOpen)}
                            </PrimaryBtn>
                            {accountOpen && (
                              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                <PrimaryBtn fullWidth onClick={() => { setMenuOpen(false); onSignOut(); }} style={subL}>
                                  ログアウト
                                </PrimaryBtn>
                                {onDeleteAccount && (
                                  <DangerBtn fullWidth onClick={() => { setMenuOpen(false); setDeleteConfirmOpen(true); }} style={btnL}>
                                    アカウント削除
                                  </DangerBtn>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      }

                      return (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {tutorialBlock}
                          {settingsBlock}
                          {releaseBlock}
                          <PrimaryBtn fullWidth onClick={() => setLoginOpen(o => !o)} style={btnL}>
                            {accordionInner("ログイン", loginOpen)}
                          </PrimaryBtn>
                          {loginOpen && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              {onSignInWithApple && (
                                <PrimaryBtn fullWidth onClick={() => { setMenuOpen(false); onSignInWithApple(); }}
                                  style={{ background: "#000", color: "#fff", justifyContent: "flex-start" }}>
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                                  </svg>
                                  Appleでログイン
                                </PrimaryBtn>
                              )}
                              <PrimaryBtn fullWidth onClick={() => { setMenuOpen(false); onSignInWithGoogle?.(); }} style={subL}>
                                Googleでログイン
                              </PrimaryBtn>
                            </div>
                          )}
                        </div>
                      );
                    })()}

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
            paddingTop: `calc(env(safe-area-inset-top, 0px) + ${adHeight + topBarHeight + 20}px)`,
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
          data-tutorial="bottom-tabs"
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
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
      {/* DELETE CONFIRM MODAL */}
      {deleteConfirmOpen && (
        <div
          onClick={() => setDeleteConfirmOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.4)",
            backdropFilter: "blur(4px)",
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
              width: "min(92vw, 360px)",
              borderRadius: "20px",
              background: theme.card,
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
              padding: "24px",
              animation: "slideUpFade 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>
              アカウント削除の確認
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
              登録済みのすべてのデータが削除され、復元することはできませんがよろしいですか？
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <DangerBtn fullWidth onClick={async () => {
                setDeleteConfirmOpen(false);
                await onDeleteAccount?.();
              }}>
                はい
              </DangerBtn>
              <SecondaryBtn fullWidth onClick={() => setDeleteConfirmOpen(false)}>
                いいえ
              </SecondaryBtn>
            </div>
          </div>
        </div>
      )}

      {/* SYNCING OVERLAY */}
      {isSyncing && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.5)",
            backdropFilter: "blur(4px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200,
            gap: 16,
            pointerEvents: "all",
          }}
        >
          <div style={{
            width: 40,
            height: 40,
            border: "3px solid rgba(255,255,255,0.2)",
            borderTop: "3px solid #fff",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }} />
          <div style={{ color: "#fff", fontWeight: 600, fontSize: 15 }}>
            同期中...
          </div>
        </div>
      )}

      {/* DELETING OVERLAY */}
      {isDeleting && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200,
            gap: 16,
          }}
        >
          <div style={{
            width: 40,
            height: 40,
            border: "3px solid rgba(255,255,255,0.2)",
            borderTop: "3px solid #fff",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }} />
          <div style={{ color: "#fff", fontWeight: 600, fontSize: 15 }}>
            削除中...
          </div>
        </div>
      )}
    </div >
  );
}
