import { useEffect, useState } from "react";
import { theme } from "../lib/ui/theme";
import type { Task } from "../lib/types";
import {
    actionRate, AROUND, elementRate, namedElements, rateText, rateTint, rateLevel,
    type ElementModel,
} from "../lib/mandala/chart";
import type { MandalaState } from "../lib/mandala/useMandala";
import { isCounted } from "../lib/mandala/progress";
import ChartWizard from "../components/features/goal/ChartWizard";
import CellSheet from "../components/features/goal/CellSheet";
import ReviewFlow from "../components/features/goal/ReviewFlow";
import ReviewHistory from "../components/features/goal/ReviewHistory";
import PrimaryBtn from "../components/ui/PrimaryBtn";
import SecondaryBtn from "../components/ui/SecondaryBtn";
import { ChevronLeftIcon, ChevronRightIcon, GridIcon, PlusIcon, TargetIcon } from "../components/ui/Icon";
import { todayJST } from "../lib/day";

type View = "center" | "element" | "all" | "wizard" | "review" | "history";
type Sheet = { element: number; cell: number | null } | null;

/** 記録タブのチップなどから、特定の要素を開くための指定(nonce が変わるたびに開く) */
export type GoalFocus = { element: number; nonce: number } | null;

export default function GoalView({
    mandala,
    tasks,
    adHeight,
    setMsg,
    focus,
}: {
    mandala: MandalaState;
    tasks: Task[];
    adHeight: number;
    setMsg: (s: string) => void;
    focus: GoalFocus;
}) {
    const [view, setView] = useState<View>("center");
    const [elem, setElem] = useState(0);
    const [sheet, setSheet] = useState<Sheet>(null);
    const model = mandala.model;

    useEffect(() => {
        if (focus) { setElem(focus.element); setView("element"); setSheet(null); }
    }, [focus?.nonce]);

    if (!mandala.loaded) return null;

    if (view === "wizard" || !model) {
        if (view !== "wizard") {
            return <EmptyGoal onStart={() => setView("wizard")} />;
        }
        return (
            <div style={{ paddingTop: 8 }}>
                <ChartWizard
                    onCancel={() => setView("center")}
                    onSave={async (draft) => {
                        await mandala.createChart(draft);
                        setView("center");
                        setMsg("チャートを作りました。要素を開いて、マスから習慣を作ってみましょう");
                    }}
                />
            </div>
        );
    }

    const named = namedElements(model);
    const rateOfElement = (el: ElementModel) => elementRate(el, mandala.byCell, mandala.doneByTask, mandala.period);
    const linkedCount = (type: Task["task_type"]) => {
        const ids = new Set(model.elements.flatMap((el) => el.actions.map((c) => c?.id).filter(Boolean)));
        return tasks.filter((t) => t.task_type === type && t.mandala_cell_id && ids.has(t.mandala_cell_id) && isCounted(t)).length;
    };
    const daysLeft = model.chart.end_date
        ? Math.round((Date.parse(model.chart.end_date) - Date.parse(todayJST())) / 86400000)
        : null;

    const element = model.elements[elem];
    const step = (d: number) => {
        if (!named.length) return;
        const i = Math.max(0, named.indexOf(elem));
        setElem(named[(i + d + named.length) % named.length]);
    };

    return (
        <div style={{ display: "grid", gap: 12, paddingTop: 8 }}>
            {view === "center" && (
                <>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                        <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 12, color: theme.subtext }}>大目標</div>
                            <h1 style={{ margin: "2px 0 0", fontSize: 20, lineHeight: 1.35 }}>{model.chart.title}</h1>
                        </div>
                        {daysLeft !== null && (
                            <div style={{ textAlign: "right", fontSize: 12, color: theme.subtext, whiteSpace: "nowrap", lineHeight: 1.6 }}>
                                〜{model.chart.end_date!.replace(/-/g, "/")}<br />
                                <strong style={{ fontSize: 14, color: "var(--text)" }}>{daysLeft >= 0 ? `あと ${daysLeft} 日` : "期限を過ぎました"}</strong>
                            </div>
                        )}
                    </div>
                    <div style={{ fontSize: 12, color: theme.subtext }}>直近 7 日の進み具合　・　要素をタップして開く</div>
                    <Grid3>
                        {Array.from({ length: 9 }, (_, pos) => {
                            if (pos === 4) {
                                return <div key={pos} style={{ ...cellBase, height: 112, background: "#1E293B", color: "#F8FAFC", justifyContent: "center", alignItems: "center", textAlign: "center", fontSize: 13 }}>{model.chart.title}</div>;
                            }
                            const el = model.elements[AROUND.indexOf(pos as (typeof AROUND)[number])];
                            if (!el.name) {
                                return <EmptyCell key={pos} height={112} label="要素を書く" onClick={() => setSheet({ element: el.index, cell: null })} />;
                            }
                            const r = rateOfElement(el);
                            const t = rateTint(el.color, r);
                            const strong = rateLevel(r) === 3;
                            return (
                                <button key={pos} type="button" aria-label={`${el.name}、${rateText(r)}。開く`}
                                    onClick={() => { setElem(el.index); setView("element"); }}
                                    style={{ ...cellBase, height: 112, background: t.bg, color: t.fg, border: `2px solid ${t.border}`, justifyContent: "space-between", cursor: "pointer" }}>
                                    <span style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.35 }}>{el.name}</span>
                                    <span style={{ display: "grid", gap: 5 }}>
                                        <span style={{ height: 6, borderRadius: 3, overflow: "hidden", background: strong ? "rgba(255,255,255,0.35)" : "rgba(15,23,42,0.12)" }}>
                                            <span style={{ display: "block", height: 6, width: `${r ?? 0}%`, background: strong ? "#fff" : el.color }} />
                                        </span>
                                        <span style={{ fontSize: 13, fontWeight: 700 }}>{rateText(r)}</span>
                                    </span>
                                </button>
                            );
                        })}
                    </Grid3>
                    <Legend />
                    <div style={{ background: theme.card, borderRadius: 14, padding: "12px 14px", fontSize: 13 }}>
                        ひもづいた習慣 <b>{linkedCount("habit")}</b> 件 ・ タスク <b>{linkedCount("oneoff")}</b> 件{linkedCount("rule") > 0 && <> ・ マイルール <b>{linkedCount("rule")}</b> 件</>}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <PrimaryBtn fullWidth disabled={named.length === 0} onClick={() => setView("review")} style={{ minHeight: 52 }}>見直す</PrimaryBtn>
                        <SecondaryBtn fullWidth onClick={() => setView("history")} style={{ minHeight: 52 }}>見直しの履歴（{mandala.reviews.length}）</SecondaryBtn>
                    </div>
                    <SecondaryBtn fullWidth onClick={() => setView("all")}><GridIcon size={18} />全体を見る（9×9）</SecondaryBtn>
                </>
            )}

            {view === "review" && (
                <ReviewFlow mandala={mandala} adHeight={adHeight} setMsg={setMsg} onDone={() => setView("center")} />
            )}

            {view === "history" && (
                <ReviewHistory reviews={mandala.reviews} model={model} onBack={() => setView("center")} />
            )}

            {view === "element" && element && (
                <>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <button type="button" onClick={() => setView("center")} style={backBtn}><ChevronLeftIcon size={18} />中心へ</button>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 16, fontWeight: 700 }}>
                            <span style={{ width: 12, height: 12, borderRadius: 6, background: element.color }} />{element.name}
                        </span>
                        <div style={{ display: "flex", gap: 6 }}>
                            <button type="button" aria-label="前の要素" onClick={() => step(-1)} style={navBtn}><ChevronLeftIcon size={18} /></button>
                            <button type="button" aria-label="次の要素" onClick={() => step(1)} style={navBtn}><ChevronRightIcon size={18} /></button>
                        </div>
                    </div>
                    <div style={{ fontSize: 12, color: theme.subtext }}>マスをタップすると、習慣・タスクを作ったり、ひもづけたりできます</div>
                    <Grid3>
                        {Array.from({ length: 9 }, (_, pos) => {
                            if (pos === 4) {
                                return (
                                    <button key={pos} type="button" aria-label={`要素「${element.name}」の名前を変える`} onClick={() => setSheet({ element: element.index, cell: null })}
                                        style={{ ...cellBase, height: 118, background: element.color, color: "#fff", border: "none", justifyContent: "center", alignItems: "center", textAlign: "center", cursor: "pointer" }}>
                                        <span style={{ fontSize: 15, fontWeight: 700 }}>{element.name}</span>
                                        <span style={{ fontSize: 12 }}>{rateText(rateOfElement(element))}</span>
                                    </button>
                                );
                            }
                            const a = AROUND.indexOf(pos as (typeof AROUND)[number]);
                            const c = element.actions[a];
                            const open = () => setSheet({ element: element.index, cell: a });
                            if (!c || !c.text.trim()) return <EmptyCell key={pos} height={118} label="書く" onClick={open} />;
                            const linked = (mandala.byCell.get(c.id) ?? []).filter(isCounted);
                            if (!linked.length && c.status === "active") {
                                return (
                                    <button key={pos} type="button" aria-label={`${c.text}、習慣・タスク未設定。開く`} onClick={open}
                                        style={{ ...cellBase, height: 118, background: theme.card, color: "var(--text)", border: `2px solid ${theme.border}`, justifyContent: "space-between", cursor: "pointer" }}>
                                        <CellText text={c.text} />
                                        <span style={{ alignSelf: "flex-start", fontSize: 11, background: "#F1F5F9", borderRadius: 6, padding: "2px 6px", color: "#475569" }}>未設定 ＋</span>
                                    </button>
                                );
                            }
                            const r = actionRate(c, mandala.byCell, mandala.doneByTask, mandala.period);
                            const t = c.status === "paused" ? { bg: "#E2E8F0", fg: "#334155", border: "#CBD5E1" } : rateTint(element.color, r);
                            const h = linked.filter((x) => x.task_type === "habit").length;
                            const k = linked.filter((x) => x.task_type === "oneoff").length;
                            const rl = linked.filter((x) => x.task_type === "rule").length;
                            const meta = c.status === "paused" ? "休止中" : c.status === "achieved" ? "達成"
                                : [h ? `習慣${h}` : "", k ? `タスク${k}` : "", rl ? `ルール${rl}` : ""].filter(Boolean).join("・");
                            return (
                                <button key={pos} type="button" aria-label={`${c.text}、${meta}、${rateText(r)}。開く`} onClick={open}
                                    style={{ ...cellBase, height: 118, background: t.bg, color: t.fg, border: `2px solid ${t.border}`, justifyContent: "space-between", cursor: "pointer" }}>
                                    <CellText text={c.text} />
                                    <span style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 4 }}>
                                        <span style={{ fontSize: 10 }}>{meta}</span>
                                        <b style={{ fontSize: 13 }}>{c.status === "paused" ? "" : rateText(r)}</b>
                                    </span>
                                </button>
                            );
                        })}
                    </Grid3>
                    <Legend withCellStates color={element.color} />
                </>
            )}

            {view === "all" && (
                <>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <button type="button" onClick={() => setView("center")} style={backBtn}><ChevronLeftIcon size={18} />中心へ</button>
                        <span style={{ fontSize: 15, fontWeight: 700 }}>全体（9×9）</span>
                        <span style={{ width: 64 }} />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 5 }}>
                        {Array.from({ length: 9 }, (_, bp) => (
                            <div key={bp} style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 2 }}>
                                {Array.from({ length: 9 }, (_, q) => {
                                    const tiny = (label: string, bg: string, fg: string, onClick?: () => void, bold = false) => (
                                        <button key={q} type="button" aria-label={label || "空き"} onClick={onClick} disabled={!onClick}
                                            style={{ height: 38, border: "none", borderRadius: 4, background: bg, color: fg, padding: 2, fontSize: 8, fontWeight: bold ? 700 : 500, lineHeight: 1.25, overflow: "hidden", cursor: onClick ? "pointer" : "default", fontFamily: "inherit" }}>
                                            {label}
                                        </button>
                                    );
                                    if (bp === 4) {
                                        if (q === 4) return tiny(model.chart.title, "#1E293B", "#F8FAFC", () => setView("center"), true);
                                        const el = model.elements[AROUND.indexOf(q as (typeof AROUND)[number])];
                                        if (!el.name) return tiny("", "#F8FAFC", "#475569");
                                        const t = rateTint(el.color, rateOfElement(el));
                                        return tiny(el.name, t.bg, t.fg, () => { setElem(el.index); setView("element"); }, true);
                                    }
                                    const el = model.elements[AROUND.indexOf(bp as (typeof AROUND)[number])];
                                    if (!el.name) return tiny("", "#F8FAFC", "#475569");
                                    const openEl = () => { setElem(el.index); setView("element"); };
                                    if (q === 4) return tiny(el.name, el.color, "#fff", openEl, true);
                                    const c = el.actions[AROUND.indexOf(q as (typeof AROUND)[number])];
                                    if (!c || !c.text.trim()) return tiny("", "#F8FAFC", "#475569", openEl);
                                    const r = actionRate(c, mandala.byCell, mandala.doneByTask, mandala.period);
                                    const t = r === null ? { bg: "#FFFFFF", fg: "#334155" } : rateTint(el.color, r);
                                    return tiny(c.text, t.bg, t.fg, openEl);
                                })}
                            </div>
                        ))}
                    </div>
                    <p style={{ margin: 0, fontSize: 12, lineHeight: 1.7, color: theme.subtext }}>色の濃さで、全体の進み具合を眺める画面です。マスをタップすると、その要素を開きます。</p>
                </>
            )}

            {sheet && (
                <CellSheet
                    key={`${sheet.element}-${sheet.cell}`}
                    mandala={mandala}
                    element={model.elements[sheet.element]}
                    cellIndex={sheet.cell}
                    tasks={tasks}
                    adHeight={adHeight}
                    setMsg={setMsg}
                    onClose={() => setSheet(null)}
                    onOpenElement={(e) => { setSheet(null); setElem(e); setView("element"); }}
                />
            )}
        </div>
    );
}

