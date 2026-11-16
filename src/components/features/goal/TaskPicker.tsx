import { useMemo, useState } from "react";
import { theme } from "../../../lib/ui/theme";
import type { Task } from "../../../lib/types";
import type { TaskState } from "../../../lib/taskState";
import { currentFrequency, frequencyLabel } from "../../../lib/mandala/frequency";
import TextInput from "../../ui/TextInput";
import SecondaryBtn from "../../ui/SecondaryBtn";
import { isRepeating, KIND_LABEL } from "../../../lib/taskKind";

type Kind = Task["task_type"];
type HabitFilter = "shown" | "hidden";

const HABIT_FILTERS: { key: HabitFilter; label: string }[] = [
    { key: "shown", label: "表示中" },
    { key: "hidden", label: "非表示" },
];
const TASK_FILTERS: { key: TaskState; label: string }[] = [
    { key: "todo", label: "未完了" },
    { key: "doing", label: "対応中" },
    { key: "done", label: "完了済" },
];

/** 検索用に、全角・半角や大文字・小文字の違いをならす */
const normalize = (s: string) => s.normalize("NFKC").toLowerCase();

/**
 * マスにひもづける、登録済みの習慣・タスク・マイルールを選ぶ。
 * 種類のタブ、状態の絞り込み(習慣・マイルール: 表示中・非表示、タスク: 未完了・対応中・完了済)、キーワード検索。
 */
export default function TaskPicker({
    tasks, currentCellId, taskStateOf, cellLabel, busy, onPick, onCancel,
}: {
    tasks: Task[];
    /** いま開いているマス(ここにひもづいているものは出さない) */
    currentCellId: string;
    taskStateOf: (taskId: string) => TaskState;
    /** ほかのマスにひもづいているときの「要素 › 行動目標」 */
    cellLabel: (cellId: string | null | undefined) => string | null;
    busy: boolean;
    onPick: (task: Task) => void;
    onCancel: () => void;
}) {
    const [kind, setKind] = useState<Kind>("habit");
    const [habitFilter, setHabitFilter] = useState<HabitFilter>("shown");
    const [taskFilter, setTaskFilter] = useState<TaskState>("todo");
    const [query, setQuery] = useState("");

    // 習慣・マイルールは終了したものを除く(ひもづけても数えないため)
    const candidates = useMemo(
        () => tasks.filter((t) => t.mandala_cell_id !== currentCellId && !(isRepeating(t) && t.ended_at)),
        [tasks, currentCellId]
    );
    const matchFilter = (t: Task, k: Kind, hf: HabitFilter, tf: TaskState) =>
        k !== "oneoff"
            ? t.task_type === k && (hf === "hidden" ? !!t.is_hidden : !t.is_hidden)
            : t.task_type === "oneoff" && taskStateOf(t.id) === tf;
    const q = normalize(query.trim());
    const matchQuery = (t: Task) => !q || normalize(t.title).includes(q) || normalize(t.memo ?? "").includes(q);

    const list = candidates.filter((t) => matchFilter(t, kind, habitFilter, taskFilter) && matchQuery(t));
    const countOf = (k: Kind, hf: HabitFilter, tf: TaskState) =>
        candidates.filter((t) => matchFilter(t, k, hf, tf) && matchQuery(t)).length;

    const pill = (on: boolean): React.CSSProperties => ({
        minHeight: 36, borderRadius: 18, padding: "0 12px", fontSize: 13, fontWeight: 700, cursor: "pointer",
        border: `1px solid ${on ? "#0F172A" : theme.border}`, background: on ? "#0F172A" : "var(--bg)", color: on ? "#fff" : "var(--text)",
        fontFamily: "inherit", whiteSpace: "nowrap",
    });
    const tab = (on: boolean): React.CSSProperties => ({
        minHeight: 40, borderRadius: 10, border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
        background: on ? "var(--bg)" : "transparent", color: on ? "var(--text)" : theme.subtext,
        boxShadow: on ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
    });

    return (
        <div style={{ display: "grid", gap: 10, borderTop: `1px solid ${theme.border}`, paddingTop: 14 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>ひもづける習慣・タスク・マイルールを選ぶ</h3>

            <div role="tablist" aria-label="習慣・タスク・マイルールの切り替え"
                style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, padding: 4, borderRadius: 12, background: theme.card }}>
                {(["habit", "oneoff", "rule"] as Kind[]).map((k) => (
                    <button key={k} type="button" role="tab" aria-selected={kind === k} style={tab(kind === k)} onClick={() => setKind(k)}>
                        {KIND_LABEL[k]}
                    </button>
                ))}
            </div>

            <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
                {kind !== "oneoff"
                    ? HABIT_FILTERS.map((f) => (
                        <button key={f.key} type="button" aria-pressed={habitFilter === f.key} style={pill(habitFilter === f.key)} onClick={() => setHabitFilter(f.key)}>
                            {f.label}（{countOf(kind, f.key, taskFilter)}）
                        </button>
                    ))
                    : TASK_FILTERS.map((f) => (
                        <button key={f.key} type="button" aria-pressed={taskFilter === f.key} style={pill(taskFilter === f.key)} onClick={() => setTaskFilter(f.key)}>
                            {f.label}（{countOf("oneoff", habitFilter, f.key)}）
                        </button>
                    ))}
            </div>

            <TextInput type="search" aria-label="キーワードで探す" placeholder="キーワードで探す" value={query} onChange={(e) => setQuery(e.target.value)} fullWidth />

            {list.length === 0 && (
                <p style={{ margin: 0, fontSize: 13, color: theme.subtext }}>
                    {q ? "キーワードに合うものがありません。" : "選べるものがありません。"}
                </p>
            )}
            {list.map((t) => {
                const other = cellLabel(t.mandala_cell_id);
                const sub = [
                    isRepeating(t) ? frequencyLabel(currentFrequency(t)) : t.due_date ? `期限 ${t.due_date.replace(/-/g, "/")}` : null,
                    t.task_type === "oneoff" && t.is_hidden ? "非表示" : null,
                    other ? `「${other}」から付け替えます` : null,
                ].filter(Boolean).join(" ・ ");
                return (
                    <button key={t.id} type="button" disabled={busy} onClick={() => onPick(t)}
                        style={{
                            display: "flex", flexDirection: "column", alignItems: "stretch", gap: 2, minHeight: 52, textAlign: "left",
                            background: theme.card, borderRadius: 12, padding: "8px 12px", border: `1px solid ${theme.border}`,
                            cursor: "pointer", color: "var(--text)", fontFamily: "inherit",
                        }}>
                        <span style={{ fontSize: 14, fontWeight: 700 }}>{t.title}</span>
                        {sub && <span style={{ fontSize: 12, color: theme.subtext }}>{sub}</span>}
                    </button>
                );
            })}
            <SecondaryBtn fullWidth onClick={onCancel}>キャンセル</SecondaryBtn>
        </div>
    );
}
