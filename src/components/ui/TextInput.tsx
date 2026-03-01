import React, { useState } from "react";
import { theme } from "../../lib/ui/theme";
import { radius } from "../../lib/ui/radius";

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
    fullWidth?: boolean;
};

export default function TextInput({ fullWidth = false, style, onFocus, onBlur, ...props }: Props) {
    const [focused, setFocused] = useState(false);

    const baseStyle: React.CSSProperties = {
        appearance: "none",
        background: "rgba(255, 255, 255, 0.7)", /* すりガラス的に馴染む透け感ベース */
        border: `1px solid ${focused ? theme.primary : theme.border}`,
        borderRadius: radius.md,
        padding: "10px 14px",
        fontSize: 16, // iOS Safariでのズーム防止
        color: theme.text,
        outline: "none",
        width: fullWidth ? "100%" : "auto",
        boxSizing: "border-box",
        transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        boxShadow: focused
            ? `0 0 0 3px ${theme.primary}20, inset 0 1px 2px rgba(0,0,0,0.02)` // フォーカス時のGlowエフェクト
            : "inset 0 1px 2px rgba(0,0,0,0.02)",
        ...style,
    };

    return (
        <input
            style={baseStyle}
            onFocus={(e) => {
                setFocused(true);
                if (onFocus) onFocus(e);
            }}
            onBlur={(e) => {
                setFocused(false);
                if (onBlur) onBlur(e);
            }}
            {...props}
        />
    );
}
