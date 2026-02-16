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

  // ✅ 追加：固定ヘッダ用
  headerDateLabel?: string;
  onPrevDay?: () => void;
  onNextDay?: () => void;
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
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const [releaseOpen, setReleaseOpen] = useState(false);
  const releaseRef = useRef<HTMLDivElement | null>(null);

  // ✅ 下固定タブの高さ
  const bottomNavHeight = 64;

  // ✅ 上固定ヘッダの高さ（見た目の好みで調整OK）
  const topBarHeight = 56;

  // ✅ 共通の中央レーン
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

  const iconBtnStyle: React.CSSProperties = {
    appearance: "none",
    border: `1px solid ${theme.border}`,
    background: theme.menuBg,
    color: theme.menuText,
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
        {/* ✅ 上固定ヘッダバー */}
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 70,
            background: theme.bg,
            borderBottom: `1px solid ${theme.border}`,
            boxShadow: "0 10px 30px rgba(0,0,0,0.10)",
            paddingTop: "env(safe-area-inset-top, 0px)",
          }}
        >
          <div style={{ ...railStyle, height: topBarHeight, display: "flex", alignItems: "center" }}>
            {/* 左：ロゴ（テキスト版。後でSVGに差し替え可） */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 900,
                  fontSize: 18,
                  letterSpacing: 0.2,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                Life OS
              </div>

              {/* register は日付不要 → 「登録」ラベル */}
              {tab === "register" ? (
                <div
                  style={{
                    fontWeight: 800,
                    opacity: 0.85,
                    whiteSpace: "nowrap",
                  }}
                >
                  登録
                </div>
              ) : (
                // today/review/week は日付バー
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <button
                    type="button"
                    onClick={onPrevDay}
                    aria-label="前日"
                    style={iconBtnStyle}
                    disabled={!onPrevDay}
                  >
                    ◀
                  </button>

                  <div
                    style={{
                      minWidth: 0,
                      padding: "8px 10px",
                      borderRadius: 12,
                      border: `1px solid ${theme.border}`,
                      background: theme.card,
                      fontWeight: 900,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={headerDateLabel ?? ""}
                  >
                    {headerDateLabel ?? ""}
                  </div>

                  <button
                    type="button"
                    onClick={onNextDay}
                    aria-label="翌日"
                    style={iconBtnStyle}
                    disabled={!onNextDay}
                  >
                    ▶
                  </button>
                </div>
              )}
            </div>

            {/* 右：ハンバーガー */}
            <div ref={menuRef} style={{ marginLeft: "auto", position: "relative", flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="メニュー"
                aria-expanded={menuOpen}
                style={{
                  ...iconBtnStyle,
                  width: 40,
                  height: 40,
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
                    border: `1px solid ${theme.menuBorder}`,
                    background: theme.menuBg,
                    color: theme.menuText,
                    boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
                    padding: 10,
                    zIndex: 80,
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

                  <div style={{ fontSize: 12, opacity: 0.75, marginTop: 10, marginBottom: 6 }}>バージョン</div>
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
          </div>
        </div>

        {/* Toast */}
        <Toast msg={msg} wrapStyle={toastWrapStyle} toastStyle={toastStyle} />

        {/* ✅ 本文（上ヘッダ & 下タブに隠れない余白） */}
        <div
          style={{
            ...railStyle,
            paddingTop: `calc(${topBarHeight}px + env(safe-area-inset-top, 0px) + 12px)`,
            paddingBottom: `calc(${bottomNavHeight}px + env(safe-area-inset-bottom, 0px) + 12px)`,
          }}
        >
          {children}
        </div>

        {/* ✅ 下固定タブ */}
        <div
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 60,
            background: theme.bg,
            borderTop: `1px solid ${theme.border}`,
            boxShadow: "0 -10px 30px rgba(0,0,0,0.12)",
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
          }}
        >
          <div style={{ ...railStyle, paddingTop: 8, paddingBottom: 8 }}>
            <Tabs tab={tab} setTab={setTab} />
          </div>
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
                <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>現在のバージョン：v{APP_VERSION}</div>
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
                  color: theme.text,
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
