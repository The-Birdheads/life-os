import React from "react";
import { theme } from "../../lib/ui/theme";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
    label?: React.ReactNode;
    color?: string;
};

export default function Checkbox({ label, style, color, ...props }: Props) {
    const checked = props.checked || false;
    const clr = color || theme.primary;

    const wrapperStyle: React.CSSProperties = {
        display: "inline-flex",
        alignItems: "center",
        gap: "10px",
        cursor: "pointer",
        userSelect: "none",
        ...style,
    };

    const boxStyle: React.CSSProperties = {
        width: "22px",
        height: "22px",
        borderRadius: "6px",
        // 未完了: テーマ色、完了: 白色 のボーダー
        border: `2px solid ${checked ? "#ffffff" : clr}`,
        background: checked ? clr : "rgba(255, 255, 255, 0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        boxShadow: checked ? `0 2px 4px ${clr}40` : "inset 0 1px 2px rgba(0,0,0,0.05)",
        flexShrink: 0,
    };

    // SVG Checkmark
    const iconStyle: React.CSSProperties = {
        strokeDasharray: 24,
        strokeDashoffset: checked ? 0 : 24,
        transition: "stroke-dashoffset 0.3s cubic-bezier(0.16, 1, 0.3, 1) 0.1s",
    };

    return (
        <label style={wrapperStyle}>
            <input type="checkbox" style={{ display: "none" }} {...props} />
            <div style={boxStyle}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" style={iconStyle}></polyline>
                </svg>
            </div>
            {label && <span style={{ color: theme.text, fontSize: 14 }}>{label}</span>}
        </label>
    );
}
