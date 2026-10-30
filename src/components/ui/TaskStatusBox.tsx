import { useRef } from "react";
import type { TaskState } from "../../lib/taskState";

const LONG_PRESS_MS = 500;
const MOVE_TOLERANCE = 10;

/**
 * タスクのチェック欄(未完了 / 対応中 / 完了)。
 * タップで完了・未完了、長押しで対応中を切り替える。
 */
export default function TaskStatusBox({
    state, color, title, onTap, onLongPress,
}: {
    state: TaskState;
    color: string;
    title: string;
    onTap: () => void;
    onLongPress: () => void;
}) {
    const timer = useRef<number | null>(null);
    const start = useRef<{ x: number; y: number } | null>(null);
    const longPressed = useRef(false);

    const cancel = () => {
        if (timer.current !== null) window.clearTimeout(timer.current);
        timer.current = null;
        start.current = null;
    };

    const done = state === "done";
    const doing = state === "doing";

    return (
        <button
            type="button"
            aria-label={`${title}：${done ? "完了" : doing ? "対応中" : "未完了"}。タップで${done ? "未完了" : "完了"}、長押しで${doing ? "未完了" : "対応中"}にする`}
            onPointerDown={(e) => {
                longPressed.current = false;
                start.current = { x: e.clientX, y: e.clientY };
                timer.current = window.setTimeout(() => {
                    longPressed.current = true;
                    timer.current = null;
                    onLongPress();
                }, LONG_PRESS_MS);
            }}
            onPointerMove={(e) => {
                // スクロールしようとしたときは長押しにしない
                if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > MOVE_TOLERANCE) cancel();
            }}
            onPointerUp={cancel}
            onPointerLeave={cancel}
            onPointerCancel={cancel}
            onContextMenu={(e) => e.preventDefault()}
            onClick={() => {
                // 長押しのあとに来るクリックは無視する
                if (longPressed.current) { longPressed.current = false; return; }
                onTap();
            }}
            style={{
                // 見た目は 22px、押せる範囲は 44px
                width: 44, height: 44, margin: -11, padding: 11, border: "none", background: "none",
                cursor: "pointer", WebkitTouchCallout: "none", userSelect: "none", WebkitUserSelect: "none",
                touchAction: "manipulation", flexShrink: 0,
            }}
        >
            <span style={{
                width: 22, height: 22, boxSizing: "border-box", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center",
                border: `2px solid ${done ? "#ffffff" : color}`,
                background: done ? color : doing ? `${color}26` : "rgba(255, 255, 255, 0.7)",
                boxShadow: done ? `0 2px 4px ${color}40` : "inset 0 1px 2px rgba(0,0,0,0.05)",
                transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
            }}>
                {done && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                    </svg>
                )}
                {/* 対応中: 途中であることを示す横線 */}
                {doing && <span style={{ width: 10, height: 3, borderRadius: 2, background: color }} />}
            </span>
        </button>
    );
}
