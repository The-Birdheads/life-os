import { describe, it, expect } from 'vitest';
import type { Task } from '../types';
import { addDays, daysBetween, weekdayIndex, weekStart } from './dates';
import { changeFrequencyPatch, dayBit, frequencyAt, frequencyLabel, isScheduledOn } from './frequency';
import { doneDaysByTask, weekCountStatus } from './progress';
import { cellTally } from './tally';

const habit = (patch: Partial<Task> = {}): Task => ({
    id: 'h1', user_id: 'u1', title: '習慣', task_type: 'habit', due_date: null,
    is_active: true, is_hidden: false, priority: 3, volume: 5,
    frequency_kind: 'daily', frequency_count: null, frequency_days: null, frequency_history: [],
    ...patch,
});
// 2026-10-26 は月曜日、2026-11-01 は日曜日
const WEEK = { from: '2026-10-26', to: '2026-11-01' };
const days = (...d: string[]) => new Set(d);
const MON_THU = dayBit(0) | dayBit(3);

describe('dates', () => {
    it('handles weekdays and week starts (Monday)', () => {
        expect(weekdayIndex('2026-10-26')).toBe(0);
        expect(weekdayIndex('2026-11-01')).toBe(6);
        expect(weekStart('2026-11-01')).toBe('2026-10-26');
        expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
        expect(daysBetween('2026-10-30', '2026-11-01')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01']);
    });
});

describe('frequency', () => {
    it('labels each kind', () => {
        expect(frequencyLabel({ kind: 'daily', count: null, days: null })).toBe('毎日');
        expect(frequencyLabel({ kind: 'weekly_count', count: 2, days: null })).toBe('週2回');
        expect(frequencyLabel({ kind: 'weekdays', count: null, days: MON_THU })).toBe('月・木');
    });

    it('treats only the chosen weekdays as scheduled', () => {
        const f = { kind: 'weekdays' as const, count: null, days: MON_THU };
        expect(isScheduledOn(f, '2026-10-26')).toBe(true);
        expect(isScheduledOn(f, '2026-10-27')).toBe(false);
        expect(isScheduledOn({ kind: 'weekly_count', count: 2, days: null }, '2026-10-27')).toBe(true);
    });

    it('keeps the previous frequency until yesterday when it is changed (#15)', () => {
        const t = habit({ frequency_kind: 'weekly_count', frequency_count: 3 });
        const patch = changeFrequencyPatch(t, { kind: 'weekly_count', count: 2, days: null }, '2026-11-01')!;
        expect(patch.frequency_count).toBe(2);
        expect(patch.frequency_history).toEqual([{ from: null, to: '2026-10-31', kind: 'weekly_count', count: 3, days: null }]);
        const changed = { ...t, ...patch };
        expect(frequencyAt(changed, '2026-10-31').count).toBe(3);
        expect(frequencyAt(changed, '2026-11-01').count).toBe(2);
    });

    it('does not add history for no change, or for a second change on the same day', () => {
        const t = habit();
        expect(changeFrequencyPatch(t, { kind: 'daily', count: null, days: null }, '2026-11-01')).toBeNull();
        const first = { ...t, ...changeFrequencyPatch(t, { kind: 'weekly_count', count: 2, days: null }, '2026-11-01')! };
        const second = changeFrequencyPatch(first, { kind: 'weekly_count', count: 3, days: null }, '2026-11-01')!;
        expect(second.frequency_history).toHaveLength(1);
        expect(second.frequency_count).toBe(3);
    });
});

describe('weekCountStatus', () => {
    it('counts this week (Monday to today)', () => {
        const t = habit({ frequency_kind: 'weekly_count', frequency_count: 2 });
        expect(weekCountStatus(t, days('2026-10-25', '2026-10-27'), '2026-11-01')).toEqual({ done: 1, target: 2 });
    });
});

describe('my rules (マイルール)', () => {
    it('counts only ○ (done) days; × (missed) and unanswered days count as not kept', () => {
        const rule = habit({ id: 'r1', task_type: 'rule', priority: 0, volume: 0 });
        const entries = [
            { task_id: 'r1', day: '2026-10-26', status: 'done' as const },
            { task_id: 'r1', day: '2026-10-27', status: 'missed' as const },
            { task_id: 'r1', day: '2026-10-28', status: 'done' as const },
        ];
        const done = doneDaysByTask(entries);
        expect(done.get('r1')).toEqual(days('2026-10-26', '2026-10-28'));
        const cell = { text: '早く寝る', status: 'active' as const, paused_periods: [] };
        // ○ の2日だけを数える(× と未記録は数えないが、減りもしない)
        expect(cellTally(cell, [rule], done, WEEK)?.count).toBe(2);
    });
});
