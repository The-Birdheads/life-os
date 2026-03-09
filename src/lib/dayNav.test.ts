import { describe, it, expect } from 'vitest';
import { getDayOffset, formatDisplayDate, getStartOfWeek } from './dayNav';

describe('dayNav utility', () => {
    it('getDayOffset should return correct day string', () => {
        // 2024-03-06 の 1日前は 2024-03-05
        expect(getDayOffset('2024-03-06', -1)).toBe('2024-03-05');
        // 1週前
        expect(getDayOffset('2024-03-06', -7)).toBe('2024-02-28');
    });

    it('formatDisplayDate should format ISO date to Japanese', () => {
        expect(formatDisplayDate('2024-03-06')).toBe('3月6日(水)');
    });

    it('getStartOfWeek should return the previous Monday', () => {
        // 2024-03-06 (水) の週の開始 (月曜) は 2024-03-04
        expect(getStartOfWeek('2024-03-06')).toBe('2024-03-04');
        // 2024-03-04 (月) 自身の場合はそのまま
        expect(getStartOfWeek('2024-03-04')).toBe('2024-03-04');
    });
});
