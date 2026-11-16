/**
 * チャートを 9×9 の表で作るときの、マスの並び(紙のマンダラチャートと同じ)。
 * 要素は、中央のブロックのまわりと、外側のブロックの真ん中の2か所に出る
 */
import { AROUND } from "./chart";
import type { ChartDraft } from "./useMandala";

/** 9×9 のどのマスか。要素は、中央のブロックと、まわりのブロックの真ん中の2か所に出る */
export type Slot = { kind: "title" } | { kind: "element"; e: number } | { kind: "action"; e: number; a: number };

/** 9×9 の位置(ブロック bp・ブロック内 q、どちらも 0〜8) → マス */
export function slotAt(bp: number, q: number): Slot {
    if (bp === 4) return q === 4 ? { kind: "title" } : { kind: "element", e: AROUND.indexOf(q as (typeof AROUND)[number]) };
    const e = AROUND.indexOf(bp as (typeof AROUND)[number]);
    return q === 4 ? { kind: "element", e } : { kind: "action", e, a: AROUND.indexOf(q as (typeof AROUND)[number]) };
}

export const sameSlot = (x: Slot, y: Slot) =>
    x.kind === y.kind && (x.kind === "title" || (x.e === (y as { e: number }).e && (x.kind !== "action" || x.a === (y as { a: number }).a)));

/**
 * 書く順番: 大目標 → 要素(8つ) → 要素ごとの行動目標。名前の無い要素の行動目標は飛ばす
 * (要素の名前が無いと、行動目標は保存されないため)
 */
export function slotOrder(draft: ChartDraft): Slot[] {
    const out: Slot[] = [{ kind: "title" }];
    for (let e = 0; e < 8; e++) out.push({ kind: "element", e });
    for (let e = 0; e < 8; e++) {
        if (!draft.elements[e].trim()) continue;
        for (let a = 0; a < 8; a++) out.push({ kind: "action", e, a });
    }
    return out;
}
