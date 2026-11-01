import type { ReactNode } from "react";
import type { Task } from "../../../lib/types";
import { theme } from "../../../lib/ui/theme";
import { CheckIcon, RepeatIcon, ShieldIcon, TargetIcon } from "../../ui/Icon";
import { findTarget, type GuideCtx, type GuideStep, type Story } from "./guideTypes";

const GOAL_ACCENT = "#1D4ED8";

/** はじめかたの一覧(紹介の最後の画面と、メニューの「使い方を見る」で使う) */
export const STORIES: { id: Story; title: string; sub: string; color: string; icon: ReactNode }[] = [
    { id: "goal", title: "目標に向けて進めたい", sub: "マンダラチャートで目標を分けて、習慣につなげる", color: GOAL_ACCENT, icon: <TargetIcon size={20} /> },
    { id: "tasks", title: "やることを忘れずに片づけたい", sub: "思いついたら登録して、時間があるときに片づける", color: theme.task, icon: <CheckIcon size={20} /> },
    { id: "habit", title: "習慣を身につけたい", sub: "続けたいことを登録して、毎日チェックする", color: theme.habit, icon: <RepeatIcon size={20} /> },
    { id: "rule", title: "生活のルールを守りたい", sub: "守りたいことを登録して、一日の終わりに ○ × をつける", color: theme.rule, icon: <ShieldIcon size={20} /> },
];

type RegisterType = "habit" | "oneoff" | "rule";
const LABEL: Record<RegisterType, string> = { habit: "習慣", oneoff: "タスク", rule: "マイルール" };
export const ACCENT: Record<RegisterType, string> = { habit: theme.habit, oneoff: theme.task, rule: theme.rule };

/** 入力欄が開いたあと、上に出しておく案内 */
const FORM_HINT: Record<RegisterType, { title: string; body: string }> = {
    oneoff: {
        title: "やることを書いて「追加」",
        body: "タイトルだけで登録できます。期限があれば入れておくと、期限の近いものから片づけられます。書けたら「追加」を押してください。",
    },
    habit: {
        title: "名前と頻度を決めて「追加」",
        body: "続けたいことを書き、頻度を毎日・週◯回・曜日指定から選びます。リマインド通知をオンにすると、決めた時刻に知らせます。最後に「追加」を押してください。",
    },
    rule: {
        title: "守りたいことを書いて「追加」",
        body: "「23時までに寝る」「間食しない」など、一日を通して守りたいことを書きます。曜日を決めることもできます。最後に「追加」を押してください。",
    },
};

export const DONE_STEP: GuideStep = {
    kind: "explain",
    title: "これで使い始められます",
    body: "ほかの使い方は、右上のメニュー ≡ の「使い方を見る › やりたいことから探す」で、いつでも見られます。",
};

/** 今の時点を覚えておき、そのあとに作られた、その種類の習慣・タスクを返す関数 */
export function createdSince(ctx: GuideCtx): (type: Task["task_type"]) => Task | null {
    const before = new Set(ctx.state().tasks.map((t) => t.id));
    return (type) => ctx.state().tasks.filter((t) => t.task_type === type && !before.has(t.id)).at(-1) ?? null;
}

/** ＋ → 種類を選ぶ → 「新しい◯◯を追加」 → 入力して追加(追加し終えるまで) */
export function registerSteps(type: RegisterType, ctx: GuideCtx, created: (type: Task["task_type"]) => Task | null): GuideStep[] {
    const label = LABEL[type];
    const accent = ACCENT[type];
    const registerOpen = () => !!findTarget(`register-${type}`);
    return [
        {
            kind: "do", tab: "today", enter: () => ctx.openRegister(null), target: "fab", side: "top", accent,
            title: "＋ から登録します",
            body: "右下の ＋ をタップしてください。",
            until: () => !!document.querySelector('[data-tutorial="fab-menu"][data-open="true"]') || registerOpen(),
        },
        {
            kind: "do", target: `fab-menu-${type}`, side: "top", accent,
            title: `「${label}の登録」を選びます`,
            body: `メニューから「${label}の登録」をタップしてください。`,
            until: registerOpen,
        },
        {
            kind: "do", target: "register-add-btn", accent,
            title: `新しい${label}を追加`,
            body: `「新しい${label}を追加」をタップすると、入力欄が開きます。`,
            until: () => !!findTarget("register-form") || !!created(type),
        },
        { kind: "hint", accent, ...FORM_HINT[type], until: () => !!created(type) },
    ];
}

/**
 * ストーリーごとの案内。実際に1件作ってもらいながら進める。
 * 始めた時点の習慣・タスクを覚えておき、そのあとに作られたものを「今回作ったもの」として照らす。
 */
