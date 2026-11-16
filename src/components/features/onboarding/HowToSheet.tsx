import { theme } from "../../../lib/ui/theme";
import { ChevronRightIcon, CloseIcon } from "../../ui/Icon";
import { HOWTO_GROUPS } from "./howtos";

/**
 * やりたいことから探す使い方の一覧(メニューの「使い方を見る」から)。
 * 選ぶと閉じて、その使い方の案内を始める。
 */
export default function HowToSheet({
    isOpen, adHeight = 0, onClose, onPick,
}: {
    isOpen: boolean;
    adHeight?: number;
    onClose: () => void;
    onPick: (id: string) => void;
}) {
    if (!isOpen) return null;

    return (
        <div onClick={onClose}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", zIndex: 100, display: "flex", justifyContent: "center", alignItems: "flex-end" }}>
            <div role="dialog" aria-label="やりたいことから探す" onClick={(e) => e.stopPropagation()}
                style={{
                    width: "100%", maxWidth: 600, boxSizing: "border-box", display: "flex", flexDirection: "column",
                    height: `calc(100dvh - max(env(safe-area-inset-top, 0px), 24px) - ${adHeight}px)`,
                    background: "var(--bg)", borderTopLeftRadius: 20, borderTopRightRadius: 20,
                    boxShadow: "0 -4px 20px rgba(0,0,0,0.15)", animation: "howto-up 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.2)",
                }}>
                <style>{"@keyframes howto-up { from { transform: translateY(100%); opacity: 0; } to { transform: none; opacity: 1; } }"}</style>
                <div style={{ position: "relative", padding: "24px 16px 8px", flexShrink: 0 }}>
                    <button type="button" aria-label="閉じる" onClick={onClose}
                        style={{ position: "absolute", top: 16, right: 16, width: 44, height: 44, borderRadius: 22, border: "none", background: "rgba(0,0,0,0.05)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text)" }}>
                        <CloseIcon size={18} />
                    </button>
                    <h2 style={{ margin: 0, fontSize: 20 }}>やりたいことから探す</h2>
                    <p style={{ margin: "6px 56px 0 0", fontSize: 13, lineHeight: 1.6, color: theme.subtext }}>
                        選ぶと、その画面を開いて、操作する場所を案内します。
                    </p>
                </div>

                <div style={{ padding: "8px 16px calc(24px + env(safe-area-inset-bottom, 0px))", overflowY: "auto", flex: 1, display: "grid", gap: 18, alignContent: "start" }}>
                    {HOWTO_GROUPS.map((g) => (
                        <section key={g.title} style={{ display: "grid", gap: 8 }}>
                            <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 6, fontSize: 14, color: g.color }}>
                                {g.icon}{g.title}
                            </h3>
                            <div style={{ display: "grid", background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 14, overflow: "hidden" }}>
                                {g.items.map((h, i) => (
                                    <button key={h.id} type="button" onClick={() => onPick(h.id)}
                                        style={{
                                            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, minHeight: 48, padding: "10px 14px",
                                            border: "none", borderTop: i ? `1px solid ${theme.border}` : "none", background: "none",
                                            color: "var(--text)", fontSize: 15, textAlign: "left", cursor: "pointer", fontFamily: "inherit",
                                        }}>
                                        {h.title}
                                        <ChevronRightIcon size={16} color={theme.subtext} />
                                    </button>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            </div>
        </div>
    );
}
