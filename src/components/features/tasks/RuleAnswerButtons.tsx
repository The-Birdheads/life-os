import type { RuleAnswer } from "../../../lib/taskKind";
import { theme } from "../../../lib/ui/theme";

/**
 * マイルールの ○ / × ボタン。選んでいるほうをもう一度押すと、答える前に戻る。
 * onAccent: カードが ○ で色づいているとき(ボタンを白抜きにする)
 */
export default function RuleAnswerButtons({
    value, title, onChange, onAccent = false,
}: {
    value: RuleAnswer;
    title: string;
    onChange: (next: RuleAnswer) => void;
    onAccent?: boolean;
}) {
    const button = (answer: "done" | "missed") => {
        const selected = value === answer;
        const color = answer === "done" ? theme.rule : theme.subtext;
        const label = answer === "done" ? "守れた" : "守れなかった";
        return (
            <button
                type="button"
                aria-pressed={selected}
                aria-label={`「${title}」を${label}にする`}
                onClick={() => onChange(selected ? null : answer)}
                style={{
                    width: 40, height: 40, borderRadius: 20, flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    border: `2px solid ${selected ? (onAccent ? "#FFFFFF" : color) : onAccent ? "rgba(255,255,255,0.6)" : theme.border}`,
                    background: selected ? (onAccent ? "#FFFFFF" : color) : "transparent",
                    color: selected ? (onAccent ? color : "#FFFFFF") : onAccent ? "#FFFFFF" : theme.subtext,
                    cursor: "pointer", padding: 0, fontFamily: "inherit",
                    transition: "background 0.15s ease, border-color 0.15s ease",
                }}
            >
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" aria-hidden>
                    {answer === "done" ? <circle cx="12" cy="12" r="8" /> : <path d="M6 6l12 12M18 6L6 18" />}
                </svg>
            </button>
        );
    };
    return (
        <div style={{ display: "flex", gap: 6 }}>
            {button("done")}
            {button("missed")}
        </div>
    );
}