export function buildStory(story: Story, ctx: GuideCtx): GuideStep[] {
    const start = ctx.state();
    const linkedBefore = new Set(start.tasks.filter((t) => t.mandala_cell_id).map((t) => t.id));

    /** 案内を始めてから作った、その種類の習慣・タスク */
    const created = createdSince(ctx);
    /** 案内を始めてから行動目標にひもづいたもの(新しく作ったものか、登録済みのものをひもづけたもの) */
    const linked = () => ctx.state().tasks.filter((t) => t.mandala_cell_id && !linkedBefore.has(t.id)).at(-1) ?? null;
    const answered = (t: Task | null) => {
        const s = ctx.state();
        return !!t && (s.doneTaskIds.has(t.id) || s.missedTaskIds.has(t.id));
    };

    if (story === "goal") {
        const steps: GuideStep[] = [];
        if (!start.hasChart) {
            steps.push({
                kind: "hint", tab: "goal", enter: () => ctx.goal("wizard"), accent: GOAL_ACCENT,
                title: "まず大目標を決めましょう",
                body: "どんな自分になりたいかを書いて、そのために必要なこと（要素）を挙げます。全部埋めなくても「完了」でチャートができます。",
                until: () => ctx.state().hasChart,
            });
        }
        steps.push(
            {
                kind: "do", tab: "goal", enter: () => ctx.goal("center"), target: "goal-grid", accent: GOAL_ACCENT,
                title: "要素を開いてみましょう",
                body: "まん中が大目標、まわりの 8 マスが要素です。色の濃さで、直近 7 日の進み具合がわかります。要素のマスをタップして開いてください。",
                until: () => !!findTarget("goal-element-grid"),
            },
            {
                kind: "do", target: "goal-element-grid", accent: GOAL_ACCENT,
                title: "行動目標のマスを開きます",
                body: "まわりのマスが、要素のための行動目標です。マスをタップしてください。",
                until: () => !!findTarget("cell-sheet"),
            },
            {
                kind: "hint", accent: theme.habit,
                title: "習慣を作ってひもづけます",
                body: "行動目標を書いて保存したら、「＋ 習慣を作る」から追加してください。タスクやマイルールでもかまいません。",
                until: () => !!linked(),
            },
            {
                kind: "do", tab: "today", enter: () => ctx.goal("center"), accent: theme.habit,
                target: () => { const t = linked(); return t ? `check-${t.id}` : null; },
                title: "記録タブでつけていきます",
                body: "ひもづけた習慣・タスクは記録タブに並び、要素のチップが付きます。できたらチェックしてみましょう（マイルールは ○ か ×）。",
                until: () => answered(linked()),
            },
            {
                kind: "explain", tab: "review", target: "review-goal", accent: GOAL_ACCENT,
                title: "振り返りタブで目標の進みを見る",
                body: "完了にした習慣・タスクから、その日に進んだ行動目標がわかります。",
            },
            {
                kind: "explain", tab: "goal", enter: () => ctx.goal("center"), target: "goal-review", side: "top", accent: theme.action,
                title: "ときどき見直しましょう",
                body: "1〜2 週間に一度は「見直す」で、マスごとに続けるか、やり方を変えるかを決めます。今の状態は「チャートの履歴」に保存できます。",
            },
            { ...DONE_STEP, accent: GOAL_ACCENT, body: `行動目標ごとに習慣・タスクを足していくと、チャートが色づいていきます。${DONE_STEP.body}` },
        );
        return steps;
    }

    const type = story === "tasks" ? "oneoff" : story;
    const accent = ACCENT[type];
    const check = () => { const t = created(type); return t ? `check-${t.id}` : null; };
    const register = registerSteps(type, ctx, created);

    if (story === "tasks") {
        return [
            ...register,
            {
                kind: "do", tab: "today", enter: () => ctx.openRegister(null), target: check, accent,
                title: "手をつけたら長押しで「対応中」",
                body: "左の四角を長押しすると「対応中」になり、一覧の上に並びます。長押ししてみてください。",
                until: () => { const t = created("oneoff"); return !!t && (ctx.state().doingTaskIds.has(t.id) || ctx.state().doneTaskIds.has(t.id)); },
            },
            {
                kind: "do", target: check, accent,
                title: "終わったらタップで完了",
                body: "四角をタップすると完了になり、カードの色が変わります。",
                until: () => answered(created("oneoff")),
            },
            {
                ...DONE_STEP, accent,
                body: `思いついたら ＋ からすぐ登録して、時間があるときに一覧から片づけましょう。期限の近い順に並べる設定は、メニューの「設定 › ユーザ設定」にあります。${DONE_STEP.body}`,
            },
        ];
    }

    if (story === "habit") {
        return [
            ...register,
            {
                kind: "do", tab: "today", enter: () => ctx.openRegister(null), target: check, accent,
                title: "できたらチェック",
                body: "やった日は、左の四角をタップしてチェックします。週◯回の習慣なら、今週の回数も出ます。",
                until: () => answered(created("habit")),
            },
            {
                kind: "explain", target: "tab-week", side: "top", accent,
                title: "続き具合は推移タブで",
                body: "推移タブでは、週・月ごとに習慣を記録した日を見返せます。",
            },
            { ...DONE_STEP, accent },
        ];
    }

    return [
        ...register,
        {
            kind: "do", tab: "today", enter: () => ctx.openRegister(null), target: check, accent,
            title: "一日の終わりに ○ か ×",
            body: "守れたら ○、守れなかったら × をつけます。つけ忘れても、翌朝に前の日の分をつけられます。今日の分をつけてみてください。",
            until: () => answered(created("rule")),
        },
        {
            kind: "explain", target: "tab-week", side: "top", accent,
            title: "守れた日は推移タブで",
            body: "推移タブでは、週・月ごとにマイルールを守れた日を見返せます。",
        },
        { ...DONE_STEP, accent },
    ];
}
