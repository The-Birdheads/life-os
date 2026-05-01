import React, { useState, useEffect } from "react";
import { theme } from "../../../lib/ui/theme";
import { RepeatIcon, CheckIcon, ZapIcon } from "../../ui/Icon";

type Props = {
    onSelect: (type: "habit" | "oneoff" | "action") => void;
    onFirstPress?: () => void;
    forceOpen?: boolean;
};

export default function FABMenu({ onSelect, onFirstPress, forceOpen }: Props) {
    const [open, setOpen] = useState(false);
    const isMenuOpen = forceOpen || open;

    // 外側クリックで閉じる
    useEffect(() => {
        if (!open) return;
        const onClick = () => { };
        const t = setTimeout(() => window.addEventListener("click", onClick), 10);
        return () => {
            clearTimeout(t);
            window.removeEventListener("click", onClick);
        };
    }, [open]);

    // フッター(64px) + safe-area-inset-bottom + 右端と同じ 24px 分の余白
    const fabBottom = "calc(max(env(safe-area-inset-bottom, 0px), 8px) + 64px + 24px)";
    const menuBottom = "calc(max(env(safe-area-inset-bottom, 0px), 8px) + 64px + 24px + 56px + 12px)";

    const fabStyle: React.CSSProperties = {
        position: "fixed",
        right: 24,
        bottom: fabBottom,
        width: 56,
        height: 56,
        borderRadius: 28,
        background: theme.primary,
        color: "#fff",
        border: "none",
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        zIndex: 80,
        transition: "transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
        transform: isMenuOpen ? "rotate(45deg)" : "rotate(0deg)",
        padding: 0,
    };

    const menuStyle: React.CSSProperties = {
        position: "fixed",
        right: 24,
        bottom: menuBottom,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        alignItems: "flex-end",
        zIndex: 79,
        opacity: isMenuOpen ? 1 : 0,
        pointerEvents: isMenuOpen ? "auto" : "none",
        transform: isMenuOpen ? "translateY(0)" : "translateY(20px)",
        transition: "opacity 0.2s ease, transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    };

    const itemBtnStyle: React.CSSProperties = {
        display: "flex",
        alignItems: "center",
        gap: 12,
        background: theme.card,
        color: theme.text,
        border: `1px solid ${theme.border}`,
        borderRadius: 24,
        padding: "8px 16px 8px 12px",
        cursor: "pointer",
        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
        fontWeight: 600,
        fontSize: 14,
        appearance: "none",
    };

    const iconWrapStyle: React.CSSProperties = {
        background: theme.primarySoft,
        width: 32,
        height: 32,
        borderRadius: 16,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 16,
    };

    return (
        <>
            {isMenuOpen && !forceOpen && (
                <div
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: "rgba(0,0,0,0.2)",
                        zIndex: 78,
                        backdropFilter: "blur(2px)",
                    }}
                    onClick={() => setOpen(false)}
                />
            )}
            <div style={menuStyle}>
                <button
                    data-tutorial="fab-menu-habit"
                    style={itemBtnStyle}
                    onClick={() => { onSelect("habit"); setOpen(false); }}
                >
                    <div style={iconWrapStyle}><RepeatIcon size={18} color={theme.primary} /></div>
                    習慣の登録
                </button>
                <button
                    style={itemBtnStyle}
                    onClick={() => { onSelect("oneoff"); setOpen(false); }}
                >
                    <div style={iconWrapStyle}><CheckIcon size={18} color={theme.primary} /></div>
                    タスクの登録
                </button>
                <button
                    style={itemBtnStyle}
                    onClick={() => { onSelect("action"); setOpen(false); }}
                >
                    <div style={iconWrapStyle}><ZapIcon size={18} color={theme.primary} /></div>
                    行動の登録
                </button>
            </div>
            <button
                data-tutorial="fab"
                style={fabStyle}
                onClick={() => {
                    if (forceOpen) return;
                    if (onFirstPress && !localStorage.getItem("fab_tutorial_done")) {
                        onFirstPress();
                        return;
                    }
                    setOpen(!open);
                }}
                aria-label="メニューを開く"
            >
                {/* SVG の + をボタン中央に正確に配置 */}
                <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    style={{ display: "block" }}
                >
                    <line x1="12" y1="4" x2="12" y2="20" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                    <line x1="4" y1="12" x2="20" y2="12" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
            </button>
        </>
    );
}
