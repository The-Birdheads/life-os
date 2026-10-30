import type { ReactNode } from "react";
import type { Task } from "../../../lib/types";
import PriorityBadge from "../../badges/PriorityBadge";
import VolBar from "../../badges/VolBar";
import { BellIcon } from "../../ui/Icon";

/**
 * 習慣・タスク・マイルールのカード(記録タブ・目標タブで共通)。
 * 完了すると色が反転して沈み込み、対応中は左の線と「対応中」のラベルで分かる。
 */
export default function TaskCard({
    task, accentColor, checked, check, doingSince, notes = [], hiddenNote, footer, right, onOpen,
}: {
    task: Task;
    accentColor: string;
    /** 完了(色を反転する) */
    checked: boolean;
    /** チェック欄(Checkbox / TaskStatusBox)。マイルールは右の ○× で答えるので無し */
    check?: ReactNode;
    /** 対応中のとき、対応中にした日(null は対応中ではない) */
    doingSince?: string | null;
    /** タイトルの下に出す補足(頻度・今週の回数など) */
    notes?: (string | null | undefined)[];
    /** 非表示のものを出している理由 */
    hiddenNote?: string | null;
    /** いちばん下に出すもの(目標のチップなど) */
    footer?: ReactNode;
    /** 右端に出すもの(進み具合・外すボタンなど) */
    right?: ReactNode;
    /** カードをタップしたとき(編集を開くなど) */
    onOpen?: () => void;
}) {
    const doing = doingSince !== undefined && doingSince !== null;
    const lines = notes.filter((n): n is string => !!n);

    return (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: [check ? "22px" : null, "minmax(0, 1fr)", right ? "auto" : null].filter(Boolean).join(" "),
                columnGap: 14, // 左からチェック欄までの余白と同じだけ、タイトルとの間にも空ける
                alignItems: "start",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: "10px 12px",
                // 完了: 背景をテーマ色に、未完了: 白系
                background: checked ? accentColor : "var(--card)",
                color: checked ? "#ffffff" : "var(--text)",
                // 未完了: 浮き上がる影、完了: 沈み込む内側の影
                boxShadow: checked ? "inset 0 1px 3px rgba(0,0,0,0.15)" : "0 2px 8px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)",
                transform: checked ? "translate(3px, 3px)" : "translate(0, 0)",
                transition: "all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
                cursor: onOpen ? "pointer" : "default",
                ...(doing ? { borderColor: accentColor, borderLeftWidth: 4 } : {}),
            }}
            onMouseEnter={(e) => { if (onOpen && !checked) e.currentTarget.style.transform = "translate(0,0) scale(1.01)"; }}
            onMouseLeave={(e) => { if (onOpen && !checked) e.currentTarget.style.transform = "translate(0,0) scale(1)"; }}
            onClick={onOpen}
        >
            {check && (
                <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", alignSelf: "center" }}>
                    {check}
                </div>
            )}

            <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ minWidth: 0, wordBreak: "break-word", lineHeight: 1.3, fontWeight: 600 }}>{task.title}</div>
                    {task.task_type === "habit" && task.remind_on && (
                        <BellIcon size={13} color={checked ? "rgba(255,255,255,0.8)" : accentColor} style={{ flexShrink: 0, opacity: 0.8 }} />
                    )}
                </div>
                {doing && (
                    <span style={{ justifySelf: "start", fontSize: 11, fontWeight: 700, color: "#fff", background: accentColor, borderRadius: 6, padding: "2px 6px" }}>
                        対応中{doingSince ? `（${doingSince.slice(5).replace("-", "/")}〜）` : ""}
                    </span>
                )}
                {task.memo && (
                    <div style={{ fontSize: 12, opacity: checked ? 0.8 : 0.6, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any, overflow: "hidden" }}>
                        {task.memo}
                    </div>
                )}
                {/* 優先度・ボリュームは任意なので、何も無いときは行ごと出さない(空の行の分だけ隙間ができるため) */}
                {((task.priority ?? 0) > 0 || (task.volume ?? 0) > 0 || hiddenNote) && (
                    <div style={{ opacity: 0.75, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <PriorityBadge value={task.priority} />
                        <VolBar value={task.volume} isReverse={checked} />
                        {hiddenNote ? <small style={{ opacity: 0.6 }}>{hiddenNote}</small> : null}
                    </div>
                )}
                {lines.map((line) => (
                    <div key={line} style={{ fontSize: 12, opacity: checked ? 0.85 : 0.7 }}>{line}</div>
                ))}
                {task.task_type === "oneoff" && task.due_date && (
                    <div style={{ opacity: 0.75, fontSize: 12 }}>
                        <span style={{ marginRight: 4 }}>期限：</span>
                        {task.due_date}
                    </div>
                )}
                {footer}
            </div>

            {right && <div onClick={(e) => e.stopPropagation()} style={{ alignSelf: "center" }}>{right}</div>}
        </div>
    );
}
