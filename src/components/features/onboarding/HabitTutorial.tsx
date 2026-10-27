import { useState, useEffect } from "react";
import type { CSSProperties } from "react";
import { theme } from "../../../lib/ui/theme";
import PrimaryBtn from "../../ui/PrimaryBtn";

export type HabitTutorialCallbacks = {
    closeFABMenu: () => void;
    openHabitModal: () => void;
};

type Step = {
    target: string;
    title: string;
    body: string[];
    tooltipSide: "top" | "bottom";
    padding: number;
    accentColor: string;
};

const STEPS: Step[] = [
    {
        target: "fab-menu-habit",
        title: "まずは習慣を登録してみましょう",
        body: ["「習慣の登録」をタップすると", "習慣の追加画面が開きます"],
        tooltipSide: "top",
        padding: 8,
        accentColor: theme.habit,
    },
    {
        target: "habit-modal-add-btn",
        title: "新しい習慣を追加",
        body: [
            "「新しい習慣を追加」ボタンをタップして",
            "習慣を追加します",
        ],
        tooltipSide: "top",
        padding: 8,
        accentColor: theme.habit,
    },
    {
        target: "habit-title-input",
        title: "まずは習慣のタイトルを入力します",
        body: [
            "続けたい習慣の名前を入力してください",
            "（例：毎朝ランニング、読書 など）",
        ],
        tooltipSide: "top",
        padding: 8,
        accentColor: theme.habit,
    },
    {
        target: "habit-memo",
        title: "メモ",
        body: [
            "任意でメモを追加できます",
            "追加したメモは一覧表示でも確認できます",
        ],
        tooltipSide: "top",
        padding: 8,
        accentColor: theme.habit,
    },
    {
        target: "habit-priority",
        title: "優先度（任意）",
        body: [
            "必要なら、習慣の優先度を設定できます（1〜5）",
            "一覧表示で優先度が高い順に上から表示されます",
        ],
        tooltipSide: "top",
        padding: 8,
        accentColor: theme.habit,
    },
    {
        target: "habit-volume",
        title: "ボリューム（任意）",
        body: [
            "必要なら、かかる時間の目安を設定できます",
            "1目もりあたり30分で、メニューのユーザ設定から変更できます",
        ],
        tooltipSide: "top",
        padding: 8,
        accentColor: theme.habit,
    },
    {
        target: "habit-remind",
        title: "リマインド通知",
        body: ["オンにすると、設定した時刻に通知が来るようになります"],
        tooltipSide: "top",
        padding: 8,
        accentColor: theme.habit,
    },
];

type SpotRect = { x: number; y: number; w: number; h: number };

function makeRoundedRectPath(x: number, y: number, w: number, h: number, r: number): string {
    return [
        `M ${x + r} ${y}`,
        `H ${x + w - r}`,
        `Q ${x + w} ${y} ${x + w} ${y + r}`,
        `V ${y + h - r}`,
        `Q ${x + w} ${y + h} ${x + w - r} ${y + h}`,
        `H ${x + r}`,
        `Q ${x} ${y + h} ${x} ${y + h - r}`,
        `V ${y + r}`,
        `Q ${x} ${y} ${x + r} ${y} Z`,
    ].join(" ");
}

