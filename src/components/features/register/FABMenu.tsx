import React, { useState, useEffect } from "react";
import { theme } from "../../../lib/ui/theme";

type Props = {
    onSelect: (type: "habit" | "oneoff" | "action") => void;
};

export default function FABMenu({ onSelect }: Props) {
    const [open, setOpen] = useState(false);

    // 外側クリックで閉じる
    useEffect(() => {
        if (!open) return;
        const onClick = () => {
            // FABメニューの内側クリックは伝播させない工夫が必要だが、
            // 今回はシンプルにキャプチャフェーズで処理するか、
            // メニュー内のクリックで閉じるのでそのままでOK
        };
        // 少し遅らせて登録（開いた瞬間のクリックを拾わないように）
        const t = setTimeout(() => window.addEventListener("click", onClick), 10);
        return () => {
            clearTimeout(t);
            window.removeEventListener("click", onClick);
        };
    }, [open]);

    const fabStyle: React.CSSProperties = {
        position: "fixed",
        right: 24,
        bottom: 104, // Tabs(64px) + 余白バランス
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
        fontSize: 28,
        cursor: "pointer",
        zIndex: 80,
        transition: "transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
        transform: open ? "rotate(45deg)" : "rotate(0deg)",
    };

    const menuStyle: React.CSSProperties = {
        position: "fixed",
        right: 24,
        bottom: 176, // 104 + 56 + 16
        display: "flex",
        flexDirection: "column",
        gap: 12,
        alignItems: "flex-end",
        zIndex: 79,
        opacity: open ? 1 : 0,
        pointerEvents: open ? "auto" : "none",
        transform: open ? "translateY(0)" : "translateY(20px)",
        transition: "all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
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
            {open && (
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
                    style={itemBtnStyle}
                    onClick={() => {
                        onSelect("habit");
                        setOpen(false);
                    }}
                >
                    <div style={iconWrapStyle}>🔁</div>
                    習慣の登録
                </button>
                <button
                    style={itemBtnStyle}
                    onClick={() => {
                        onSelect("oneoff");
                        setOpen(false);
                    }}
                >
                    <div style={iconWrapStyle}>✅</div>
                    タスクの登録
                </button>
                <button
                    style={itemBtnStyle}
                    onClick={() => {
                        onSelect("action");
                        setOpen(false);
                    }}
                >
                    <div style={iconWrapStyle}>⚡</div>
                    行動の登録
                </button>
            </div>
            <button style={fabStyle} onClick={() => setOpen(!open)}>
                ＋
            </button>
        </>
    );
}