function EmptyGoal({ onStart }: { onStart: () => void }) {
    return (
        <div style={{ display: "grid", justifyItems: "center", textAlign: "center", padding: "56px 8px 0", gap: 16 }}>
            <div style={{ width: 76, height: 76, borderRadius: 38, background: "#DBEAFE", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <TargetIcon size={40} color="#1D4ED8" />
            </div>
            <h1 style={{ margin: 0, fontSize: 22 }}>目標を立てよう</h1>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.8, color: theme.subtext }}>
                大きな目標を 8 つの要素と<br />64 の行動目標に分けて、<br />毎日の習慣・タスクにつなげます
            </p>
            <PrimaryBtn fullWidth onClick={onStart} style={{ marginTop: 12, minHeight: 52 }}>マンダラチャートを作る</PrimaryBtn>
        </div>
    );
}

function Grid3({ children }: { children: React.ReactNode }) {
    return <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6 }}>{children}</div>;
}

function CellText({ text }: { text: string }) {
    return (
        <span style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" as any, overflow: "hidden", textAlign: "left" }}>
            {text}
        </span>
    );
}

function EmptyCell({ height, label, onClick }: { height: number; label: string; onClick: () => void }) {
    return (
        <button type="button" aria-label={label} onClick={onClick}
            style={{ ...cellBase, height, border: "2px dashed #94A3B8", background: "transparent", color: theme.subtext, alignItems: "center", justifyContent: "center", fontSize: 12, cursor: "pointer" }}>
            <PlusIcon size={20} />{label}
        </button>
    );
}

