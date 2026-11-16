import { describe, it, expect } from 'vitest';
import type { ChartDraft } from './useMandala';
import { slotAt, slotOrder } from './gridSlots';

const emptyDraft = (): ChartDraft => ({
    title: '', endDate: null, elements: Array(8).fill(''), actions: Array.from({ length: 8 }, () => Array(8).fill('')),
});

describe('9×9 のマス', () => {
    it('まん中は大目標、中央のブロックのまわりと外側のブロックの真ん中は同じ要素', () => {
        expect(slotAt(4, 4)).toEqual({ kind: 'title' });
        // 中央のブロックの左上(要素1)と、左上のブロックの真ん中は同じ要素
        expect(slotAt(4, 0)).toEqual({ kind: 'element', e: 0 });
        expect(slotAt(0, 4)).toEqual({ kind: 'element', e: 0 });
        // 右下のブロックは要素8。その右下のマスは行動目標8
        expect(slotAt(8, 4)).toEqual({ kind: 'element', e: 7 });
        expect(slotAt(8, 8)).toEqual({ kind: 'action', e: 7, a: 7 });
        expect(slotAt(1, 3)).toEqual({ kind: 'action', e: 1, a: 3 });
    });

    it('書く順番は 大目標 → 要素 → 名前のある要素の行動目標', () => {
        const d = emptyDraft();
        expect(slotOrder(d)).toHaveLength(9);
        d.elements[2] = '睡眠';
        const order = slotOrder(d);
        expect(order).toHaveLength(17);
        expect(order[9]).toEqual({ kind: 'action', e: 2, a: 0 });
    });
});
