import type { ReactNode } from "react";
import { theme } from "../../../lib/ui/theme";
import { CheckIcon, RepeatIcon, ShieldIcon } from "../../ui/Icon";

export type SummaryTarget = "habit" | "task" | "rule";

type Panel = {
    key: SummaryTarget;
    label: string;
    icon: ReactNode;
    color: string;
    done: number;
    total: number;
    /** 数字の下の一言 */
    note: string;
};

/**
 * 記録タブ「すべて」の上に出す、その日のまとめ。
 * 習慣・タスクは「完了 / 件数」、マイルールは「チェック済 / 件数」(未チェックの数も出す)。
 * パネルを押すと、そのサブタブに移る
 */
export default function TodaySummary({
    habits, tasks, rules, onOpen,
}: {
    habits: { done: number; total: number };
    tasks: { done: number; total: number; doing: number };
    rules: { checked: number; total: number };
    onOpen: (target: SummaryTarget) => void;
}) {
    const panels: Panel[] = [
        {
            key: "habit", label: "習慣", icon: <RepeatIcon size={14} />, color: theme.habit, ...habits,
            note: habits.total === 0 ? "予定なし" : habits.done === habits.total ? "すべて完了" : `のこり ${habits.total - habits.done}件`,
        },
        {
            key: "task", label: "タスク", icon: <CheckIcon size={14} />, color: theme.task, ...tasks,
            note: tasks.total === 0 ? "なし" : tasks.doing > 0 ? `対応中 ${tasks.doing}件` : tasks.done === tasks.total ? "すべて完了" : `のこり ${tasks.total - tasks.done}件`,
        },
        {
            key: "rule", label: "ルール", icon: <ShieldIcon size={14} />, color: theme.rule, done: rules.checked, total: rules.total,
            note: rules.total === 0 ? "予定なし" : rules.checked === rules.total ? "すべてチェック済" : `未チェック ${rules.total - rules.checked}件`,
        },
    ];

    return (
        <div role="group" aria-label="この日のまとめ" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
            {panels.map((p) => {
                const rate = p.total ? p.done / p.total : 0;
                const complete = p.total > 0 && p.done === p.total;
                return (
                    <button key={p.key} type="button" onClick={() => onOpen(p.key)}
                        aria-label={`${p.label} ${p.done}/${p.total}件、${p.note}。${p.label}のタブを開く`}
                        style={{
                            display: "grid", gap: 6, padding: "10px 10px 12px", minWidth: 0, textAlign: "left", cursor: "pointer", fontFamily: "inherit",
                            background: complete ? `${p.color}14` : "var(--card)", border: `1px solid ${complete ? `${p.color}66` : theme.border}`,
                            borderRadius: 14, color: "var(--text)", boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
                        }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700, color: p.color }}>
                            {p.icon}{p.label}
                        </span>
                        <span style={{ fontSize: 22, fontWeight: 800, lineHeight: 1, whiteSpace: "nowrap" }}>
                            {p.done}<span style={{ fontSize: 14, fontWeight: 700, color: theme.subtext }}>/{p.total}</span>
                        </span>
                        <span aria-hidden style={{ height: 4, borderRadius: 2, background: `${p.color}22`, overflow: "hidden" }}>
                            <span style={{ display: "block", height: "100%", width: `${Math.round(rate * 100)}%`, background: p.color, borderRadius: 2, transition: "width 0.3s ease" }} />
                        </span>
                        <span style={{ fontSize: 11, color: complete ? p.color : theme.subtext, fontWeight: complete ? 700 : 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {p.note}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
