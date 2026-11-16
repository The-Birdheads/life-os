import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { theme } from "../../../lib/ui/theme";
import type { Tab } from "../../../lib/tabs";
import PrimaryBtn from "../../ui/PrimaryBtn";
import { findTarget, type GuideStep } from "./guideTypes";
import { makeRoundedRectPath, measureTarget, placeTooltip, rectOf, tooltipInsets, type Insets, type SpotRect } from "./spotlight";

/** 照らす場所が見つからないまま、この時間がたったら「次へ」を出す(その日に予定のない習慣など) */
const MISSING_MS = 3000;

/**
 * 使い方の案内を、ステップの順に出す。
 * explain は読んで「次へ」、do は照らした場所の操作、hint は上の小さな案内を出したまま操作を待つ。
 * 照らす場所は 0.25 秒ごとに測りなおす(モーダルの開閉・スクロール・キーボードで動くため)。
 * 案内を始めるたびに作り直す(key を変える)前提で、最初のステップから始まる。
 */
export default function Guide({
    steps, onClose, onSetTab, adHeight = 0, finishLabel = "はじめる",
}: {
    steps: GuideStep[];
    /** 最後のステップのボタン */
    finishLabel?: string;
    /** finished: 最後まで進んだ(スキップは false) */
    onClose: (finished: boolean) => void;
    onSetTab: (tab: Tab) => void;
    /** 画面上部のバナー広告の高さ(吹き出しを重ねない) */
    adHeight?: number;
}) {
    const [index, setIndex] = useState(0);
    const [spot, setSpot] = useState<SpotRect | null>(null);
    const [tooltipTop, setTooltipTop] = useState(0);
    const [insets, setInsets] = useState<Insets>({ top: 0, bottom: 0 });
    const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight });
    const [shown, setShown] = useState(false);
    const [missing, setMissing] = useState(false);
    // キーボードが出ると、画面全体が上にずれる(iOS)。上の案内は、そのぶん下げて広告の下に保つ
    const [keyboardShift, setKeyboardShift] = useState(0);
    const cardRef = useRef<HTMLDivElement>(null);
    const closeRef = useRef(onClose);
    closeRef.current = onClose;
    // 広告の高さが変わっても、ステップをやり直さない(入るときの処理を繰り返さないため)
    const adRef = useRef(adHeight);
    adRef.current = adHeight;

    const step: GuideStep | undefined = steps[index];
    const isLast = index === steps.length - 1;
    const accent = step?.accent ?? theme.primary;

    const next = () => {
        if (index >= steps.length - 1) closeRef.current(true);
        else setIndex(index + 1);
    };
    const nextRef = useRef(next);
    nextRef.current = next;

    // ステップに入ったら: タブを切り替え、入るときの処理をして、照らす場所が出てくるのを待つ
    useEffect(() => {
        if (!step) return;
        if (step.tab) onSetTab(step.tab);
        step.enter?.();
        setShown(false);
        setSpot(null);
        setMissing(false);

        const nextInsets = tooltipInsets(adRef.current);
        setInsets(nextInsets);
        const startedAt = Date.now();
        const padding = step.padding ?? 8;
        let found = false;
        let advanced = false;

        const place = (rect: SpotRect | null) => {
            setSpot((prev) => (sameRect(prev, rect) ? prev : rect));
            setTooltipTop(placeTooltip(rect, step.side ?? "bottom", cardRef.current?.offsetHeight ?? 0, window.innerHeight, nextInsets));
            setViewport({ w: window.innerWidth, h: window.innerHeight });
        };

        const tick = () => {
            if (step.until?.()) {
                if (!advanced) { advanced = true; nextRef.current(); }
                return;
            }
            if (step.kind === "hint") {
                publishHintSpace(cardRef.current, adRef.current);
                setShown(true);
                return;
            }
            const name = typeof step.target === "function" ? step.target() : step.target;
            const el = name ? findTarget(name) : null;
            if (el && name) {
                // 初めて見つけたときだけ、見える位置まで動かす(そのあとは利用者のスクロールに任せる)
                place(found ? rectOf(el, padding) : measureTarget(name, padding, nextInsets));
                found = true;
                setMissing(false);
                setShown(true);
            } else if (!name || Date.now() - startedAt > MISSING_MS) {
                // 照らす場所が無いまま時間がたったら、操作を待たずに「次へ」で進めるようにする
                place(null);
                setMissing(Date.now() - startedAt > MISSING_MS);
                setShown(true);
            } else if (found) {
                place(null);
            }
        };

        const first = window.setTimeout(tick, 200);
        const timer = window.setInterval(tick, 250);
        return () => {
            window.clearTimeout(first);
            window.clearInterval(timer);
            // 上の案内のぶん空けていた余白を戻す
            publishHintSpace(null, 0);
        };
    }, [index]);

    useEffect(() => {
        const vv = window.visualViewport;
        if (!vv) return;
        const update = () => setKeyboardShift(Math.max(0, Math.round(vv.offsetTop)));
        vv.addEventListener("resize", update);
        vv.addEventListener("scroll", update);
        return () => {
            vv.removeEventListener("resize", update);
            vv.removeEventListener("scroll", update);
        };
    }, []);

    if (!step) return null;

    // 最後のステップは「はじめる」だけ(スキップと同じになるため)。上の案内が最後のときは、操作を待たずに閉じられるようにする
    const closeBtn = (label: string) => (
        <button type="button" onClick={() => onClose(false)}
            style={{ background: "none", border: "none", color: theme.subtext, fontSize: 13, cursor: "pointer", padding: "4px 0", minHeight: 44, fontFamily: "inherit", flexShrink: 0 }}>
            {label}
        </button>
    );
    const skipBtn = isLast ? (step.kind === "hint" ? closeBtn("閉じる") : <span />) : closeBtn("スキップ");
    const waiting = <span style={{ fontSize: 12, color: theme.subtext }}>操作すると次へ進みます</span>;
    const action = step.kind === "explain" || missing
        ? <PrimaryBtn onClick={next} style={{ background: accent }}>{isLast ? finishLabel : "次へ"}</PrimaryBtn>
        : waiting;

    const dots = (
        <div style={{ display: "flex", gap: 5, marginBottom: 12 }}>
            {steps.map((_, i) => (
                <div key={i} style={{ width: i === index ? 18 : 6, height: 6, borderRadius: 3, background: i === index ? accent : theme.border, transition: "all 0.3s" }} />
            ))}
        </div>
    );
    const title = <div style={{ fontSize: 15, fontWeight: 800, color: theme.text, lineHeight: 1.4 }}>{step.title}</div>;
    const body = <div style={{ fontSize: 13, color: theme.subtext, lineHeight: 1.7 }}>{step.body}</div>;
    const card = (children: ReactNode, padding: string) => (
        <div style={{ background: theme.card, borderRadius: 16, overflow: "hidden", boxShadow: "0 12px 40px rgba(0,0,0,0.35)" }}>
            <div style={{ height: 4, background: accent }} />
            <div style={{ padding }}>{children}</div>
        </div>
    );
    const fade: CSSProperties = { opacity: shown ? 1 : 0, transition: "opacity 0.25s" };
    // 右下の ＋ は、使わないステップでは隠す(一覧の下のほうのカードに重なって、押し間違えるため)
    const usesFab = typeof step.target === "string" && step.target.startsWith("fab");
    const hideFab = !usesFab && <style>{'[data-tutorial="fab"] { visibility: hidden; }'}</style>;

    // 上に小さく出す案内。画面は暗くせず、そのまま操作してもらう
    if (step.kind === "hint") {
        return (
            <div ref={cardRef} role="status"
                style={{
                    position: "fixed", zIndex: 502, left: "50%", transform: "translateX(-50%)",
                    top: `calc(env(safe-area-inset-top, 0px) + ${adHeight + 8 + keyboardShift}px)`,
                    width: Math.min(viewport.w - 24, 480), ...fade,
                }}>
                {hideFab}
                {/* 画面を広く使えるよう、スキップは見出しの横に置いて低く収める */}
                {card(
                    <>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                            {title}
                            {skipBtn}
                        </div>
                        {body}
                    </>,
                    "4px 16px 12px",
                )}
            </div>
        );
    }

    const { w: vw, h: vh } = viewport;
    const outer = `M 0 0 H ${vw} V ${vh} H 0 Z`;
    const path = spot ? `${outer} ${makeRoundedRectPath(spot.x, spot.y, spot.w, spot.h, 12)}` : outer;

    return (
        <>
            {hideFab}
            {/* 読むだけのステップは、画面全体を触れないようにする */}
            {step.kind === "explain" && <div style={{ position: "fixed", inset: 0, zIndex: 499 }} />}

            {/* 暗いオーバーレイ。穴(照らした場所)は塗られていないので、その下を触れる */}
            <svg style={{ position: "fixed", inset: 0, width: "100%", height: "100%", zIndex: 500, pointerEvents: "none", ...fade }}>
                <path d={path} fill="rgba(15,23,42,0.82)" fillRule="evenodd" style={{ pointerEvents: "visiblePainted" }} />
            </svg>

            {spot && (
                <div style={{
                    position: "fixed", left: spot.x, top: spot.y, width: spot.w, height: spot.h, borderRadius: 12,
                    border: `2px solid ${accent}`, boxShadow: `0 0 0 3px ${accent}30`, zIndex: 501, pointerEvents: "none", ...fade,
                }} />
            )}

            <div ref={cardRef}
                style={{
                    position: "fixed", zIndex: 502, width: Math.min(vw - 32, 340), left: "50%", transform: "translateX(-50%)",
                    top: tooltipTop, maxHeight: Math.max(160, vh - insets.top - insets.bottom), overflowY: "auto", ...fade,
                }}>
                {card(
                    <>
                        {dots}
                        <div style={{ marginBottom: 6 }}>{title}</div>
                        <div style={{ marginBottom: 12 }}>{body}</div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                            {skipBtn}
                            {action}
                        </div>
                    </>,
                    "18px 20px 16px",
                )}
            </div>
        </>
    );
}

