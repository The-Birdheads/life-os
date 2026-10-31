import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sqliteRepo } from "../../../lib/db/instance";
import { todayJST } from "../../../lib/day";
import { AROUND, rateLevel, rateText, rateTint, type ChartModel } from "../../../lib/mandala/chart";
import { dayProgress, gain, periodEndingOn, type DayProgress } from "../../../lib/mandala/dayProgress";
import { localDateLabel } from "../../../lib/mandala/dates";
import { doneDaysByTask } from "../../../lib/mandala/progress";
import type { Task } from "../../../lib/types";
import { theme } from "../../../lib/ui/theme";
import SectionTitle from "../../ui/SectionTitle";
import { CheckIcon, RepeatIcon, TargetIcon } from "../../ui/Icon";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const reducedMotion = () => {
    try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
};

// 一度流した日は、しばらく自動では流さない(「もう一度見る」でいつでも見られる)
const SEEN_KEY = "habitas.mandalaReplay.seen";
const QUIET_MS = 6 * 60 * 60 * 1000;

function readSeen(): Record<string, number> {
    try { return JSON.parse(localStorage.getItem(SEEN_KEY) ?? "{}") ?? {}; } catch { return {}; }
}
function seenRecently(day: string): boolean {
    const at = readSeen()[day];
    return typeof at === "number" && Date.now() - at < QUIET_MS;
}
function markSeen(day: string) {
    try {
        const recent = Object.entries({ ...readSeen(), [day]: Date.now() }).sort((a, b) => b[1] - a[1]).slice(0, 14);
        localStorage.setItem(SEEN_KEY, JSON.stringify(Object.fromEntries(recent)));
    } catch { /* 保存できなくても、毎回流れるだけ */ }
}

/**
 * 振り返りタブの「目標の進み」。その日に進めたマスを、昨日までの色から今日の色へ育てて見せる。
 * 一度流した日は 6 時間は自動で流さず、結果だけを出す。「もう一度見る」で何度でも見られ、再生中は「スキップ」できる。
 * 動きを減らす設定のときは、結果だけを出す
 */
