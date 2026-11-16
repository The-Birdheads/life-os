import { theme } from "../../../lib/ui/theme";
import { dayBit, WEEKDAY_NAMES, type Frequency } from "../../../lib/mandala/frequency";
import type { FrequencyKind } from "../../../lib/types";

const KINDS: { key: FrequencyKind; label: string }[] = [
    { key: "daily", label: "毎日" },
    { key: "weekly_count", label: "週◯回" },
    { key: "weekdays", label: "曜日指定" },
];

/** 習慣の頻度(毎日 / 週n回 / 曜日指定)を選ぶ */
export default function FrequencyPicker({ value, onChange }: { value: Frequency; onChange: (next: Frequency) => void }) {
    const count = value.count ?? 2;
    const days = value.days ?? 0;

    const pillStyle = (on: boolean): React.CSSProperties => ({
        minHeight: 40,
        borderRadius: 10,
        border: `1px solid ${on ? theme.habit : theme.border}`,
        background: on ? theme.habit : "var(--bg)",
        color: on ? "#fff" : "var(--text)",
        fontSize: 13,
        fontWeight: 700,
        cursor: "pointer",
        padding: 0,
    });

    return (
        <div style={{ display: "grid", gap: 8 }}>
            <span style={{ fontSize: 14 }}>頻度</span>
            <div role="radiogroup" aria-label="頻度" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6 }}>
                {KINDS.map((k) => (
                    <button
                        key={k.key}
                        type="button"
                        role="radio"
                        aria-checked={value.kind === k.key}
                        style={pillStyle(value.kind === k.key)}
                        onClick={() => onChange({
                            kind: k.key,
                            count: k.key === "weekly_count" ? count : null,
                            days: k.key === "weekdays" ? days : null,
                        })}
                    >
                        {k.label}
                    </button>
                ))}
            </div>
            {value.kind === "weekly_count" && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
                    <button type="button" aria-label="回数を減らす" disabled={count <= 1}
                        onClick={() => onChange({ ...value, count: Math.max(1, count - 1) })}
                        style={{ ...pillStyle(false), width: 44, height: 44, borderRadius: 22, fontSize: 20, opacity: count <= 1 ? 0.4 : 1 }}>−</button>
                    <b style={{ fontSize: 16 }}>週 {count} 回</b>
                    <button type="button" aria-label="回数を増やす" disabled={count >= 6}
                        onClick={() => onChange({ ...value, count: Math.min(6, count + 1) })}
                        style={{ ...pillStyle(false), width: 44, height: 44, borderRadius: 22, fontSize: 20, opacity: count >= 6 ? 0.4 : 1 }}>＋</button>
                </div>
            )}
            {value.kind === "weekdays" && (
                <div style={{ display: "grid", gap: 4 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 4 }}>
                        {WEEKDAY_NAMES.map((name, i) => {
                            const on = (days & dayBit(i)) !== 0;
                            return (
                                <button key={name} type="button" aria-pressed={on} style={{ ...pillStyle(on), height: 44 }}
                                    onClick={() => onChange({ ...value, days: days ^ dayBit(i) })}>
                                    {name}
                                </button>
                            );
                        })}
                    </div>
                    {days === 0 && <span style={{ fontSize: 12, color: theme.danger }}>曜日を1つ以上選んでください</span>}
                </div>
            )}
        </div>
    );
}