function sameRect(a: SpotRect | null, b: SpotRect | null): boolean {
    if (!a || !b) return a === b;
    return Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1 && Math.abs(a.w - b.w) < 1 && Math.abs(a.h - b.h) < 1;
}

/**
 * 上の案内に隠れないよう、画面の中身とモーダルを下げる量を CSS 変数で知らせる
 * (--guide-page: ヘッダーの下から / --guide-modal: 下から出るモーダルの上端から)
 */
function publishHintSpace(card: HTMLElement | null, adHeight: number) {
    const root = document.documentElement.style;
    if (!card) {
        root.removeProperty("--guide-page");
        root.removeProperty("--guide-modal");
        return;
    }
    // キーボードで画面がずれていても、ずれる前の位置で数える
    const shift = window.visualViewport?.offsetTop ?? 0;
    const bottom = card.getBoundingClientRect().bottom - shift + 8;
    const header = (document.querySelector('[data-spotlight-cover="top"]')?.getBoundingClientRect().bottom ?? 0) - shift;
    const safeTop = tooltipInsets(0).top - 8;
    const modalTop = Math.max(safeTop, 24) + adHeight;
    root.setProperty("--guide-page", `${Math.max(0, Math.round(bottom - header))}px`);
    root.setProperty("--guide-modal", `${Math.max(0, Math.round(bottom - modalTop))}px`);
}
