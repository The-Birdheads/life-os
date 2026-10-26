import { useState, useEffect } from "react";
import { theme } from "../../../lib/ui/theme";
import PrimaryBtn from "../../ui/PrimaryBtn";
import type { Tab } from "../../../lib/tabs";

// ─── Step 定義 ──────────────────────────────────────────────────────────────

type Step = {
    targets: string[];         // 複数指定時は同じ吹き出しのままスポットが移動する
    title: string;
    body: string[];
    tooltipSide: "top" | "bottom";
    tooltipSides?: ("top" | "bottom")[];  // サブステップごとに上書きする場合に使用
    padding?: number;
    accentColor?: string;
};

const STEPS: Step[] = [
    {
        targets: ["fab"],
        title: "習慣・タスク・行動を登録",
        body: [
            "右下の ＋ ボタンから",
            "続けたい習慣やタスクを追加できます。",
            "まずは習慣を3つ登録してみましょう。",
        ],
        tooltipSide: "top",
        padding: 14,
        accentColor: theme.primary,
    },
    {
        targets: ["bottom-tabs"],
        title: "タブで画面を切り替え",
        body: [
            "記録 → 今日の習慣・タスクを管理",
            "振り返り → 充実度とメモを記録",
            "週 → 1週間の達成状況を確認",
        ],
        tooltipSide: "top",
        padding: 10,
        accentColor: theme.habit,
    },
    {
        // 同じ吹き出しのまま tab-review → review-content とスポットが移動する
        targets: ["tab-review", "review-content"],
        title: "1日の締めくくりに",
        body: [
            "夜は「振り返り」タブを開いて",
            "今日の充実度（1〜100）と",
            "一言メモを残しましょう。",
        ],
        tooltipSide: "top",
        tooltipSides: ["top", "bottom"], // tab-review は上、review-content は下
        padding: 14,
        accentColor: theme.action,
    },
    {
        targets: ["hamburger"],
        title: "通知・設定はここから",
        body: [
            "習慣ごとのリマインドや通知時間の設定、",
            "各種アカウントのログインは",
            "右上のメニューから変更できます。",
        ],
        tooltipSide: "bottom",
        padding: 14,
        accentColor: theme.task,
    },
];

// ─── ユーティリティ ──────────────────────────────────────────────────────────

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

// ─── Component ──────────────────────────────────────────────────────────────

type Props = {
    isOpen: boolean;
    onClose: () => void;
    onSetTab?: (tab: Tab) => void;
};

