import type { Task } from "../../../lib/types";
import type { Tab } from "../../../lib/tabs";

/** はじめかたのストーリー: 目標から / やることを片づける / 習慣を身につける / ルールを守る */
export type Story = "goal" | "tasks" | "habit" | "rule";

/**
 * 案内の1ステップ。
 * - explain: 画面を暗くして照らし、読んだら「次へ」
 * - do: 照らした場所だけ触れるようにして、操作(until が true になる)で次へ進む
 * - hint: 画面は暗くせず、上に小さな案内を出したまま、操作(until)を待つ(入力の多い画面向け)
 */
export type GuideStep = {
    kind: "explain" | "do" | "hint";
    /** 照らす要素の data-tutorial(関数なら、そのステップに来たときに決める)。無ければ照らさない */
    target?: string | (() => string | null);
    title: string;
    body: string;
    /** 吹き出しを置きたい側(収まらなければ反対側) */
    side?: "top" | "bottom";
    padding?: number;
    accent?: string;
    /** このステップの前に切り替えるタブ */
    tab?: Tab;
    /** このステップに入るときにすること(モーダルを閉じるなど) */
    enter?: () => void;
    /** do / hint: 次へ進む条件 */
    until?: () => boolean;
};

/** 案内から、アプリの状態を見たり動かしたりするための窓口(App が用意する) */
export type GuideCtx = {
    setTab: (tab: Tab) => void;
    /** 登録のモーダルを開く(null で閉じる) */
    openRegister: (type: "habit" | "oneoff" | "rule" | null) => void;
    /** 目標タブ: チャートの作成を開く / 中心の画面に戻す(シートも閉じる) */
    goal: (kind: "wizard" | "center") => void;
    /** 設定のモーダルを開く */
    openSettings: (kind: "user" | "notification") => void;
    /** 今の状態(案内の条件で読む) */
    state: () => GuideState;
};

export type GuideState = {
    tasks: Task[];
    doneTaskIds: Set<string>;
    missedTaskIds: Set<string>;
    doingTaskIds: Set<string>;
    hasChart: boolean;
};

/** data-tutorial の値から要素を探す */
export function findTarget(target: string): HTMLElement | null {
    return document.querySelector<HTMLElement>(`[data-tutorial="${target}"]`);
}