function Legend({ withCellStates, color = "#1D4ED8" }: { withCellStates?: boolean; color?: string }) {
    const sw = (bg: string, border?: string): React.CSSProperties => ({ width: 12, height: 12, borderRadius: 3, background: bg, border: border ? `1px solid ${border}` : undefined, boxSizing: "border-box" });
    const item = (style: React.CSSProperties, label: string) => (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={style} />{label}</span>
    );
    return (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, fontSize: 11, color: "var(--text)" }}>
            {withCellStates && item({ ...sw("transparent"), border: "2px dashed #94A3B8" }, "空き")}
            {withCellStates && item(sw("#FFFFFF", "#CBD5E1"), "未設定")}
            {item(sw("#E2E8F0", "#CBD5E1"), withCellStates ? "未着手・休止中" : "未着手")}
            {item(sw(`${color}1F`, `${color}59`), "〜30%")}
            {item(sw(`${color}66`), "〜70%")}
            {item(sw(color), "70%〜")}
        </div>
    );
}

const cellBase: React.CSSProperties = {
    borderRadius: 14, boxSizing: "border-box", padding: 9, display: "flex", flexDirection: "column",
    gap: 4, fontFamily: "inherit", textAlign: "left", width: "100%",
};
const backBtn: React.CSSProperties = {
    minHeight: 44, border: "none", background: "none", color: "#1D4ED8", fontSize: 14, fontWeight: 700,
    padding: 0, display: "flex", alignItems: "center", gap: 2, cursor: "pointer",
};
const navBtn: React.CSSProperties = {
    width: 44, height: 44, borderRadius: 12, border: `1px solid ${theme.border}`, background: theme.card,
    display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text)",
};
