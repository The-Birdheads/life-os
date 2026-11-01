import { describe, it, expect } from 'vitest';
import { placeTooltip } from './spotlight';

// 画面 844px、上は広告とセーフエリアで 120px、下は 40px 空ける
const VH = 844;
const INSETS = { top: 120, bottom: 40 };

describe('placeTooltip', () => {
    it('uses the preferred side when it fits', () => {
        const spot = { x: 0, y: 400, w: 300, h: 60 };
        expect(placeTooltip(spot, 'bottom', 200, VH, INSETS)).toBe(472);
        expect(placeTooltip(spot, 'top', 200, VH, INSETS)).toBe(188);
    });

    it('flips to the other side when the preferred side does not fit', () => {
        const spot = { x: 0, y: 600, w: 300, h: 100 };
        // 下には 844-40-712=92px しかないので、上に置く
        expect(placeTooltip(spot, 'bottom', 200, VH, INSETS)).toBe(388);
    });

    it('keeps the tooltip on screen when neither side fits (large spot)', () => {
        const spot = { x: 0, y: 330, w: 360, h: 430 };
        const top = placeTooltip(spot, 'bottom', 260, VH, INSETS);
        expect(top).toBeGreaterThanOrEqual(INSETS.top);
        expect(top + 260).toBeLessThanOrEqual(VH - INSETS.bottom);
    });

    it('never goes under the ad at the top', () => {
        const spot = { x: 0, y: 140, w: 300, h: 40 };
        const top = placeTooltip(spot, 'top', 200, VH, INSETS);
        expect(top).toBeGreaterThanOrEqual(INSETS.top);
    });

    it('centers within the safe range when there is no spot', () => {
        const top = placeTooltip(null, 'top', 200, VH, INSETS);
        expect(top).toBe(INSETS.top + (VH - INSETS.top - INSETS.bottom - 200) / 2);
    });
});