function measureTarget(target: string, padding: number): SpotRect | null {
    const el = document.querySelector(`[data-tutorial="${target}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
        x: r.left - padding,
        y: r.top - padding,
        w: r.width + padding * 2,
        h: r.height + padding * 2,
    };
}

type Props = {
    isOpen: boolean;
    onClose: () => void;
    callbacks: HabitTutorialCallbacks;
};

export default function HabitTutorial({ isOpen, onClose, callbacks }: Props) {
    const [stepIndex, setStepIndex] = useState(0);
    const [spotRect, setSpotRect] = useState<SpotRect | null>(null);
    const [vw, setVw] = useState(window.innerWidth);
    const [vh, setVh] = useState(window.innerHeight);
    const [opacity, setOpacity] = useState(0);
    const [transitioning, setTransitioning] = useState(false);

    const step = STEPS[stepIndex];
    const isLast = stepIndex === STEPS.length - 1;
    const accent = step.accentColor;

    const remeasure = (idx: number) => {
        const s = STEPS[idx];
        setSpotRect(measureTarget(s.target, s.padding));
        setVw(window.innerWidth);
        setVh(window.innerHeight);
        setOpacity(1);
    };

    // ステップ変化時に位置を計測してフェードイン
    useEffect(() => {
        if (!isOpen) { setOpacity(0); return; }
        setOpacity(0);
        const t = setTimeout(() => remeasure(stepIndex), 100);
        return () => clearTimeout(t);
    }, [isOpen, stepIndex]);

    // リサイズ時に再計測
    useEffect(() => {
        if (!isOpen) return;
        const onResize = () => remeasure(stepIndex);
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, [isOpen, stepIndex]);

    // 閉じるときにリセット
    useEffect(() => {
        if (!isOpen) setStepIndex(0);
    }, [isOpen]);

    const handleNext = () => {
        if (isLast) { onClose(); return; }

        setTransitioning(true);
        setOpacity(0);

        const next = stepIndex + 1;

        if (stepIndex === 0) {
            // Step 0→1: モーダルを即座に開始（アニメーション開始タイミングを早める）
            // → アニメーション(300ms)完了を待ってからステップ移動
            callbacks.closeFABMenu();
            callbacks.openHabitModal();
            setTimeout(() => {
                setStepIndex(next);
                setTransitioning(false);
            }, 380);
        } else if (stepIndex === 1) {
            // Step 1→2: 「新しい習慣を追加」ボタンを即座にクリックしてフォームを開く
            const addBtn = document.querySelector('[data-tutorial="habit-modal-add-btn"]');
            if (addBtn) (addBtn as HTMLButtonElement).click();
            setTimeout(() => {
                setStepIndex(next);
                setTransitioning(false);
            }, 250);
        } else {
            setTimeout(() => {
                setStepIndex(next);
                setTransitioning(false);
            }, 200);
        }
    };

    const handleClose = () => {
        // Step 0 でスキップした場合はFABメニューを閉じる
        if (stepIndex === 0) callbacks.closeFABMenu();
        onClose();
    };

    if (!isOpen) return null;

    const outerPath = `M 0 0 H ${vw} V ${vh} H 0 Z`;
    const svgPath = spotRect
        ? `${outerPath} ${makeRoundedRectPath(spotRect.x, spotRect.y, spotRect.w, spotRect.h, 12)}`
        : outerPath;

    const TOOLTIP_GAP = 16;
    const TOOLTIP_W = Math.min(vw - 32, 320);

    const tooltipStyle: CSSProperties = (() => {
        const base: CSSProperties = {
            position: "fixed",
            width: TOOLTIP_W,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 502,
            opacity,
            transition: "opacity 0.25s",
        };
        if (!spotRect) return { ...base, top: "50%", transform: "translate(-50%,-50%)" };
        if (step.tooltipSide === "top") {
            return { ...base, bottom: vh - spotRect.y + TOOLTIP_GAP };
        }
        return { ...base, top: spotRect.y + spotRect.h + TOOLTIP_GAP };
    })();

    return (
        <>
            {/* タッチブロッカー */}
            <div style={{ position: "fixed", inset: 0, zIndex: 499, pointerEvents: "auto" }} />

            {/* 暗いオーバーレイ + スポットライト穴（evenodd） */}
            <svg
                style={{
                    position: "fixed",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    zIndex: 500,
                    pointerEvents: "none",
                    opacity,
                    transition: "opacity 0.25s",
                }}
            >
                <path d={svgPath} fill="rgba(15,23,42,0.82)" fillRule="evenodd" />
            </svg>

            {/* スポットライト枠線 */}
            {spotRect && (
                <div
                    style={{
                        position: "fixed",
                        left: spotRect.x,
                        top: spotRect.y,
                        width: spotRect.w,
                        height: spotRect.h,
                        borderRadius: 12,
                        border: `2px solid ${accent}`,
                        boxShadow: `0 0 0 3px ${accent}30`,
                        zIndex: 501,
                        pointerEvents: "none",
                        opacity,
                        transition: "opacity 0.25s",
                    }}
                />
            )}

            {/* ツールチップカード */}
            <div style={tooltipStyle}>
                <div style={{
                    background: theme.card,
                    borderRadius: 16,
                    overflow: "hidden",
                    boxShadow: "0 12px 40px rgba(0,0,0,0.4)",
                }}>
                    <div style={{ height: 4, background: accent }} />

                    <div style={{ padding: "18px 20px 20px" }}>
                        {/* ドットインジケーター */}
                        <div style={{ display: "flex", gap: 5, marginBottom: 14 }}>
                            {STEPS.map((_, i) => (
                                <div
                                    key={i}
                                    style={{
                                        width: i === stepIndex ? 18 : 6,
                                        height: 6,
                                        borderRadius: 3,
                                        background: i === stepIndex ? accent : theme.border,
                                        transition: "all 0.3s",
                                    }}
                                />
                            ))}
                        </div>

                        <div style={{
                            fontSize: 15,
                            fontWeight: 800,
                            color: theme.text,
                            marginBottom: 10,
                            lineHeight: 1.4,
                        }}>
                            {step.title}
                        </div>

                        <div style={{
                            fontSize: 13,
                            color: theme.subtext,
                            lineHeight: 1.75,
                            marginBottom: 18,
                        }}>
                            {step.body.map((line, i) => (
                                <div key={i}>{line}</div>
                            ))}
                        </div>

                        <div style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                        }}>
                            <button
                                onClick={handleClose}
                                style={{
                                    background: "none",
                                    border: "none",
                                    color: theme.subtext,
                                    fontSize: 13,
                                    cursor: "pointer",
                                    padding: "4px 0",
                                }}
                            >
                                スキップ
                            </button>

                            <PrimaryBtn
                                onClick={transitioning ? undefined : handleNext}
                                style={{ background: accent, opacity: transitioning ? 0.6 : 1 }}
                            >
                                {isLast ? "はじめる" : "次へ"}
                            </PrimaryBtn>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
