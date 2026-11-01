import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { theme } from "../../../lib/ui/theme";
import PrimaryBtn from "../../ui/PrimaryBtn";
import { CalendarIcon, GridIcon, PencilIcon, SearchIcon, ShieldIcon, CheckIcon, RepeatIcon, TargetIcon, ChevronRightIcon } from "../../ui/Icon";
import type { Story } from "./guideTypes";
import { STORIES } from "./stories";

/** 紹介を閉じたあとの動き: 選んだストーリーの案内を始める / そのまま閉じる */
export type IntroAction = Story | "dismiss";

type Slide = {
    id: string;
    color: string;
    icon: ReactNode;
    /** アイコンの下に並べる、その画面でできることの目印 */
    chips: { icon: ReactNode; label: string }[];
    title: string;
    body: string;
};

const SLIDES: Slide[] = [
    {
        id: "welcome",
        color: "#1D4ED8",
        icon: <TargetIcon size={44} />,
        chips: [
            { icon: <TargetIcon size={14} />, label: "目標" },
            { icon: <PencilIcon size={14} />, label: "記録" },
            { icon: <SearchIcon size={14} />, label: "振り返り" },
            { icon: <CalendarIcon size={14} />, label: "推移" },
        ],
        title: "Habitas へようこそ",
        body: "大きな目標を立てて、毎日の習慣・タスクで少しずつ進める。記録して、振り返って、また次へ。そのくり返しを、ひとつのアプリで続けられます。",
    },
    {
        id: "goal",
        color: "#1D4ED8",
        icon: <GridIcon size={44} />,
        chips: [
            { icon: <TargetIcon size={14} />, label: "大目標" },
            { icon: <GridIcon size={14} />, label: "8つの要素" },
            { icon: <CheckIcon size={14} />, label: "行動目標" },
        ],
        title: "目標：マンダラチャートで分ける",
        body: "大目標を 8 つの要素と、具体的な行動目標に分けます。行動目標に習慣やタスクをひもづけると、直近 7 日の進み具合が色でわかります。",
    },
    {
        id: "record",
        color: theme.habit,
        icon: <PencilIcon size={44} />,
        chips: [
            { icon: <RepeatIcon size={14} />, label: "習慣" },
            { icon: <CheckIcon size={14} />, label: "タスク" },
            { icon: <ShieldIcon size={14} />, label: "マイルール" },
        ],
        title: "記録：毎日ワンタップで",
        body: "続けたい習慣、期限のあるタスク、守りたいマイルールを、記録タブでつけていきます。登録は右下の ＋ からできます。",
    },
    {
        id: "review",
        color: theme.task,
        icon: <SearchIcon size={44} />,
        chips: [
            { icon: <CheckIcon size={14} />, label: "できたこと" },
            { icon: <TargetIcon size={14} />, label: "目標の進み" },
        ],
        title: "振り返り：その日の成果を確かめる",
        body: "その日にできたことと、進んだ行動目標を確かめます。チャートはときどき見直して、自分に合うやり方に育てていきましょう。",
    },
    {
        id: "trend",
        color: theme.rule,
        icon: <CalendarIcon size={44} />,
        chips: [
            { icon: <CalendarIcon size={14} />, label: "週・月" },
            { icon: <RepeatIcon size={14} />, label: "習慣の記録" },
        ],
        title: "推移：週・月で見返す",
        body: "週・月ごとに、習慣とマイルールの記録や、記録していない日を確かめられます。通知や設定は、右上の ≡ から変えられます。",
    },
];

// スライドの枚数 + 最後の「始める」画面
const STEP_COUNT = SLIDES.length + 1;

/**
 * アプリの紹介(初回と、メニューの「使い方を見る」から)。数枚のスライドで特徴を紹介し、最後に
 * やりたいこと(ストーリー)を選んでもらう。どのスライドでもスキップできる。
 * 開くたびに最初のスライドから始まる。
 */
