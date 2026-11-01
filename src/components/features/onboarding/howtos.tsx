import type { ReactNode } from "react";
import type { Task } from "../../../lib/types";
import { theme } from "../../../lib/ui/theme";
import { CheckIcon, GridIcon, RepeatIcon, SearchIcon, ShieldIcon, TargetIcon } from "../../ui/Icon";
import { findTarget, type GuideCtx, type GuideStep } from "./guideTypes";
import { ACCENT, createdSince, registerSteps } from "./stories";

const GOAL_ACCENT = "#1D4ED8";
const OTHER_ACCENT = theme.primary;

type HowTo = { id: string; title: string; build: (ctx: GuideCtx) => GuideStep[] };
type HowToGroup = { title: string; color: string; icon: ReactNode; items: HowTo[] };

/** モーダルなどが、一度出てから閉じたら true(出る前に「閉じた」と数えないため) */
function closedAfterShown(target: string): () => boolean {
    let shown = false;
    return () => {
        if (findTarget(target)) { shown = true; return false; }
        return shown;
    };
}

/** 記録タブで今見えている、その種類の最初のカード(の中の目印)。無ければ null(照らさずに説明する) */
function firstOnToday(ctx: GuideCtx, type: Task["task_type"], prefix: "card" | "check", open = false): () => string | null {
    return () => {
        const s = ctx.state();
        const list = s.tasks.filter((t) => t.task_type === type && t.is_active && !t.is_hidden
            && !(open && (s.doneTaskIds.has(t.id) || s.missedTaskIds.has(t.id))));
        const shown = list.find((t) => findTarget(`${prefix}-${t.id}`));
        return shown ? `${prefix}-${shown.id}` : null;
    };
}

const LABEL: Record<"habit" | "oneoff" | "rule", string> = { habit: "習慣", oneoff: "タスク", rule: "マイルール" };

/** ＋ から登録して、記録タブのカードを照らす */
function addHowTo(type: "habit" | "oneoff" | "rule", tip: string): (ctx: GuideCtx) => GuideStep[] {
    return (ctx) => {
        const created = createdSince(ctx);
        return [
            ...registerSteps(type, ctx, created),
            {
                kind: "explain", tab: "today", enter: () => ctx.openRegister(null), accent: ACCENT[type],
                target: () => { const t = created(type); return t ? `card-${t.id}` : null; },
                title: `${LABEL[type]}を追加しました`,
                body: `記録タブに並びます。${tip}`,
            },
        ];
    };
}

/** 記録タブのカードから編集を開き、上の案内を出したまま変えてもらう */
function editHowTo(type: "habit" | "oneoff" | "rule", hint: { title: string; body: string }): (ctx: GuideCtx) => GuideStep[] {
    return (ctx) => {
        const accent = ACCENT[type];
        if (!ctx.state().tasks.some((t) => t.task_type === type && t.is_active && !t.is_hidden)) {
            return [{
                kind: "explain", accent, title: `まだ${LABEL[type]}がありません`,
                body: `先に ＋ から${LABEL[type]}を登録してください。登録したあと、記録タブのカードをタップすると編集できます。`,
            }];
        }
        return [
            {
                kind: "do", tab: "today", enter: () => ctx.openRegister(null), target: firstOnToday(ctx, type, "card"), accent,
                title: "カードをタップして編集を開きます",
                body: `変えたい${LABEL[type]}のカードをタップしてください。記録タブに出ていないときは、＋ › ${LABEL[type]}の登録 の一覧からも開けます。`,
                until: () => !!findTarget("edit-item"),
            },
            { kind: "hint", accent, ...hint, until: closedAfterShown("edit-item") },
        ];
    };
}

/** チャートが無いときは、先に作ってもらう */
function needChart(build: (ctx: GuideCtx) => GuideStep[]): (ctx: GuideCtx) => GuideStep[] {
    return (ctx) => ctx.state().hasChart ? build(ctx) : [{
        kind: "explain", accent: GOAL_ACCENT, title: "まだチャートがありません",
        body: "先に「目標を立てる」からマンダラチャートを作ってください。",
    }];
}

/** メニュー ≡ の場所を示してから、設定のモーダルを開いて変えてもらう */
function settingsHowTo(kind: "user" | "notification", where: string, hint: { title: string; body: string }): (ctx: GuideCtx) => GuideStep[] {
    const target = kind === "user" ? "user-settings" : "notif-settings";
    return (ctx) => [
        { kind: "explain", target: "hamburger", accent: OTHER_ACCENT, title: "右上のメニュー ≡ にあります", body: `${where}にあります。開いてみましょう。` },
        { kind: "hint", enter: () => ctx.openSettings(kind), accent: OTHER_ACCENT, ...hint, until: closedAfterShown(target) },
    ];
}

