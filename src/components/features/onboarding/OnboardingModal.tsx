import { useState } from "react";
import { theme } from "../../../lib/ui/theme";
import PrimaryBtn from "../../ui/PrimaryBtn";

type Props = {
    isOpen: boolean;
    onClose: () => void;
};

type Slide = {
    emoji: string;
    title: string;
    lines: string[];
    accent: string;
};

const SLIDES: Slide[] = [
    {
        emoji: "🌱",
        title: "Habitasへようこそ",
        lines: [
            "習慣・タスク・行動を記録して",
            "毎日の積み重ねを可視化するアプリです。",
        ],
        accent: theme.primary,
    },
    {
        emoji: "📋",
        title: "「記録」タブ — 今日を管理する",
        lines: [
            "習慣：毎日やりたいこと（タップで完了）",
            "タスク：期限付きのやること",
            "行動：運動・読書など時間を使った活動",
            "",
            "右下の ＋ ボタンから登録できます",
        ],
        accent: theme.habit,
    },
    {
        emoji: "✅",
        title: "まず「習慣」を登録しよう",
        lines: [
            "右下 ＋ → 習慣 から追加できます",
            "",
            "優先度：重要度（1〜5）",
            "ボリューム：1回あたりの時間の目安",
            "",
            "登録した習慣は毎日リセットされます",
        ],
        accent: theme.task,
    },
    {
        emoji: "📊",
        title: "「振り返り」タブ — 一日を締める",
        lines: [
            "習慣・タスクの完了状況を確認",
            "行動ログを振り返る",
            "充実度（1〜10）と一言メモを記録",
            "",
            "毎日の記録が週次レビューに集計されます",
        ],
        accent: theme.action,
    },
    {
        emoji: "🎉",
        title: "準備完了！",
        lines: [
            "まずは続けたい習慣を",
            "3つ登録してみましょう",
            "",
            "通知設定でリマインドも設定できます",
        ],
        accent: theme.primary,
    },
];

export default function OnboardingModal({ isOpen, onClose }: Props) {
    const [index, setIndex] = useState(0);

    if (!isOpen) return null;

    const slide = SLIDES[index];
    const isLast = index === SLIDES.length - 1;

    const handleNext = () => {
        if (isLast) {
            onClose();
        } else {
            setIndex(i => i + 1);
        }
    };

    const handlePrev = () => {
        if (index > 0) setIndex(i => i - 1);
    };

    return (
        <>
            <style>{`
                @keyframes ob-fadeIn {
                    from { opacity: 0; transform: scale(0.97); }
                    to   { opacity: 1; transform: scale(1); }
                }
            `}</style>

            {/* Overlay */}
            <div
                style={{
                    position: "fixed",
                    inset: 0,
                    background: "rgba(15, 23, 42, 0.6)",
                    backdropFilter: "blur(6px)",
                    WebkitBackdropFilter: "blur(6px)",
                    zIndex: 300,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "24px 16px",
                }}
            >
                {/* Card */}
                <div
                    style={{
                        width: "min(92vw, 400px)",
                        background: theme.card,
                        borderRadius: 24,
                        boxShadow: "0 24px 48px -12px rgba(0,0,0,0.25)",
                        display: "flex",
                        flexDirection: "column",
                        overflow: "hidden",
                        animation: "ob-fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
                    }}
                    key={index}
                >
                    {/* Accent bar */}
                    <div style={{ height: 5, background: slide.accent, transition: "background 0.3s" }} />

                    {/* Body */}
                    <div style={{ padding: "32px 28px 24px", textAlign: "center" }}>
                        {/* Emoji */}
                        <div style={{ fontSize: 52, lineHeight: 1, marginBottom: 16 }}>
                            {slide.emoji}
                        </div>

                        {/* Title */}
                        <div style={{
                            fontSize: 18,
                            fontWeight: 800,
                            color: theme.text,
                            marginBottom: 20,
                            lineHeight: 1.4,
                        }}>
                            {slide.title}
                        </div>

                        {/* Lines */}
                        <div style={{
                            fontSize: 14,
                            color: theme.subtext,
                            lineHeight: 1.8,
                            minHeight: 120,
                            textAlign: "left",
                        }}>
                            {slide.lines.map((line, i) =>
                                line === "" ? (
                                    <div key={i} style={{ height: 8 }} />
                                ) : (
                                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                                        <span style={{ color: slide.accent, flexShrink: 0, marginTop: 2 }}>•</span>
                                        <span>{line}</span>
                                    </div>
                                )
                            )}
                        </div>
                    </div>

                    {/* Dot indicators */}
                    <div style={{ display: "flex", justifyContent: "center", gap: 8, paddingBottom: 4 }}>
                        {SLIDES.map((_, i) => (
                            <div
                                key={i}
                                onClick={() => setIndex(i)}
                                style={{
                                    width: i === index ? 20 : 8,
                                    height: 8,
                                    borderRadius: 4,
                                    background: i === index ? slide.accent : theme.border,
                                    transition: "all 0.3s",
                                    cursor: "pointer",
                                }}
                            />
                        ))}
                    </div>

                    {/* Buttons */}
                    <div style={{ padding: "16px 28px 28px", display: "flex", flexDirection: "column", gap: 10 }}>
                        <PrimaryBtn fullWidth onClick={handleNext} style={{ background: slide.accent }}>
                            {isLast ? "はじめる" : "次へ"}
                        </PrimaryBtn>

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            {index > 0 ? (
                                <button
                                    onClick={handlePrev}
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
                            ) : <span />}

                            {!isLast && (
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
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
