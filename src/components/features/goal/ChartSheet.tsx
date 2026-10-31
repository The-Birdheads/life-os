import { useState } from "react";
import { theme } from "../../../lib/ui/theme";
import type { MandalaState } from "../../../lib/mandala/useMandala";
import PrimaryBtn from "../../ui/PrimaryBtn";
import SecondaryBtn from "../../ui/SecondaryBtn";
import TextInput from "../../ui/TextInput";
import { CloseIcon } from "../../ui/Icon";

/**
 * 大目標のシート(下から出る)。大目標と期限の編集と、新しいチャートの作成の入口。
 */
export default function ChartSheet({
    mandala,
    adHeight,
    setMsg,
    onClose,
    onNewChart,
}: {
    mandala: MandalaState;
    adHeight: number;
    setMsg: (s: string) => void;
    onClose: () => void;
    onNewChart: () => void;
}) {
    const chart = mandala.model!.chart;
    const [title, setTitle] = useState(chart.title);
    const [endDate, setEndDate] = useState(chart.end_date ?? "");
    const [busy, setBusy] = useState(false);
    const dirty = title.trim() !== chart.title || (endDate || null) !== (chart.end_date || null);

    const save = async () => {
        setBusy(true);
        try {
            await mandala.updateChart({ title: title.trim(), end_date: endDate || null });
            setMsg("大目標を保存しました");
            onClose();
        } catch (e: any) {
            setMsg(e?.message ?? "保存できませんでした");
        } finally {
            setBusy(false);
        }
    };

    const overlay: React.CSSProperties = {
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)",
        zIndex: 100, display: "flex", justifyContent: "center", alignItems: "flex-end",
    };
    const sheet: React.CSSProperties = {
        width: "100%", maxWidth: 600, boxSizing: "border-box",
        maxHeight: `calc(100dvh - max(env(safe-area-inset-top, 0px), 24px) - ${adHeight}px)`,
        background: "var(--bg)", borderTopLeftRadius: 20, borderTopRightRadius: 20,
        padding: "20px 16px calc(24px + env(safe-area-inset-bottom, 0px))", overflowY: "auto", overflowX: "hidden",
        display: "grid", gap: 14, alignContent: "start",
    };

    return (
        <div style={overlay} onClick={onClose}>
            <div role="dialog" aria-label="大目標" style={sheet} onClick={(e) => e.stopPropagation()}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>大目標</span>
                    <button type="button" aria-label="閉じる" onClick={onClose}
                        style={{ width: 44, height: 44, borderRadius: 22, border: "none", background: "rgba(0,0,0,0.05)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text)" }}>
                        <CloseIcon size={18} />
                    </button>
                </div>

                <label style={{ display: "grid", gap: 6, fontSize: 14 }}>
                    大目標
                    <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例: 健康的な体をつくる" fullWidth />
                </label>
                <label style={{ display: "grid", gap: 6, fontSize: 14 }}>
                    いつまでに（任意）
                    <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <TextInput type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} fullWidth />
                        {endDate && (
                            <SecondaryBtn style={{ whiteSpace: "nowrap", flexShrink: 0 }} onClick={() => setEndDate("")}>期限なし</SecondaryBtn>
                        )}
                    </span>
                </label>
                {dirty && <PrimaryBtn fullWidth disabled={busy || !title.trim()} onClick={save}>保存</PrimaryBtn>}

                <div style={{ display: "grid", gap: 8, marginTop: 8, paddingTop: 16, borderTop: `1px solid ${theme.border}` }}>
                    <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: theme.subtext }}>新しいチャート</h3>
                    <p style={{ margin: 0, fontSize: 12, lineHeight: 1.7, color: theme.subtext }}>
                        今のチャートを終えて、新しい大目標でチャートを作ります。習慣・タスクと記録はそのまま残り、行動目標とのひもづけだけ外れます。
                    </p>
                    <SecondaryBtn fullWidth disabled={busy} onClick={onNewChart}>新しいチャートを作る</SecondaryBtn>
                </div>
            </div>
        </div>
    );
}