/** やりたいことから探す使い方(メニューの「使い方を見る」から) */
export const HOWTO_GROUPS: HowToGroup[] = [
    {
        title: "目標", color: GOAL_ACCENT, icon: <TargetIcon size={18} />,
        items: [
            {
                id: "goal-create", title: "目標を立てる",
                build: (ctx) => ctx.state().hasChart
                    ? [{
                        kind: "explain", tab: "goal", enter: () => ctx.goal("center"), target: "goal-title", accent: GOAL_ACCENT,
                        title: "チャートはもうあります",
                        body: "作り直すときは、大目標をタップして「新しいチャートを作る」を選びます。今のチャートは、履歴に残しておけます。",
                    }]
                    : [
                        {
                            kind: "hint", tab: "goal", enter: () => ctx.goal("wizard"), accent: GOAL_ACCENT,
                            title: "大目標を決めましょう",
                            body: "どんな自分になりたいかを書いて、そのために必要なこと（要素）と、行動目標を挙げます。全部埋めなくても「完了」でチャートができます。",
                            until: () => ctx.state().hasChart,
                        },
                        {
                            kind: "explain", target: "goal-grid", accent: GOAL_ACCENT,
                            title: "チャートができました",
                            body: "要素のマスを開いて、行動目標から習慣・タスクを作ると、毎日の記録で目標が進みます。",
                        },
                    ],
            },
            {
                id: "goal-link", title: "習慣・タスクを目標にひもづける",
                build: needChart((ctx) => [
                    {
                        kind: "do", tab: "goal", enter: () => ctx.goal("center"), target: "goal-grid", accent: GOAL_ACCENT,
                        title: "要素を開きます", body: "ひもづけたい要素のマスをタップしてください。",
                        until: () => !!findTarget("goal-element-grid"),
                    },
                    {
                        kind: "do", target: "goal-element-grid", accent: GOAL_ACCENT,
                        title: "行動目標のマスを開きます", body: "ひもづけたい行動目標のマスをタップしてください。",
                        until: () => !!findTarget("cell-sheet"),
                    },
                    {
                        kind: "hint", accent: GOAL_ACCENT,
                        title: "作るか、今あるものを選ぶ",
                        body: "「＋ 習慣を作る」などで新しく作るか、「登録済みの…をひもづける」で今あるものを選びます。記録タブの編集画面の「行動目標」からも、ひもづけられます。",
                        until: closedAfterShown("cell-sheet"),
                    },
                ]),
            },
            {
                id: "goal-progress", title: "目標の進みを見る",
                build: needChart((ctx) => [
                    {
                        kind: "explain", tab: "goal", enter: () => ctx.goal("center"), target: "goal-grid", accent: GOAL_ACCENT,
                        title: "色の濃さが進み具合です",
                        body: "直近 7 日に、ひもづけた習慣・タスクをどれだけできたかを色で表します。要素を開くと、行動目標ごとの進み具合も見られます。",
                    },
                    {
                        kind: "explain", tab: "review", target: "review-goal", accent: GOAL_ACCENT,
                        title: "その日に進んだ目標は振り返りタブで",
                        body: "その日に完了した習慣・タスクから、進んだ行動目標がわかります。",
                    },
                ]),
            },
            {
                id: "goal-review", title: "チャートを見直す・保存する",
                build: needChart((ctx) => [{
                    kind: "explain", tab: "goal", enter: () => ctx.goal("center"), target: "goal-review", side: "top", accent: GOAL_ACCENT,
                    title: "「見直す」と「チャートの履歴」",
                    body: "「見直す」では、進み具合の低い順にマスを見て、ハードルを下げる・やり方を変える・達成にする、などを決めます。「チャートの履歴」では、今の状態を保存したり、過去のチャートを見返したりできます。",
                }]),
            },
            {
                id: "goal-edit", title: "大目標を変える・作り直す",
                build: needChart((ctx) => [{
                    kind: "explain", tab: "goal", enter: () => ctx.goal("center"), target: "goal-title", accent: GOAL_ACCENT,
                    title: "大目標をタップします",
                    body: "大目標と期限を書き換えられます。「新しいチャートを作る」で作り直すこともでき、習慣・タスクと記録はそのまま残ります。",
                }]),
            },
        ],
    },
    {
        title: "習慣", color: theme.habit, icon: <RepeatIcon size={18} />,
        items: [
            { id: "habit-add", title: "習慣を追加する", build: addHowTo("habit", "やった日は、左の四角をタップしてチェックします。") },
            {
                id: "habit-frequency", title: "頻度を変える（週◯回・曜日）",
                build: editHowTo("habit", {
                    title: "「頻度」を選び直して「保存」",
                    body: "毎日・週◯回・曜日指定から選べます。今日から新しい頻度で数え、それまでの記録はそのまま残ります。",
                }),
            },
            {
                id: "habit-remind", title: "リマインドを設定する",
                build: editHowTo("habit", {
                    title: "「リマインド通知」をオンにして「保存」",
                    body: "時刻を選ぶと、毎日その時刻に知らせます。残りの習慣の数をまとめて知らせる通知は、≡ › 設定 › 通知設定 にあります。",
                }),
            },
            {
                id: "habit-hide", title: "しばらく休む（非表示）",
                build: editHowTo("habit", {
                    title: "下の「非表示にする」を押します",
                    body: "記録タブに出なくなります（記録は残ります）。戻すときは、＋ › 習慣の登録 の「非表示」タブで、目のボタンを押します。",
                }),
            },
        ],
    },
    {
        title: "タスク", color: theme.task, icon: <CheckIcon size={18} />,
        items: [
            { id: "task-add", title: "タスクを追加する", build: addHowTo("oneoff", "終わったら、左の四角をタップして完了にします。") },
            {
                id: "task-doing", title: "対応中にする",
                build: (ctx) => [{
                    kind: "explain", tab: "today", enter: () => ctx.openRegister(null), target: firstOnToday(ctx, "oneoff", "check", true), accent: theme.task,
                    title: "左の四角を長押しします",
                    body: "「対応中」になり、一覧の上に始めた日と一緒に出ます。もう一度長押しすると、未完了に戻ります。",
                }],
            },
            {
                id: "task-sort", title: "期限で並べる・手で並べ替える",
                build: settingsHowTo("user", "並び順は、≡ › 設定 › ユーザ設定 の「並び替えの基準」", {
                    title: "「並び替えの基準」を選んで「保存する」",
                    body: "「自分で並べる」なら、記録タブでカードの右の ≡ をつかんで上下に動かします。ほかの基準なら、「期限付きタスクを優先表示」で期限の近い順になります。",
                }),
            },
        ],
    },
    {
        title: "マイルール", color: theme.rule, icon: <ShieldIcon size={18} />,
        items: [
            { id: "rule-add", title: "マイルールを追加する", build: addHowTo("rule", "一日の終わりに、右の ○ か × をつけます。") },
            {
                id: "rule-answer", title: "○ × をつける",
                build: (ctx) => [{
                    kind: "explain", tab: "today", enter: () => ctx.openRegister(null), target: firstOnToday(ctx, "rule", "check"), accent: theme.rule,
                    title: "守れたら ○、守れなかったら ×",
                    body: "選んだほうをもう一度押すと取り消せます。前の日の分は、上の日付を ◀ で戻してつけます。",
                }],
            },
        ],
    },
    {
        title: "振り返る", color: theme.action, icon: <SearchIcon size={18} />,
        items: [
            {
                id: "review-day", title: "その日の記録を見る",
                build: () => [{
                    kind: "explain", tab: "review", target: "review-content", accent: theme.action,
                    title: "振り返りタブの「実施したこと一覧」",
                    body: "完了した習慣・タスクと、マイルールの ○ × を種類ごとに見られます。上の日付を動かすと、前の日の記録も見られます。",
                }],
            },
            {
                id: "trend", title: "週・月の推移を見る",
                build: () => [{
                    kind: "explain", tab: "week", target: "trend-period", accent: theme.action,
                    title: "推移タブで期間を切り替えます",
                    body: "週・月を切り替え、‹ › で期間を動かします。習慣・マイルールを記録した日、完了したタスク、何も記録していない日がわかります。",
                }],
            },
        ],
    },
    {
        title: "そのほか", color: OTHER_ACCENT, icon: <GridIcon size={18} />,
        items: [
            {
                id: "widget", title: "ホーム画面のウィジェット",
                build: () => [{
                    kind: "explain", accent: OTHER_ACCENT,
                    title: "ホーム画面に置けます",
                    body: "ホーム画面の空いたところを長押しして、左上の ＋ から「Habitas」を選びます。「習慣」「タスク」のウィジェットはその場で完了にでき、「目標」のウィジェットはチャートの進み具合を出します。",
                }],
            },
            {
                id: "notification", title: "通知の設定",
                build: settingsHowTo("notification", "通知は、≡ › 設定 › 通知設定", {
                    title: "知らせてほしいものをオンにして「保存する」",
                    body: "残りの習慣の数や、タスクの期限前などを、決めた時刻に知らせます。",
                }),
            },
            {
                id: "sync", title: "ログインと同期",
                build: () => [{
                    kind: "explain", target: "hamburger", accent: OTHER_ACCENT,
                    title: "≡ › ログイン から",
                    body: "Apple か Google でログインすると、記録をクラウドに保存でき、機種変更のときも引き継げます。ログインしたあとは、≡ › クラウド同期 で同期します。",
                }],
            },
        ],
    },
];

export function findHowTo(id: string): HowTo | undefined {
    return HOWTO_GROUPS.flatMap((g) => g.items).find((h) => h.id === id);
}
