import { useEffect, useState } from "react";
import { sqliteRepo } from "../../../lib/db/instance";
import type { NotificationSettings } from "../../../lib/types";
import { requestNotificationPermissions } from "../../../lib/notifications";

import Checkbox from "../../ui/Checkbox";
import PrimaryBtn from "../../ui/PrimaryBtn";
import SecondaryBtn from "../../ui/SecondaryBtn";
import { theme } from "../../../lib/ui/theme";
import Select from "../../ui/Select";

type Props = {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
    setMsg: (s: string) => void;
    adHeight?: number;
};

export default function NotificationSettingsModal({ isOpen, onClose, userId, setMsg, adHeight = 0 }: Props) {
    const [settings, setSettings] = useState<NotificationSettings>({
        id: "",
        user_id: userId,
        habit_remind_on: true,
        habit_remind_hour: 18,
        task_remind_on: true,
        task_remind_hour: 10,
        task_remind_timing: "[1]",
        review_remind_on: true,
        review_remind_hour: 21,
        updated_at: ""
    });

    const [timings, setTimings] = useState<number[]>([1]); // 1: 明日, 2: 2日後, 3: 3日後

    useEffect(() => {
        if (!isOpen || !userId) return;
        requestNotificationPermissions(); // Require permission when opening settings
        
        sqliteRepo.getNotificationSettings(userId).then(res => {
            if (res) {
                setSettings(res);
                try {
                    const parsed = JSON.parse(res.task_remind_timing);
                    if (Array.isArray(parsed)) setTimings(parsed);
                } catch(e) {}
            }
        });
    }, [isOpen, userId]);

    const handleSave = async () => {
        try {
            const finalSettings = {
                ...settings,
                task_remind_timing: JSON.stringify(timings)
            };
            await sqliteRepo.upsertNotificationSettings(finalSettings);
            
            // Trigger rescheduling
            window.dispatchEvent(new CustomEvent('lifeos:scheduleNotifications'));
            
            setMsg("通知設定を保存しました");
            onClose();
        } catch(e: any) {
            setMsg(e?.message ?? "保存に失敗しました");
        }
    };

    const toggleTiming = (val: number) => {
        if (timings.includes(val)) {
            setTimings(timings.filter(t => t !== val));
        } else {
            setTimings([...timings, val]);
        }
    };

    if (!isOpen) return null;

    const hours = Array.from({length: 24}, (_, i) => i);

    const overlayStyle: React.CSSProperties = {
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)",
        zIndex: 110, display: "flex", justifyContent: "center", alignItems: "flex-end",
        transition: "opacity 0.2s ease",
    };
    const modalStyle: React.CSSProperties = {
        width: "100%", maxWidth: 600, maxHeight: `calc(100dvh - 24px - ${adHeight}px)`,
        background: "var(--bg)", borderTopLeftRadius: 20, borderTopRightRadius: 20,
        display: "flex", flexDirection: "column",
        boxShadow: "0 -4px 20px rgba(0,0,0,0.15)",
        animation: "slideUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.2)",
    };
    const closeBtnStyle: React.CSSProperties = {
        position: "absolute", top: 16, right: 16, border: "none", background: "rgba(0,0,0,0.05)",
        width: 32, height: 32, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", fontSize: 20, lineHeight: 1, color: "var(--text)", paddingBottom: 2,
    };

    return (
        <div style={overlayStyle} onClick={onClose}>
            <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                <div style={{ position: "relative", padding: "24px 16px 16px", flexShrink: 0 }}>
                    <button style={closeBtnStyle} onClick={onClose}>×</button>
                    <h2 style={{ margin: 0, fontSize: 20 }}>通知設定</h2>
                </div>
                
                <div style={{ padding: "0 16px 24px", overflowY: "auto", flex: 1 }}>
                    <div style={{ display: "grid", gap: 24, marginTop: 12 }}>
                {/* 習慣リマインド */}
                <div style={{ background: "rgba(0,0,0,0.02)", padding: 16, borderRadius: 12 }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
                        <Checkbox 
                            checked={settings.habit_remind_on} 
                            color={theme.habit} 
                            onChange={(e) => setSettings({...settings, habit_remind_on: e.target.checked})} 
                        />
                        <div style={{ fontWeight: 600 }}>習慣のリマインド</div>
                    </div>
                    {settings.habit_remind_on && (
                        <div style={{ paddingLeft: 36, display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 14 }}>通知時間:</span>
                            <Select 
                                value={String(settings.habit_remind_hour)} 
                                onChange={(e) => setSettings({...settings, habit_remind_hour: parseInt(e.target.value)})}
                                style={{ width: 80 }}
                            >
                                {hours.map(h => <option key={h} value={h}>{h}:00</option>)}
                            </Select>
                        </div>
                    )}
                </div>

                {/* タスクリマインド */}
                <div style={{ background: "rgba(0,0,0,0.02)", padding: 16, borderRadius: 12 }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
                        <Checkbox 
                            checked={settings.task_remind_on} 
                            color={theme.task} 
                            onChange={(e) => setSettings({...settings, task_remind_on: e.target.checked})} 
                        />
                        <div style={{ fontWeight: 600 }}>タスク期限のリマインド</div>
                    </div>
                    {settings.task_remind_on && (
                        <div style={{ paddingLeft: 36, display: "grid", gap: 12 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 14 }}>通知時間:</span>
                                <Select 
                                    value={String(settings.task_remind_hour)} 
                                    onChange={(e) => setSettings({...settings, task_remind_hour: parseInt(e.target.value)})}
                                    style={{ width: 80 }}
                                >
                                    {hours.map(h => <option key={h} value={h}>{h}:00</option>)}
                                </Select>
                            </div>
                            <div>
                                <div style={{ fontSize: 14, marginBottom: 8 }}>通知タイミング:</div>
                                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 14 }}>
                                    <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                        <Checkbox checked={timings.includes(3)} color={theme.task} onChange={() => toggleTiming(3)} />
                                        3日前
                                    </label>
                                    <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                        <Checkbox checked={timings.includes(2)} color={theme.task} onChange={() => toggleTiming(2)} />
                                        2日前
                                    </label>
                                    <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                        <Checkbox checked={timings.includes(1)} color={theme.task} onChange={() => toggleTiming(1)} />
                                        1日前 (明日)
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 振り返りリマインド */}
                <div style={{ background: "rgba(0,0,0,0.02)", padding: 16, borderRadius: 12 }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
                        <Checkbox 
                            checked={settings.review_remind_on} 
                            color={theme.action} 
                            onChange={(e) => setSettings({...settings, review_remind_on: e.target.checked})} 
                        />
                        <div style={{ fontWeight: 600 }}>振り返りのリマインド</div>
                    </div>
                    {settings.review_remind_on && (
                        <div style={{ paddingLeft: 36, display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 14 }}>通知時間:</span>
                            <Select 
                                value={String(settings.review_remind_hour)} 
                                onChange={(e) => setSettings({...settings, review_remind_hour: parseInt(e.target.value)})}
                                style={{ width: 80 }}
                            >
                                {hours.map(h => <option key={h} value={h}>{h}:00</option>)}
                            </Select>
                        </div>
                    )}
                </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
                        <PrimaryBtn onClick={handleSave}>保存する</PrimaryBtn>
                        <SecondaryBtn onClick={onClose}>キャンセル</SecondaryBtn>
                    </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
