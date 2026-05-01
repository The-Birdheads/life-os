import { useEffect, useState } from "react";
import { sqliteRepo } from "../../../lib/db/instance";
import type { NotificationSettings } from "../../../lib/types";
import type { SortRule } from "../../../lib/sortTasks";
import PrimaryBtn from "../../ui/PrimaryBtn";
import SecondaryBtn from "../../ui/SecondaryBtn";
import { theme } from "../../../lib/ui/theme";
import { formatVolumeLabel } from "../../../lib/formatVolume";

type Props = {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
    setMsg: (s: string) => void;
    adHeight?: number;
    onVolumeUnitChange?: (unit: string) => void;
    onSortSettingsChange?: (rule: SortRule, prioritizeDue: boolean) => void;
};

const VOLUME_UNIT_OPTIONS = [
    { value: "15", label: "15分" },
    { value: "30", label: "30分" },
    { value: "60", label: "1時間" },
    { value: "none", label: "なし（数値のみ）" },
];

const SORT_RULE_OPTIONS: { value: SortRule; label: string }[] = [
    { value: "priority",    label: "優先度順（デフォルト）" },
    { value: "volume_desc", label: "ボリューム大きい順" },
    { value: "volume_asc",  label: "ボリューム小さい順" },
];

export default function UserSettingsModal({
    isOpen, onClose, userId, setMsg, adHeight = 0,
    onVolumeUnitChange, onSortSettingsChange,
}: Props) {
    const [volumeUnit, setVolumeUnit] = useState("30");
    const [sortRule, setSortRule] = useState<SortRule>("priority");
    const [prioritizeDue, setPrioritizeDue] = useState(false);

    useEffect(() => {
        if (!isOpen || !userId) return;

        sqliteRepo.getNotificationSettings(userId).then(res => {
            if (res) {
                setVolumeUnit(res.volume_unit ?? "30");
                setSortRule((res.sort_rule as SortRule) ?? "priority");
                setPrioritizeDue(!!res.prioritize_due);
            }
        });
    }, [isOpen, userId]);

    const handleSave = async () => {
        try {
            const existing = await sqliteRepo.getNotificationSettings(userId);
            const base: NotificationSettings = existing ?? {
                id: crypto.randomUUID(),
                user_id: userId,
                habit_remind_on: true,
                habit_remind_hour: 18,
                habit_remind_minute: 0,
                task_remind_on: true,
                task_remind_hour: 10,
                task_remind_minute: 0,
                task_remind_timing: "[1]",
                review_remind_on: true,
                review_remind_hour: 21,
                review_remind_minute: 0,
                volume_unit: volumeUnit,
                sort_rule: sortRule,
                prioritize_due: prioritizeDue,
                updated_at: "",
            };
            await sqliteRepo.upsertNotificationSettings({
                ...base,
                volume_unit: volumeUnit,
                sort_rule: sortRule,
                prioritize_due: prioritizeDue,
            });
            onVolumeUnitChange?.(volumeUnit);
            onSortSettingsChange?.(sortRule, prioritizeDue);

            setMsg("設定を保存しました");
            onClose();
        } catch (e: any) {
            setMsg(e?.message ?? "保存に失敗しました");
        }
    };

    if (!isOpen) return null;

    const overlayStyle: React.CSSProperties = {
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)",
        zIndex: 110, display: "flex", justifyContent: "center", alignItems: "flex-end",
        transition: "opacity 0.2s ease",
    };
    const modalStyle: React.CSSProperties = {
        width: "100%", maxWidth: 600,
        height: `calc(100dvh - max(env(safe-area-inset-top, 0px), 24px) - ${adHeight}px)`,
        background: "var(--bg)", borderTopLeftRadius: 20, borderTopRightRadius: 20,
        display: "flex", flexDirection: "column",
        overflowX: "hidden",
        boxShadow: "0 -4px 20px rgba(0,0,0,0.15)",
        animation: "slideUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.2)",
    };
    const closeBtnStyle: React.CSSProperties = {
        position: "absolute", top: 16, right: 16, border: "none", background: "rgba(0,0,0,0.05)",
        width: 32, height: 32, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", fontSize: 20, lineHeight: 1, color: "var(--text)", paddingBottom: 2,
    };

    const sectionStyle: React.CSSProperties = {
        background: "rgba(0,0,0,0.02)", padding: 16, borderRadius: 12,
    };

    return (
        <div style={overlayStyle} onClick={onClose}>
            <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                <div style={{ position: "relative", padding: "24px 16px 16px", flexShrink: 0 }}>
                    <button style={closeBtnStyle} onClick={onClose}>×</button>
                    <h2 style={{ margin: 0, fontSize: 20 }}>ユーザ設定</h2>
                </div>

                <div style={{ padding: "0 16px 24px", overflowY: "auto", overflowX: "hidden", flex: 1 }}>
                    <div style={{ display: "grid", gap: 24, marginTop: 12 }}>

                        {/* ボリューム単位 */}
                        <div style={sectionStyle}>
                            <div style={{ fontWeight: 600, marginBottom: 4 }}>ボリュームの単位</div>
                            <div style={{ fontSize: 13, color: theme.subtext, marginBottom: 14, lineHeight: 1.5 }}>
                                ボリューム1目盛りに相当する時間を設定します。<br />
                                例: 30分に設定するとボリューム6は{formatVolumeLabel(6, volumeUnit)}と表示されます。
                            </div>
                            <div style={{ display: "grid", gap: 8 }}>
                                {VOLUME_UNIT_OPTIONS.map(opt => (
                                    <label
                                        key={opt.value}
                                        style={{
                                            display: "flex", alignItems: "center", gap: 10,
                                            padding: "10px 14px", borderRadius: 10, cursor: "pointer",
                                            background: volumeUnit === opt.value ? theme.primarySoft : "transparent",
                                            border: `1.5px solid ${volumeUnit === opt.value ? theme.primary : theme.border}`,
                                            transition: "all 0.15s",
                                        }}
                                    >
                                        <input
                                            type="radio"
                                            name="volumeUnit"
                                            value={opt.value}
                                            checked={volumeUnit === opt.value}
                                            onChange={() => setVolumeUnit(opt.value)}
                                            style={{ accentColor: theme.primary }}
                                        />
                                        <span style={{ fontSize: 15, fontWeight: volumeUnit === opt.value ? 600 : 400 }}>{opt.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* 習慣・タスクの並び替えルール */}
                        <div style={sectionStyle}>
                            <div style={{ fontWeight: 600, marginBottom: 4 }}>習慣・タスクの並び替えのルール</div>
                            <div style={{ fontSize: 13, color: theme.subtext, marginBottom: 14, lineHeight: 1.5 }}>
                                記録タブ・振り返りタブの習慣・タスクの表示順を設定します。
                            </div>

                            {/* 行1: ソートルール プルダウン */}
                            <div style={{ marginBottom: 12 }}>
                                <label style={{ fontSize: 13, color: theme.subtext, display: "block", marginBottom: 6 }}>並び替えの基準</label>
                                <select
                                    value={sortRule}
                                    onChange={e => setSortRule(e.target.value as SortRule)}
                                    style={{
                                        width: "100%",
                                        fontSize: 14,
                                        padding: "10px 12px",
                                        borderRadius: 10,
                                        border: `1.5px solid ${theme.border}`,
                                        background: "var(--bg)",
                                        color: "var(--text)",
                                        boxSizing: "border-box",
                                    }}
                                >
                                    {SORT_RULE_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>

                            {/* 行2: 期限付きタスクを優先 チェックボックス */}
                            <label style={{
                                display: "flex", alignItems: "center", gap: 12,
                                padding: "10px 14px", borderRadius: 10, cursor: "pointer",
                                background: prioritizeDue ? theme.primarySoft : "transparent",
                                border: `1.5px solid ${prioritizeDue ? theme.primary : theme.border}`,
                                transition: "all 0.15s",
                            }}>
                                <input
                                    type="checkbox"
                                    checked={prioritizeDue}
                                    onChange={e => setPrioritizeDue(e.target.checked)}
                                    style={{ accentColor: theme.primary, width: 18, height: 18, flexShrink: 0 }}
                                />
                                <div>
                                    <div style={{ fontSize: 14, fontWeight: prioritizeDue ? 600 : 400 }}>期限付きタスクを優先表示</div>
                                    <div style={{ fontSize: 12, color: theme.subtext, marginTop: 2 }}>タスクのみ有効。期限日が近い順に上に表示されます。</div>
                                </div>
                            </label>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 4 }}>
                            <PrimaryBtn onClick={handleSave}>保存する</PrimaryBtn>
                            <SecondaryBtn onClick={onClose}>キャンセル</SecondaryBtn>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
