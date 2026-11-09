import type { CSSProperties } from "react";
import type { RuleAnswer } from "../../../lib/taskKind";
import { theme } from "../../../lib/ui/theme";

/**
 * マイルールの ○ / × ボタン。選んでいるほうをもう一度押すと、答える前に戻る。
 * onAccent: カードが ○ で色づいているとき(ボタンを白抜きにする)
 * readOnly: 答えを見せるだけ(振り返りタブ)。選んでいるほうだけを、押せない印で出す
 */
export default function RuleAnswerButtons({
    value, title, onChange, onAccent = false, readOnly = false, tutorial,
}: {
    value: RuleAnswer;
    title: string;
    onChange?: (next: RuleAnswer) => void;
    onAccent?: boolean;
    readOnly?: boolean;
    /** 使い方の案内で照らすときの目印(data-tutorial) */
    tutorial?: string;
}) {
    const button = (answer: "done" | "missed") => {
        const selected = value === answer;
        const color = answer === "done" ? theme.rule : theme.subtext;
        const label = answer === "done" ? "守れた" : "守れなかった";
        const style: CSSProperties = {
            width: 40, height: 40, borderRadius: 20, flexShrink: 0, boxSizing: "border-box",
            display: "flex", alignItems: "center", justifyContent: "center",
            border: `2px solid ${selected ? (onAccent ? "#FFFFFF" : color) : onAccent ? "rgba(255,255,255,0.6)" : theme.border}`,
            background: selected ? (onAccent ? "#FFFFFF" : color) : "transparent",
            color: selected ? (onAccent ? color : "#FFFFFF") : onAccent ? "#FFFFFF" : theme.subtext,
            cursor: "pointer", padding: 0, fontFamily: "inherit",
            transition: "background 0.15s ease, border-color 0.15s ease",
        };
        const icon = (
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" aria-hidden>
                {answer === "done" ? <circle cx="12" cy="12" r="8" /> : <path d="M6 6l12 12M18 6L6 18" />}
            </svg>
        );
        if (readOnly) {
            return selected ? <span key={answer} role="img" aria-label={label} style={{ ...style, cursor: "default" }}>{icon}</span> : null;
        }
        return (
            <button
                key={answer}
                type="button"
                aria-pressed={selected}
                aria-label={`「${title}」を${label}にする`}
                onClick={() => onChange?.(selected ? null : answer)}
                style={style}
            >
                {icon}
            </button>
        );
    };
    return (
        <div data-tutorial={tutorial} style={{ display: "flex", gap: 6 }}>
            {button("done")}
            {button("missed")}
        </div>
    );
}