export default function SpotlightTutorial({ isOpen, onClose, onSetTab }: Props) {
    const [stepIndex, setStepIndex] = useState(0);
    const [subIndex, setSubIndex] = useState(0);
    const [spotRect, setSpotRect] = useState<SpotRect | null>(null);
    const [vw, setVw] = useState(window.innerWidth);
    const [vh, setVh] = useState(window.innerHeight);
    const [opacity, setOpacity] = useState(0);

    const step = STEPS[stepIndex];
    const isLastStep = stepIndex === STEPS.length - 1;
    const isLastSub = subIndex === step.targets.length - 1;
    const isVeryLast = isLastStep && isLastSub;
    const accent = step.accentColor ?? theme.primary;
    const currentTooltipSide = step.tooltipSides?.[subIndex] ?? step.tooltipSide;

    // タブ切り替えが必要なステップ
    useEffect(() => {
        if (!isOpen) return;
        if (stepIndex === 0) onSetTab?.("today");
        if (stepIndex === 2 && subIndex === 0) onSetTab?.("review");
        if (stepIndex === 3) onSetTab?.("today");
    }, [isOpen, stepIndex, subIndex]);

    // ステップ／サブステップ変化時に要素を計測してフェードイン
    useEffect(() => {
        if (!isOpen) {
            setOpacity(0);
            return;
        }
        setOpacity(0);
        const timer = setTimeout(() => {
            const s = STEPS[stepIndex];
            const pad = s.padding ?? 12;
            const target = s.targets[subIndex];
            setSpotRect(measureTarget(target, pad));
            setVw(window.innerWidth);
            setVh(window.innerHeight);
            setOpacity(1);
        }, 100);
        return () => clearTimeout(timer);
    }, [isOpen, stepIndex, subIndex]);

    // リサイズ時に再計測
    useEffect(() => {
        if (!isOpen) return;
        const onResize = () => {
            const s = STEPS[stepIndex];
            const pad = s.padding ?? 12;
            const target = s.targets[subIndex];
            setSpotRect(measureTarget(target, pad));
            setVw(window.innerWidth);
            setVh(window.innerHeight);
        };
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, [isOpen, stepIndex, subIndex]);

    // 開閉時にリセット
    useEffect(() => {
        if (!isOpen) {
            setStepIndex(0);
            setSubIndex(0);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    // SVG パス: 全体矩形 - スポットライト穴 (evenodd)
    const outerPath = `M 0 0 H ${vw} V ${vh} H 0 Z`;
    const svgPath = spotRect
        ? `${outerPath} ${makeRoundedRectPath(spotRect.x, spotRect.y, spotRect.w, spotRect.h, 12)}`
        : outerPath;

    // ツールチップ位置
    const TOOLTIP_GAP = 16;
    const TOOLTIP_W = Math.min(vw - 32, 320);

    const tooltipStyle: React.CSSProperties = (() => {
        const base: React.CSSProperties = {
            position: "fixed",
            width: TOOLTIP_W,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 502,
            opacity,
            transition: "opacity 0.25s",
        };
        if (!spotRect) return { ...base, top: "50%", transform: "translate(-50%,-50%)" };
        if (currentTooltipSide === "top") {
            return { ...base, bottom: vh - spotRect.y + TOOLTIP_GAP };
        }
        return { ...base, top: spotRect.y + spotRect.h + TOOLTIP_GAP };
    })();

    const handleNext = () => {
        if (isVeryLast) {
            onClose();
            return;
        }
        if (!isLastSub) {
            // 同じメインステップ内でサブターゲットを進める
            setSubIndex(i => i + 1);
        } else {
            setSubIndex(0);
            setStepIndex(i => i + 1);
        }
    };

    return (
        <>
            {/* タッチブロッカー（下層UIへの誤操作防止） */}
            <div style={{ position: "fixed", inset: 0, zIndex: 499, pointerEvents: "auto" }} />

            {/* 暗いオーバーレイ + スポットライト穴 (SVG evenodd) */}
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
                    {/* アクセントバー */}
                    <div style={{ height: 4, background: accent }} />

                    <div style={{ padding: "18px 20px 20px" }}>
                        {/* ドットインジケーター（メインステップ数） */}
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

                        {/* タイトル */}
                        <div style={{
                            fontSize: 15,
                            fontWeight: 800,
                            color: theme.text,
                            marginBottom: 10,
                            lineHeight: 1.4,
                        }}>
                            {step.title}
                        </div>

                        {/* 本文 */}
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

                        {/* ボタン行 */}
                        <div style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                        }}>
                            {stepIndex > 0 || subIndex > 0 ? (
                                <button
                                    onClick={() => {
                                        if (subIndex > 0) {
                                            setSubIndex(i => i - 1);
                                        } else {
                                            const prevStep = STEPS[stepIndex - 1];
                                            setSubIndex(prevStep.targets.length - 1);
                                            setStepIndex(i => i - 1);
                                        }
                                    }}
                                    style={{
                                        background: "none",
                                        border: "none",
                                        color: theme.subtext,
                                        fontSize: 13,
                                        cursor: "pointer",
                                        padding: "4px 0",
                                    }}
                                >
                                    ← 戻る
                                </button>
                            ) : (
                                <button
                                    onClick={onClose}
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
                            )}

                            <PrimaryBtn
                                onClick={handleNext}
                                style={{ background: accent }}
                            >
                                {isVeryLast ? "はじめる" : "次へ"}
                            </PrimaryBtn>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
