import { describe, it, expect } from 'vitest';
import type { Task } from '../types';
import { addDays, daysBetween, weekdayIndex, weekStart } from './dates';
import { changeFrequencyPatch, dayBit, frequencyAt, frequencyLabel, isScheduledOn } from './frequency';
import { cellRate, doneDaysByTask, habitProgress, weekCountStatus } from './progress';

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

describe('habitProgress', () => {
    it('daily: done days / days', () => {
        const p = habitProgress(habit(), days('2026-10-26', '2026-10-27', '2026-10-28'), WEEK);
        expect(p).toEqual({ done: 3, target: 7, rate: 43 });
    });

    it('counts only from the day it was linked (#5)', () => {
        const p = habitProgress(habit(), days('2026-10-31', '2026-11-01'), WEEK, { countFrom: '2026-11-01' });
        expect(p.rate).toBe(100);
        expect(p.target).toBe(1);
    });

    it('weekdays: counts scheduled days only, and ignores done on other days (#16)', () => {
        const t = habit({ frequency_kind: 'weekdays', frequency_days: MON_THU });
        const p = habitProgress(t, days('2026-10-29', '2026-10-30'), WEEK); // 木(予定)と金(予定外)
        expect(p).toEqual({ done: 1, target: 2, rate: 50 });
    });

    it('weekly count: caps at the weekly target', () => {
        const t = habit({ frequency_kind: 'weekly_count', frequency_count: 2 });
        expect(habitProgress(t, days('2026-10-26'), WEEK).rate).toBe(50);
        expect(habitProgress(t, days('2026-10-26', '2026-10-27', '2026-10-28'), WEEK).rate).toBe(100);
    });

    it('skips paused days (#17) and stops at the end date', () => {
        const paused = [{ from: '2026-10-29', to: '2026-11-01' }];
        expect(habitProgress(habit(), days('2026-10-26'), WEEK, { paused })).toEqual({ done: 1, target: 3, rate: 33 });
        expect(habitProgress(habit({ ended_at: '2026-10-27' }), days('2026-10-26'), WEEK).target).toBe(2);
    });

    it('uses the previous frequency for days before the change (#15)', () => {
        const t = habit({
            frequency_kind: 'daily',
            frequency_history: [{ from: null, to: '2026-10-29', kind: 'weekdays', count: null, days: MON_THU }],
        });
        // 月〜木は曜日指定(月・木の2日)、金〜日は毎日(3日)
        expect(habitProgress(t, days('2026-10-26', '2026-10-31'), WEEK)).toEqual({ done: 2, target: 5, rate: 40 });
    });

    it('returns null when there is no day to count', () => {
        expect(habitProgress(habit(), days(), WEEK, { countFrom: '2026-11-02' }).rate).toBeNull();
    });
});

describe('cellRate', () => {
    const cell = { text: '23時に寝る', status: 'active' as const, paused_periods: [] };
    const entries = [
        { task_id: 'a', day: '2026-11-01', status: 'done' as const },
        { task_id: 'b', day: '2026-10-26', status: 'done' as const },
        { task_id: 'b', day: '2026-10-26', status: 'todo' as const },
    ];
    const done = doneDaysByTask(entries);

    it('averages the counted habits and ignores ended ones', () => {
        const a = habit({ id: 'a', mandala_linked_at: '2026-11-01' }); // 100%
        const b = habit({ id: 'b' }); // 1/7 = 14%
        const ended = habit({ id: 'c', ended_at: '2026-10-30' });
        expect(cellRate(cell, [a, b, ended], done, WEEK)).toBe(57);
    });

    it('is null for empty or paused cells, and 100 for achieved cells', () => {
        expect(cellRate({ ...cell, text: '' }, [habit()], done, WEEK)).toBeNull();
        expect(cellRate({ ...cell, status: 'paused' }, [habit()], done, WEEK)).toBeNull();
        expect(cellRate({ ...cell, status: 'achieved' }, [], done, WEEK)).toBe(100);
        expect(cellRate(cell, [], done, WEEK)).toBeNull();
    });
});

describe('weekCountStatus', () => {
    it('counts this week (Monday to today)', () => {
        const t = habit({ frequency_kind: 'weekly_count', frequency_count: 2 });
        expect(weekCountStatus(t, days('2026-10-25', '2026-10-27'), '2026-11-01')).toEqual({ done: 1, target: 2 });
    });
});
