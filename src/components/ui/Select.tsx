import React, { useState } from "react";
import { theme } from "../../lib/ui/theme";
import { radius } from "../../lib/ui/radius";

type Props = React.SelectHTMLAttributes<HTMLSelectElement> & {
    fullWidth?: boolean;
};

export default function Select({ fullWidth = false, style, children, onFocus, onBlur, ...props }: Props) {
    const [focused, setFocused] = useState(false);

    const wrapStyle: React.CSSProperties = {
        position: "relative",
        width: fullWidth ? "100%" : "auto",
        display: "inline-block",
    };

    const selectStyle: React.CSSProperties = {
        appearance: "none",
        background: "rgba(255, 255, 255, 0.7)",
        border: `1px solid ${focused ? theme.primary : theme.border}`,
        borderRadius: radius.md,
        padding: "10px 36px 10px 14px", // 右側にアイコン用の余白
        fontSize: 16,
        color: theme.text,
        outline: "none",
        width: "100%",
        boxSizing: "border-box",
        transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        boxShadow: focused
            ? `0 0 0 3px ${theme.primary}20, inset 0 1px 2px rgba(0,0,0,0.02)`
            : "inset 0 1px 2px rgba(0,0,0,0.02)",
        cursor: "pointer",
        ...style,
    };

    const iconStyle: React.CSSProperties = {
        position: "absolute",
        right: 14,
        top: "50%",
        transform: "translateY(-50%)",
        pointerEvents: "none",
        opacity: 0.5,
        transition: "opacity 0.2s ease",
    };

    return (
        <div style={wrapStyle}>
            <select
                style={selectStyle}
                onFocus={(e) => {
                    setFocused(true);
                    if (onFocus) onFocus(e);
                }}
                onBlur={(e) => {
                    setFocused(false);
                    if (onBlur) onBlur(e);
                }}
                {...props}
            >
                {children}
            </select>
            <div style={{ ...iconStyle, opacity: focused ? 0.8 : 0.5 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            </div>
        </div>
    );
}
