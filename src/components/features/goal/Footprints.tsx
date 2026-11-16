import { weekDays } from "../../../lib/mandala/tally";

/**
 * 今週(月〜日)の足あと。やった日だけ印が付く。やらなかった日は目立たせず、これからの日はさらに薄くする。
 * 読み上げは親の aria-label(「今週 ◯日」)に任せる
 */
export default function Footprints({
    days,
    today,
    color,
    onStrong = false,
    size = 7,
}: {
    days: Set<string>;
    today: string;
    color: string;
    /** 濃い背景の上に出すとき(印を白にする) */
    onStrong?: boolean;
    size?: number;
}) {
    const mark = onStrong ? "#FFFFFF" : color;
    return (
        <span aria-hidden style={{ display: "flex", gap: Math.max(2, size * 0.45), alignItems: "center" }}>
            {weekDays(today).map((d) => {
                const done = days.has(d);
                const future = d > today;
                return (
                    <span key={d} style={{
                        width: size, height: size, borderRadius: size / 2, boxSizing: "border-box", flexShrink: 0,
                        background: done ? mark : "transparent",
                        border: done ? "none" : `1px solid ${onStrong ? "rgba(255,255,255,0.55)" : "rgba(15,23,42,0.22)"}`,
                        opacity: future ? 0.45 : 1,
                    }} />
                );
            })}
        </span>
    );
}