export default function MandalaReplay({
    userId, day, model, byCell, refreshKey, onOpenGoal,
}: {
    userId: string | null;
    day: string;
    model: ChartModel;
    byCell: Map<string, Task[]>;
    /** 記録が変わったときに読み直す */
    refreshKey?: unknown;
    onOpenGoal?: (element: number) => void;
}) {
    const [progress, setProgress] = useState<DayProgress | null>(null);

    useEffect(() => {
        if (!userId) return;
        let alive = true;
        (async () => {
            const period = periodEndingOn(day);
            const [entries, achieved] = await Promise.all([
                sqliteRepo.getTaskEntriesBetween(userId, period.from, period.to),
                sqliteRepo.getCellEventsByKind(userId, "achieved"),
            ]);
            // そのマスを最後に達成にした日が、この日なら「この日に達成にした」
            const lastAchieved = new Map<string, string>();
            for (const e of achieved) lastAchieved.set(e.cell_id, localDateLabel(e.created_at));
            const label = day.replace(/-/g, "/");
            const achievedOn = new Set([...lastAchieved].filter(([, d]) => d === label).map(([id]) => id));
            if (alive) setProgress(dayProgress(model, byCell, doneDaysByTask(entries), day, achievedOn));
        })().catch((e) => console.warn("[mandala] replay load failed:", e));
        return () => { alive = false; };
    }, [userId, day, model, byCell, refreshKey]);

    // ── 演出 ──
    const [shown, setShown] = useState<(number | null)[]>([]);
    const [active, setActive] = useState<number | null>(null);
    const [gains, setGains] = useState<Map<number, number>>(new Map());
    const [revealed, setRevealed] = useState(0);
    const [playing, setPlaying] = useState(false);
    const run = useRef(0);

    const moved = useMemo(() => {
        if (!progress) return [];
        const set = new Set(progress.cells.map((c) => c.element));
        return progress.elements.filter((e) => set.has(e.index));
    }, [progress]);

    /** 演出を止めて、結果だけを出す */
    const showResult = useCallback(() => {
        if (!progress) return;
        run.current++;
        setShown(progress.elements.map((e) => e.after));
        setGains(new Map(moved.map((e) => [e.index, gain(e)])));
        setRevealed(progress.cells.length);
        setActive(null);
        setPlaying(false);
    }, [progress, moved]);

    const play = useCallback(async () => {
        if (!progress) return;
        if (reducedMotion() || moved.length === 0) {
            showResult();
            return;
        }
        const id = ++run.current;
        markSeen(progress.day);
        setPlaying(true);
        setShown(progress.elements.map((e) => e.before));
        setGains(new Map());
        setRevealed(0);
        setActive(null);
        await wait(600);
        for (const e of moved) {
            if (run.current !== id) return;
            setActive(e.index);
            await wait(350);
            if (run.current !== id) return;
            setShown((prev) => prev.map((r, i) => (i === e.index ? e.after : r)));
            setGains((prev) => new Map(prev).set(e.index, gain(e)));
            await wait(950);
        }
        if (run.current !== id) return;
        setActive(null);
        for (let i = 1; i <= progress.cells.length; i++) {
            if (run.current !== id) return;
            setRevealed(i);
            await wait(160);
        }
        setPlaying(false);
    }, [progress, moved, showResult]);

    // 進めたマスが変わったときだけ流しなおす(読み直しのたびに流れないように)
    const signature = progress ? `${progress.day}|${progress.cells.map((c) => `${c.cell.id}:${c.after}`).join(",")}` : "";
    useEffect(() => {
        if (!signature || !progress) return;
        if (seenRecently(progress.day)) showResult();
        else play();
        return () => { run.current++; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [signature]);

    if (!progress || shown.length === 0) return null;

    const isToday = day === todayJST();
    const dayLabel = isToday ? "今日" : `${Number(day.slice(5, 7))}月${Number(day.slice(8, 10))}日`;
    const count = progress.cells.length;
    const finished = !playing;

    return (
        <div>
            <style>{KEYFRAMES}</style>
            <SectionTitle
                title="目標の進み"
                isLarge
                style={{ marginBottom: 8 }}
                right={count > 0 ? (
                    playing ? (
                        <button type="button" onClick={showResult} aria-label="進み具合の動きをスキップする" style={headerBtn}>
                            <SkipIcon />スキップ
                        </button>
                    ) : (
                        <button type="button" onClick={play} aria-label="進み具合の動きをもう一度見る" style={headerBtn}>
                            <RepeatIcon size={14} />もう一度見る
                        </button>
                    )
                ) : undefined}
            />

            <div style={{ fontSize: 12, color: theme.subtext, marginBottom: 8 }}>{dayLabel}までの直近 7 日の進み具合</div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6 }}>
                {Array.from({ length: 9 }, (_, pos) => {
                    if (pos === 4) {
                        return (
                            <div key={pos} style={{ ...cellBase, background: "#1E293B", color: "#F8FAFC", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
                                <span style={{ fontSize: 12, lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" as any, overflow: "hidden" }}>{model.chart.title}</span>
                                {finished && count > 0 && (
                                    <span style={{ fontSize: 11, fontWeight: 700, color: "#FDE68A", animation: "mr-pop 0.5s ease-out" }}>{count}マス前進</span>
                                )}
                            </div>
                        );
                    }
                    const el = model.elements[AROUND.indexOf(pos as (typeof AROUND)[number])];
                    if (!el.name) return <div key={pos} style={{ ...cellBase, border: "2px dashed #CBD5E1", background: "transparent" }} />;
                    const r = shown[el.index];
                    const t = rateTint(el.color, r);
                    const strong = rateLevel(r) === 3;
                    const isActive = active === el.index;
                    const g = gains.get(el.index);
                    return (
                        <button key={pos} type="button" onClick={() => onOpenGoal?.(el.index)}
                            aria-label={`${el.name}、${rateText(progress.elements[el.index].after)}${g ? `、${dayLabel} ${g}% 進んだ` : ""}。目標タブで開く`}
                            style={{
                                ...cellBase, position: "relative", background: t.bg, color: t.fg, border: `2px solid ${t.border}`,
                                justifyContent: "space-between", cursor: onOpenGoal ? "pointer" : "default",
                                transform: isActive ? "scale(1.07)" : "scale(1)",
                                boxShadow: isActive ? `0 0 0 4px ${el.color}55, 0 10px 24px ${el.color}66` : "none",
                                zIndex: isActive ? 1 : 0,
                                transition: "background-color 0.6s ease, border-color 0.6s ease, color 0.6s ease, transform 0.3s ease, box-shadow 0.3s ease",
                            }}>
                            <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.35 }}>{el.name}</span>
                            <span style={{ display: "grid", gap: 5 }}>
                                <span style={{ height: 6, borderRadius: 3, overflow: "hidden", background: strong ? "rgba(255,255,255,0.35)" : "rgba(15,23,42,0.12)" }}>
                                    <span style={{ display: "block", height: 6, width: `${r ?? 0}%`, background: strong ? "#fff" : el.color, transition: "width 0.7s ease" }} />
                                </span>
                                <span style={{ fontSize: 13, fontWeight: 700 }}><CountUp value={r} /></span>
                            </span>
                            {g !== undefined && g > 0 && (
                                <>
                                    {/* 浮かんで消える「+◯%」と、残る目印 */}
                                    {isActive && <span aria-hidden style={{ ...gainFloat, color: el.color }}>+{g}%</span>}
                                    <span aria-hidden style={{ ...gainBadge, background: el.color, animation: "mr-pop 0.4s ease-out" }}>+{g}</span>
                                </>
                            )}
                        </button>
                    );
                })}
            </div>

            <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                {count === 0 ? (
                    <div style={{ display: "flex", gap: 10, alignItems: "center", background: theme.card, borderRadius: 12, padding: "12px 14px", fontSize: 13, lineHeight: 1.6 }}>
                        <TargetIcon size={22} color={theme.subtext} />
                        <span>{dayLabel}はまだ行動目標を進めていません。目標にひもづいた習慣・タスクを完了にすると、ここで進んだマスが光ります。</span>
                    </div>
                ) : (
                    <>
                        <div style={{ fontSize: 15, fontWeight: 700, opacity: finished ? 1 : 0, transform: finished ? "none" : "translateY(6px)", transition: "opacity 0.4s, transform 0.4s" }}>
                            {dayLabel}は <span style={{ color: "#1D4ED8", fontSize: 18 }}>{count}つ</span> の行動目標を進めました
                        </div>
                        {progress.cells.map((c, i) => {
                            const el = model.elements[c.element];
                            const open = i < revealed;
                            const r = open ? c.after : c.before;
                            return (
                                <button key={c.cell.id} type="button" onClick={() => onOpenGoal?.(c.element)}
                                    style={{
                                        display: "grid", gap: 6, textAlign: "left", width: "100%", border: `1px solid ${theme.border}`, borderLeft: `4px solid ${el.color}`,
                                        borderRadius: 12, background: theme.card, color: "var(--text)", padding: "10px 12px", fontFamily: "inherit",
                                        cursor: onOpenGoal ? "pointer" : "default",
                                        opacity: open ? 1 : 0, transform: open ? "none" : "translateY(8px)", transition: "opacity 0.35s, transform 0.35s",
                                    }}>
                                    <span style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                                        <span style={{ minWidth: 0 }}>
                                            <span style={{ fontSize: 11, color: theme.subtext }}>{el.name} › </span>
                                            <b style={{ fontSize: 14 }}>{c.cell.text}</b>
                                        </span>
                                        <span style={{ fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", color: el.color }}>
                                            {c.achieved ? "達成" : `${rateText(c.before)} → ${rateText(c.after)}`}
                                        </span>
                                    </span>
                                    <span style={{ height: 6, borderRadius: 3, overflow: "hidden", background: "rgba(15,23,42,0.1)" }}>
                                        <span style={{ display: "block", height: 6, width: `${r ?? 0}%`, background: el.color, transition: "width 0.8s ease 0.15s" }} />
                                    </span>
                                    {c.doneTasks.length > 0 && (
                                        <span style={{ display: "flex", flexWrap: "wrap", gap: "4px 10px", fontSize: 12, color: theme.subtext }}>
                                            {c.doneTasks.map((t) => (
                                                <span key={t.id} style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                                                    <CheckIcon size={12} color={el.color} />{t.title}
                                                </span>
                                            ))}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </>
                )}
            </div>
        </div>
    );
}

/** スキップ(▶▶|) */
function SkipIcon() {
    return (
        <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M4 5.5v13l8-6.5-8-6.5zm8 0v13l8-6.5-8-6.5z" />
            <rect x="20" y="5" width="2" height="14" rx="1" />
        </svg>
    );
}

/** 数字を前の値から新しい値まで数え上げる */
function CountUp({ value }: { value: number | null }) {
    const [n, setN] = useState(value);
    const from = useRef(value);
    useEffect(() => {
        const start = from.current ?? 0;
        from.current = value;
        if (value === null || reducedMotion()) { setN(value); return; }
        const t0 = performance.now();
        let raf = 0;
        const tick = (now: number) => {
            const p = Math.min(1, (now - t0) / 700);
            setN(Math.round(start + (value - start) * (1 - (1 - p) ** 3)));
            if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [value]);
    return <>{rateText(n)}</>;
}

const KEYFRAMES = `
@keyframes mr-float { 0% { opacity: 0; transform: translate(-50%, 4px); } 20% { opacity: 1; } 100% { opacity: 0; transform: translate(-50%, -26px); } }
@keyframes mr-pop { 0% { transform: scale(0.4); opacity: 0; } 70% { transform: scale(1.15); opacity: 1; } 100% { transform: scale(1); } }
`;

const headerBtn: React.CSSProperties = {
    minHeight: 34, display: "inline-flex", alignItems: "center", gap: 4, border: "1px solid rgba(255,255,255,0.6)", borderRadius: 8,
    background: "transparent", color: "#fff", fontSize: 12, fontWeight: 700, padding: "0 10px", cursor: "pointer", fontFamily: "inherit",
};
const cellBase: React.CSSProperties = {
    height: 104, borderRadius: 14, boxSizing: "border-box", padding: 9, display: "flex", flexDirection: "column",
    gap: 4, fontFamily: "inherit", textAlign: "left", width: "100%",
};
const gainFloat: React.CSSProperties = {
    position: "absolute", left: "50%", top: -6, fontSize: 18, fontWeight: 800, pointerEvents: "none",
    textShadow: "0 1px 0 #fff, 0 0 6px #fff", animation: "mr-float 1.2s ease-out forwards", whiteSpace: "nowrap",
};
const gainBadge: React.CSSProperties = {
    position: "absolute", top: -7, right: -5, minWidth: 22, height: 20, borderRadius: 10, padding: "0 5px", boxSizing: "border-box",
    color: "#fff", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center",
    boxShadow: "0 1px 3px rgba(0,0,0,0.25)", border: "2px solid #fff",
};
