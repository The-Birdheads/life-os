import { theme } from "../../../lib/ui/theme";
import { useUserSettings } from "../../../lib/context/UserSettingsContext";
import { formatVolumeLabel } from "../../../lib/formatVolume";
import Slider from "../../ui/Slider";

/**
 * 優先度とボリューム(どちらも任意)。0 は「未設定」。
 * スライダーを左端まで動かすか「クリア」で未設定に戻せる。
 */
export default function LevelFields({
    priority, volume, onPriority, onVolume, tutorial = false,
}: {
    priority: number;
    volume: number;
    onPriority: (v: number) => void;
    onVolume: (v: number) => void;
    /** 習慣の追加フォームだけ、チュートリアルの吹き出しの位置にする */
    tutorial?: boolean;
}) {
    const { volumeUnit } = useUserSettings();
    const volumeText = volume > 0
        ? `${volume}${volumeUnit !== "none" ? ` (${formatVolumeLabel(volume, volumeUnit)})` : ""}`
        : "未設定";

    const row = (label: string, value: string, set: boolean, clear: () => void) => (
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span>{label}<span style={{ fontSize: 12, color: theme.subtext }}>（任意）</span>: <b style={{ color: set ? "var(--text)" : theme.subtext }}>{value}</b></span>
            {set && (
                <button type="button" onClick={clear}
                    style={{ marginLeft: "auto", background: "none", border: "none", color: theme.subtext, fontSize: 12, cursor: "pointer", padding: "4px 0" }}>
                    クリア
                </button>
            )}
        </span>
    );

    return (
        <>
            <label data-tutorial={tutorial ? "habit-priority" : undefined}>
                {row("優先度", priority > 0 ? String(priority) : "未設定", priority > 0, () => onPriority(0))}
                <Slider min="0" max="5" step="1" value={priority} onChange={(e) => onPriority(Number(e.target.value))} fullWidth />
            </label>
            <label data-tutorial={tutorial ? "habit-volume" : undefined}>
                {row("ボリューム", volumeText, volume > 0, () => onVolume(0))}
                <Slider min="0" max="10" step="1" value={volume} onChange={(e) => onVolume(Number(e.target.value))} fullWidth />
            </label>
        </>
    );
}
