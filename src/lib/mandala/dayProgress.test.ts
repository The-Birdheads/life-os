import { describe, it, expect } from 'vitest';
import type { MandalaCell, MandalaChart, Task } from '../types';
import { buildChartModel, tasksByCell } from './chart';
import { dayProgress, gain } from './dayProgress';
import { doneDaysByTask } from './progress';
import { buildWidgetMandala } from './widget';

const chart: MandalaChart = { id: 'c1', user_id: 'u1', title: '健康的な体をつくる', start_date: '2026-10-01', end_date: null, status: 'active' };
const cell = (id: string, e: number, a: number | null, text: string, patch: Partial<MandalaCell> = {}): MandalaCell => ({
    id, user_id: 'u1', chart_id: 'c1', element_index: e, cell_index: a, text, color: null, status: 'active', paused_periods: [], ...patch,
});
const habit = (id: string, title: string, cellId: string, patch: Partial<Task> = {}): Task => ({
    id, user_id: 'u1', title, task_type: 'habit', due_date: null, is_active: true, is_hidden: false, priority: 0, volume: 0,
    frequency_kind: 'daily', frequency_count: null, frequency_days: null, frequency_history: [], mandala_cell_id: cellId, ...patch,
});
const DAY = '2026-11-01';

const cells = [
    cell('e0', 0, null, '運動'),
    cell('a0', 0, 0, '毎朝走る'),
    cell('a1', 0, 1, '階段を使う'),
    cell('e1', 1, null, '睡眠'),
    cell('b0', 1, 0, '23時に寝る'),
    cell('b1', 1, 1, '夜にスマホを見ない', { status: 'achieved' }),
    cell('b2', 1, 2, '昼寝しない', { status: 'paused' }),
];
const tasks = [
    habit('t1', '朝ラン', 'a0'),
    habit('t2', '階段', 'a1'),
    habit('t3', '布団に入る', 'b0'),
    { ...habit('t4', '本を返す', 'a1'), task_type: 'oneoff' as const },
];
const done = doneDaysByTask([
    { task_id: 't1', day: '2026-10-31', status: 'done' },
    { task_id: 't1', day: DAY, status: 'done' },
    { task_id: 't4', day: DAY, status: 'done' },
    { task_id: 't3', day: '2026-10-30', status: 'done' },
]);
const model = buildChartModel(chart, cells);

describe('dayProgress', () => {
    const p = dayProgress(model, tasksByCell(tasks), done, DAY, new Set(['b1']));

    it('lists the action goals moved forward on that day, in chart order', () => {
        expect(p.cells.map((c) => c.cell.text)).toEqual(['毎朝走る', '階段を使う', '夜にスマホを見ない']);
        expect(p.cells[0].doneTasks.map((t) => t.title)).toEqual(['朝ラン']);
        expect(p.cells[2]).toMatchObject({ achieved: true, after: 100, doneTasks: [] });
    });

    it('compares the rate without and with that day', () => {
        // 朝ラン: 1/7 = 14% → 2/7 = 29%
        expect(p.cells[0]).toMatchObject({ before: 14, after: 29 });
        expect(gain(p.cells[0])).toBe(15);
        // 階段(0%) と 本を返す(0% → 100%) の平均
        expect(p.cells[1]).toMatchObject({ before: 0, after: 50 });
        // 直接達成にする前は、ひもづいた習慣・タスクが無いので未着手
        expect(p.cells[2].before).toBeNull();
    });

    it('averages the element rates the same way as the goal tab', () => {
        expect(p.elements[0]).toEqual({ index: 0, before: 7, after: 40 });
        // 23時に寝る 1/7 = 14%、達成 100% → 達成の前は 14%
        expect(p.elements[1]).toEqual({ index: 1, before: 14, after: 57 });
        expect(p.elements[2]).toEqual({ index: 2, before: null, after: null });
    });

    it('is empty on a day with nothing done', () => {
        expect(dayProgress(model, tasksByCell(tasks), done, '2026-10-29').cells).toEqual([]);
    });
});

describe('buildWidgetMandala', () => {
    const w = buildWidgetMandala(model, tasksByCell(tasks), done, { from: '2026-10-26', to: DAY });

    it('passes the chart as levels for the widget', () => {
        expect(w.title).toBe('健康的な体をつくる');
        expect(w.elements[0]).toMatchObject({ name: '運動', rate: 40, level: 2 });
        expect(w.elements[0].cells.slice(0, 3)).toEqual([
            { text: '毎朝走る', level: 1 },
            { text: '階段を使う', level: 2 },
            { text: '', level: -1 },
        ]);
        expect(w.elements[1].cells[2]).toEqual({ text: '昼寝しない', level: -1 });
        expect(w.elements[2]).toMatchObject({ name: '', rate: -1, level: -1 });
        expect(w.todayCount).toBe(2);
    });
});
