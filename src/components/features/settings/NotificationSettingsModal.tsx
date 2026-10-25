import { useEffect, useState } from "react";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Capacitor } from "@capacitor/core";
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
        habit_remind_minute: 0,
        task_remind_on: true,
        task_remind_hour: 10,
        task_remind_minute: 0,
        task_remind_timing: "[1]",
        review_remind_on: true,
        review_remind_hour: 21,
        review_remind_minute: 0,
        volume_unit: "30",
        sort_rule: "priority",
        prioritize_due: false,
        updated_at: ""
    });

    const [timings, setTimings] = useState<number[]>([1]);
    // null = まだチェック中, true = 許可済み, false = 拒否 or 未許可
    const [permGranted, setPermGranted] = useState<boolean | null>(null);

    useEffect(() => {
        if (!isOpen || !userId) return;

        // 通知設定の読み込み
        sqliteRepo.getNotificationSettings(userId).then(res => {
            if (res) {
                setSettings(res);
                try {
                    const parsed = JSON.parse(res.task_remind_timing);
                    if (Array.isArray(parsed)) setTimings(parsed);
                } catch(e) {}
            }
        });

        // 通知権限の確認
        if (Capacitor.isNativePlatform()) {
            (async () => {
                const status = await LocalNotifications.checkPermissions();
                if (status.display === "granted") {
                    setPermGranted(true);
                } else if (status.display === "prompt") {
                    // まだダイアログを出せる → リクエスト
                    const granted = await requestNotificationPermissions();
                    setPermGranted(granted);
                } else {
                    // denied → ダイアログは出せないので設定アプリへ誘導
                    setPermGranted(false);
                }
            })();
        } else {
            setPermGranted(true); // Web では制限しない
        }
    }, [isOpen, userId]);

    const handleSave = async () => {
        try {
            const finalSettings = {
                ...settings,
                task_remind_timing: JSON.stringify(timings)
            };
            await sqliteRepo.upsertNotificationSettings(finalSettings);
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

    // 通知がOFFの場合、ONへの切り替えをブロック
    const handleRemindToggle = (key: keyof NotificationSettings, next: boolean) => {
        if (next && !permGranted) return; // 許可なし → ONにできない
        setSettings({ ...settings, [key]: next });
    };

    if (!isOpen) return null;

    const hours = Array.from({length: 24}, (_, i) => i);
    const minutes = Array.from({length: 60}, (_, i) => i);

    const TimePicker = ({
        hour, minute,
        onHourChange, onMinuteChange,
    }: {
        hour: number; minute: number;
        onHourChange: (h: number) => void;
        onMinuteChange: (m: number) => void;
    }) => (
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Select
                value={String(hour)}
                onChange={(e) => onHourChange(parseInt(e.target.value))}
                style={{ width: 72 }}
            >
                {hours.map(h => <option key={h} value={h}>{String(h).padStart(2, "0")}</option>)}
            </Select>
            <span style={{ fontSize: 14, opacity: 0.7 }}>時</span>
            <Select
                value={String(minute)}
                onChange={(e) => onMinuteChange(parseInt(e.target.value))}
                style={{ width: 72 }}
            >
                {minutes.map(m => <option key={m} value={m}>{String(m).padStart(2, "0")}</option>)}
            </Select>
            <span style={{ fontSize: 14, opacity: 0.7 }}>分</span>
        </div>
    );

    const overlayStyle: React.CSSProperties = {
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)",
        zIndex: 110, display: "flex", justifyContent: "center", alignItems: "flex-end",
        transition: "opacity 0.2s ease",
    };
    const modalStyle: React.CSSProperties = {
        width: "100%", maxWidth: 600, maxHeight: `calc(100dvh - max(env(safe-area-inset-top, 0px), 24px) - ${adHeight}px)`,
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

    // 権限なしのときに各セクションをグレーアウトするラッパースタイル
    const disabledOverlay = (isOn: boolean): React.CSSProperties =>
        (!permGranted && !isOn)
            ? { opacity: 0.45, pointerEvents: "none" }
            : {};

    return (
        <div style={overlayStyle} onClick={onClose}>
            <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                <div style={{ position: "relative", padding: "24px 16px 16px", flexShrink: 0 }}>
                    <button style={closeBtnStyle} onClick={onClose}>×</button>
                    <h2 style={{ margin: 0, fontSize: 20 }}>通知設定</h2>
                </div>

                <div style={{ padding: "0 16px 24px", overflowY: "auto", flex: 1 }}>
                    <div style={{ display: "grid", gap: 24, marginTop: 12 }}>

                        {/* 権限なし警告バナー */}
                        {permGranted === false && (
                            <div style={{
                                display: "flex", flexDirection: "column", gap: 10,
                                padding: "12px 14px",
                                borderRadius: 12,
                                background: theme.surfaceDark,
                                backdropFilter: "blur(12px)",
                                WebkitBackdropFilter: "blur(12px)",
                                borderLeft: `3px solid ${theme.warning}`,
                                color: theme.surfaceDarkText,
                            }}>
                                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                                    <span style={{ color: theme.warning, fontSize: 16, flexShrink: 0 }}>⚠</span>
                                    <div style={{ fontSize: 13, lineHeight: 1.55 }}>
                                        <b>通知がオフになっています。</b><br />
                                        ONにするには、iOSの設定からHabitasの通知を許可してください。
                                    </div>
                                </div>
                                <button
                                    onClick={() => window.open("app-settings:", "_system")}
                                    style={{
                                        alignSelf: "flex-start",
                                        background: theme.warning,
                                        color: "#fff",
                                        border: "none",
                                        borderRadius: 8,
                                        padding: "7px 14px",
                                        fontSize: 13,
                                        fontWeight: 600,
                                        cursor: "pointer",
                                    }}
                                >
                                    iOSの設定を開く
                                </button>
                            </div>
                        )}

                        {/* 習慣リマインド */}
                        <div style={{ background: "rgba(0,0,0,0.02)", padding: 16, borderRadius: 12, ...disabledOverlay(settings.habit_remind_on) }}>
                            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
                                <Checkbox
                                    checked={settings.habit_remind_on}
                                    color={theme.habit}
                                    onChange={(e) => handleRemindToggle("habit_remind_on", e.target.checked)}
                                />
                                <div style={{ fontWeight: 600 }}>残り習慣数のリマインド（毎日）</div>
                            </div>
                            {settings.habit_remind_on && (
                                <div style={{ paddingLeft: 36, display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontSize: 14 }}>通知時間:</span>
                                    <TimePicker
                                        hour={settings.habit_remind_hour}
                                        minute={settings.habit_remind_minute ?? 0}
                                        onHourChange={(h) => setSettings({...settings, habit_remind_hour: h})}
                                        onMinuteChange={(m) => setSettings({...settings, habit_remind_minute: m})}
                                    />
                                </div>
                            )}
                        </div>

                        {/* タスクリマインド */}
                        <div style={{ background: "rgba(0,0,0,0.02)", padding: 16, borderRadius: 12, ...disabledOverlay(settings.task_remind_on) }}>
                            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
                                <Checkbox
                                    checked={settings.task_remind_on}
                                    color={theme.task}
                                    onChange={(e) => handleRemindToggle("task_remind_on", e.target.checked)}
                                />
                                <div style={{ fontWeight: 600 }}>タスクの期限前リマインド</div>
                            </div>
                            {settings.task_remind_on && (
                                <div style={{ paddingLeft: 36, display: "grid", gap: 12 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <span style={{ fontSize: 14 }}>通知時間:</span>
                                        <TimePicker
                                            hour={settings.task_remind_hour}
                                            minute={settings.task_remind_minute ?? 0}
                                            onHourChange={(h) => setSettings({...settings, task_remind_hour: h})}
                                            onMinuteChange={(m) => setSettings({...settings, task_remind_minute: m})}
                                        />
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
                        <div style={{ background: "rgba(0,0,0,0.02)", padding: 16, borderRadius: 12, ...disabledOverlay(settings.review_remind_on) }}>
                            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
                                <Checkbox
                                    checked={settings.review_remind_on}
                                    color={theme.action}
                                    onChange={(e) => handleRemindToggle("review_remind_on", e.target.checked)}
                                />
                                <div style={{ fontWeight: 600 }}>振り返り記入のリマインド（毎日）</div>
                            </div>
                            {settings.review_remind_on && (
                                <div style={{ paddingLeft: 36, display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontSize: 14 }}>通知時間:</span>
                                    <TimePicker
                                        hour={settings.review_remind_hour}
                                        minute={settings.review_remind_minute ?? 0}
                                        onHourChange={(h) => setSettings({...settings, review_remind_hour: h})}
                                        onMinuteChange={(m) => setSettings({...settings, review_remind_minute: m})}
                                    />
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
