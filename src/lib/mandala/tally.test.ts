import { describe, it, expect } from 'vitest';
import type { Task } from '../types';
import { buildChartModel, tasksByCell } from './chart';
import {
    cellTally, chartPeriod, countLevel, countText, elementTally, lastDoneText, taskTally, weekDays, weekDoneDays,
} from './tally';

const habit = (id: string, patch: Partial<Task> = {}): Task => ({
    id, user_id: 'u1', title: id, task_type: 'habit', due_date: null, is_active: true, is_hidden: false, priority: 0, volume: 0,
    frequency_kind: 'daily', frequency_count: null, frequency_days: null, frequency_history: [], ...patch,
});
const days = (...d: string[]) => new Set(d);
// 2026-10-26 は月曜日
const PERIOD = { from: '2026-10-01', to: '2026-10-28' };

describe('taskTally', () => {
    it('counts done days in the period, and skips paused days', () => {
        const t = taskTally(days('2026-09-30', '2026-10-05', '2026-10-20', '2026-10-27', '2026-10-29'), PERIOD, [{ from: '2026-10-19', to: '2026-10-21' }]);
        expect(t.count).toBe(2);
        expect([...t.days].sort()).toEqual(['2026-10-05', '2026-10-27']);
        expect(t.last).toBe('2026-10-27');
    });
});

describe('cellTally / elementTally', () => {
    const cell = { text: '23時に寝る', paused_periods: [] };
    const done = new Map([
        ['a', days('2026-10-26', '2026-10-27')],
        ['b', days('2026-10-27')],
        ['ended', days('2026-10-02')],
    ]);

    it('adds up every linked task (two on the same day count twice), including ended ones', () => {
        const t = cellTally(cell, [habit('a'), habit('b'), habit('ended', { ended_at: '2026-10-10', is_hidden: true })], done, PERIOD)!;
        expect(t.count).toBe(4);
        expect(t.days.size).toBe(3);
        expect(t.last).toBe('2026-10-27');
    });

    it('is null for an empty cell, and 0 for a cell with nothing done yet', () => {
        expect(cellTally({ ...cell, text: ' ' }, [habit('a')], done, PERIOD)).toBeNull();
        expect(cellTally(cell, [], done, PERIOD)?.count).toBe(0);
    });

    it('sums the action goals of an element, and is null for an unnamed element', () => {
        const chart = { id: 'c1', user_id: 'u1', title: 'x', start_date: '2026-10-01', end_date: null, status: 'active' as const };
        const mk = (id: string, e: number, a: number | null, text: string) => ({
            id, user_id: 'u1', chart_id: 'c1', element_index: e, cell_index: a, text, color: null, status: 'active' as const, paused_periods: [],
        });
        const model = buildChartModel(chart, [mk('e0', 0, null, '睡眠'), mk('c0', 0, 0, '早く寝る'), mk('c1', 0, 1, '朝日を浴びる')]);
        const byCell = tasksByCell([habit('a', { mandala_cell_id: 'c0' }), habit('b', { mandala_cell_id: 'c1' })]);
        expect(elementTally(model.elements[0], byCell, done, PERIOD)?.count).toBe(3);
        expect(elementTally(model.elements[1], byCell, done, PERIOD)).toBeNull();
    });
});

describe('levels and labels', () => {
    it('gets darker at 1, 10 and 30 times; achieved cells are the darkest', () => {
        expect([0, 1, 9, 10, 29, 30].map((n) => countLevel(n))).toEqual([0, 1, 1, 2, 2, 3]);
        expect(countLevel(0, true)).toBe(3);
    });

    it('shows the count, or まだ when nothing is done yet', () => {
        expect(countText(12)).toBe('12回');
        expect(countText(0)).toBe('まだ');
    });

    it('describes the last done day', () => {
        expect(lastDoneText('2026-10-28', '2026-10-28')).toBe('今日');
        expect(lastDoneText('2026-10-27', '2026-10-28')).toBe('昨日');
        expect(lastDoneText('2026-10-16', '2026-10-28')).toBe('12日前');
        expect(lastDoneText(null, '2026-10-28')).toBe('まだ');
    });

    it('counts the days done this week (Monday to today)', () => {
        expect(weekDays('2026-10-28')).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']);
        expect(weekDoneDays({ count: 3, days: days('2026-10-25', '2026-10-26', '2026-10-28'), last: null }, '2026-10-28')).toBe(2);
        expect(weekDoneDays(null, '2026-10-28')).toBe(0);
    });

    it('counts from the chart start until the day', () => {
        expect(chartPeriod('2026-10-28', '2026-10-01')).toEqual(PERIOD);
        expect(chartPeriod('2026-10-28', null)).toEqual({ from: '2026-10-28', to: '2026-10-28' });
    });
});
