import { describe, it, expect } from 'vitest';
import type { MandalaCell, MandalaChart, Task } from '../types';
import { buildChartModel, tasksByCell } from './chart';
import { doneDaysByTask } from './progress';
import { buildSnapshot, describeDecision, parseSnapshot } from './review';

const chart: MandalaChart = { id: 'c1', user_id: 'u1', title: '健康的な体をつくる', start_date: '2026-10-01', end_date: null, status: 'active' };
const cell = (id: string, e: number, a: number | null, text: string, patch: Partial<MandalaCell> = {}): MandalaCell => ({
    id, user_id: 'u1', chart_id: 'c1', element_index: e, cell_index: a, text, color: null, status: 'active', paused_periods: [], ...patch,
});
const habit = (id: string, title: string, cellId: string, patch: Partial<Task> = {}): Task => ({
    id, user_id: 'u1', title, task_type: 'habit', due_date: null, is_active: true, is_hidden: false, priority: 3, volume: 5,
    frequency_kind: 'daily', frequency_count: null, frequency_days: null, frequency_history: [], mandala_cell_id: cellId, ...patch,
});
const WEEK = { from: '2026-10-26', to: '2026-11-01' };

describe('buildSnapshot', () => {
    const cells = [
        cell('e1', 1, null, '睡眠'),
        cell('a1', 1, 0, '23時に寝る'),
        cell('a2', 1, 1, 'スマホを寝室に持ち込まない', { status: 'paused' }),
        cell('a3', 1, 2, ''),
    ];
    const tasks = [
        habit('t1', '23時に布団に入る', 'a1'),
        habit('t2', 'ジムに行く', 'a1', { frequency_kind: 'weekly_count', frequency_count: 2 }),
        habit('t3', '終えた習慣', 'a1', { ended_at: '2026-10-20', is_hidden: true }),
    ];
    const done = doneDaysByTask([
        { task_id: 't1', day: '2026-10-26', status: 'done' },
        { task_id: 't1', day: '2026-10-27', status: 'done' },
        { task_id: 't2', day: '2026-10-28', status: 'done' },
    ]);
    const snap = buildSnapshot(buildChartModel(chart, cells), tasksByCell(tasks), done, WEEK);

    it('keeps the chart before the review, with the rates at that time', () => {
        expect(snap.title).toBe('健康的な体をつくる');
        const sleep = snap.elements[1];
        expect(sleep.name).toBe('睡眠');
        expect(sleep.cells.map((c) => c.text)).toEqual(['23時に寝る', 'スマホを寝室に持ち込まない']);
        // t1: 2/7 = 29%、t2: 週2回のうち1回 = 50% → 平均 40%(四捨五入)
        expect(sleep.cells[0].rate).toBe(40);
        expect(sleep.cells[0].tasks.map((t) => `${t.title}:${t.frequency}`)).toEqual(['23時に布団に入る:毎日', 'ジムに行く:週2回']);
        expect(sleep.cells[1]).toMatchObject({ status: 'paused', rate: null });
        expect(sleep.rate).toBe(40);
        expect(snap.elements[0].rate).toBeNull();
    });

    it('can be read back from JSON', () => {
        expect(parseSnapshot(JSON.parse(JSON.stringify(snap)))?.elements[1].name).toBe('睡眠');
        expect(parseSnapshot({})).toBeNull();
    });
});

describe('describeDecision', () => {
    const tasks = [habit('t2', 'ジムに行く', 'a1', { frequency_kind: 'weekly_count', frequency_count: 3 })];

    it('describes each kind of decision for the review record', () => {
        expect(describeDecision('運動', 'ジムに週3回行く', {
            kind: 'lower', taskId: 't2', title: 'ジムに行く', frequency: { kind: 'weekly_count', count: 2, days: null },
        }, tasks)).toBe('運動 › ジムに週3回行く：ハードルを下げる（ジムに行く（週3回） → ジムに行く（週2回））');
        expect(describeDecision('運動', 'ジムに週3回行く', {
            kind: 'change', newText: '家で筋トレする', newHabit: { title: 'スクワット10回', frequency: { kind: 'daily', count: null, days: null } },
        }, tasks)).toBe('運動 › ジムに週3回行く：やり方を変える（「家で筋トレする」に変更、習慣「スクワット10回」（毎日）を開始）');
        expect(describeDecision('運動', '階段を使う', { kind: 'remove', endHabits: false }, tasks))
            .toBe('運動 › 階段を使う：目標から外す（習慣は記録タブに残す）');
    });
});
