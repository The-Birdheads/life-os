import { theme } from "../../../lib/ui/theme";
import type { GoalOptionGroup } from "../../../lib/mandala/useMandala";

/**
 * 習慣・タスクの側から、ひもづける行動目標を選ぶ(任意)。
 * チャートが無い、または選べるマスが無いときは出さない。
 */
export default function GoalLinkField({
    groups, value, onChange,
}: {
    groups: GoalOptionGroup[];
    value: string | null;
    onChange: (cellId: string | null) => void;
}) {
    if (groups.length === 0) return null;
    const current = groups.find((g) => g.cells.some((c) => c.id === value));

    return (
        <label style={{ display: "grid", gap: 6, fontSize: 14 }}>
            <span>行動目標<span style={{ fontSize: 12, color: theme.subtext }}>（任意）</span></span>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {current && <span style={{ width: 10, height: 10, borderRadius: 5, background: current.color, flexShrink: 0 }} />}
                <select
                    aria-label="ひもづける行動目標"
                    value={value ?? ""}
                    onChange={(e) => onChange(e.target.value || null)}
                    style={{
                        flex: 1, minWidth: 0, minHeight: 44, fontSize: 15, padding: "0 10px", borderRadius: 10,
                        border: `1px solid ${theme.border}`, background: "var(--bg)", color: "var(--text)", fontFamily: "inherit",
                    }}
                >
                    <option value="">ひもづけない</option>
                    {/* 休止中のマスにひもづいているときは、選びなおすまでそのまま */}
                    {value && !current && <option value={value}>今のひもづけ先（休止中）</option>}
                    {groups.map((g) => (
                        <optgroup key={g.element} label={g.element}>
                            {g.cells.map((c) => (
                                <option key={c.id} value={c.id}>{c.text}{c.achieved ? "（達成）" : ""}</option>
                            ))}
                        </optgroup>
                    ))}
                </select>
            </span>
        </label>
    );
}