export default function IntroSlides({
    isOpen,
    adHeight = 0,
    onClose,
}: {
    isOpen: boolean;
    /** 画面上部のバナー広告の高さ(広告はアプリの画面より手前に出るので、その分下げる) */
    adHeight?: number;
    onClose: (action: IntroAction) => void;
}) {
    const [step, setStep] = useState(0);

    useEffect(() => {
        if (isOpen) setStep(0);
    }, [isOpen]);

    if (!isOpen) return null;

    const isLast = step === STEP_COUNT - 1;
    const slide = isLast ? null : SLIDES[step];
    const accent = slide?.color ?? "#1D4ED8";

    return (
        <div role="dialog" aria-modal="true" aria-label="Habitas の紹介"
            style={{
                position: "fixed", inset: 0, zIndex: 600, background: "var(--bg)", color: "var(--text)",
                display: "flex", flexDirection: "column", boxSizing: "border-box",
                padding: `calc(max(env(safe-area-inset-top, 0px), 16px) + ${adHeight}px) 24px calc(env(safe-area-inset-bottom, 0px) + 16px)`,
            }}>
            <div style={{ height: 44, display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
                {!isLast && (
                    <button type="button" onClick={() => onClose("dismiss")} style={textBtn}>スキップ</button>
                )}
            </div>

            <div key={step} style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: isLast ? "flex-start" : "center", gap: 16, textAlign: "center", animation: "intro-in 0.3s ease-out" }}>
                <style>{"@keyframes intro-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }"}</style>
                {slide && (
                    <div style={{ width: 104, height: 104, borderRadius: 52, background: `${accent}1F`, color: accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {slide.icon}
                    </div>
                )}
                {slide && (
                    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 6 }}>
                        {slide.chips.map((c) => (
                            <span key={c.label} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700, color: accent, background: theme.card, border: `1px solid ${accent}55`, borderRadius: 999, padding: "4px 10px" }}>
                                {c.icon}{c.label}
                            </span>
                        ))}
                    </div>
                )}
                <h1 style={{ margin: 0, fontSize: 22, lineHeight: 1.4 }}>{slide ? slide.title : "Habitas で何をしたいですか？"}</h1>
                <p style={{ margin: 0, fontSize: slide ? 15 : 14, lineHeight: 1.8, color: theme.subtext, maxWidth: 420 }}>
                    {slide
                        ? slide.body
                        : "選んだ内容に沿って、実際に操作しながら使い方を案内します。あとからメニューの「使い方を見る」で選び直せます。"}
                </p>
                {isLast && (
                    <div style={{ display: "grid", gap: 10, width: "100%", maxWidth: 420 }}>
                        {STORIES.map((s) => (
                            <button key={s.id} type="button" onClick={() => onClose(s.id)}
                                style={{
                                    display: "flex", alignItems: "center", gap: 12, minHeight: 64, padding: "10px 12px", textAlign: "left",
                                    background: theme.card, border: `1px solid ${theme.border}`, borderLeft: `4px solid ${s.color}`, borderRadius: 14,
                                    color: "var(--text)", cursor: "pointer", fontFamily: "inherit",
                                }}>
                                <span style={{ width: 40, height: 40, borderRadius: 20, flexShrink: 0, background: `${s.color}1F`, color: s.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    {s.icon}
                                </span>
                                <span style={{ display: "grid", gap: 2, flex: 1, minWidth: 0 }}>
                                    <span style={{ fontSize: 15, fontWeight: 700 }}>{s.title}</span>
                                    <span style={{ fontSize: 12, color: theme.subtext, lineHeight: 1.5 }}>{s.sub}</span>
                                </span>
                                <ChevronRightIcon size={18} color={theme.subtext} />
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div style={{ display: "flex", justifyContent: "center", gap: 8, margin: "16px 0 20px" }}>
                {Array.from({ length: STEP_COUNT }, (_, i) => (
                    <span key={i} style={{ width: i === step ? 20 : 8, height: 8, borderRadius: 4, background: i === step ? accent : theme.border, transition: "all 0.3s" }} />
                ))}
            </div>

            {isLast ? (
                <div style={{ display: "flex", justifyContent: "space-between", width: "100%", maxWidth: 420, margin: "0 auto" }}>
                    <button type="button" onClick={() => setStep(step - 1)} style={textBtn}>戻る</button>
                    <button type="button" onClick={() => onClose("dismiss")} style={textBtn}>スキップして使い始める</button>
                </div>
            ) : (
                <div style={{ display: "grid", gap: 10, width: "100%", maxWidth: 420, margin: "0 auto" }}>
                    <PrimaryBtn fullWidth onClick={() => setStep(step + 1)} style={{ minHeight: 52, background: accent }}>次へ</PrimaryBtn>
                    <div style={{ display: "flex", justifyContent: "flex-start", minHeight: 44 }}>
                        {step > 0 && <button type="button" onClick={() => setStep(step - 1)} style={textBtn}>戻る</button>}
                    </div>
                </div>
            )}
        </div>
    );
}

const textBtn: React.CSSProperties = {
    minHeight: 44, border: "none", background: "none", color: theme.subtext, fontSize: 15, cursor: "pointer", padding: "0 4px", fontFamily: "inherit",
};
