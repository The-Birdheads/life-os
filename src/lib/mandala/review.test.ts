import { describe, it, expect } from 'vitest';
import type { MandalaCell, MandalaChart, Task } from '../types';
import { buildChartModel, tasksByCell } from './chart';
import { doneDaysByTask } from './progress';
import { buildSnapshot, describeDecision, hasCounts, parseSnapshot, recordKind, recountSnapshot, type ReviewSnapshot } from './review';

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

    it('keeps the chart before the review, with the counts until then', () => {
        expect(snap.title).toBe('健康的な体をつくる');
        const sleep = snap.elements[1];
        expect(sleep.name).toBe('睡眠');
        expect(sleep.cells.map((c) => c.text)).toEqual(['23時に寝る', 'スマホを寝室に持ち込まない']);
        // t1 の2回と t2 の1回(割合ではなく回数)
        expect(sleep.cells[0].count).toBe(3);
        expect(sleep.cells[0].tasks.map((t) => `${t.title}:${t.frequency}:${t.count}`)).toEqual(['23時に布団に入る:毎日:2', 'ジムに行く:週2回:1']);
        expect(sleep.cells[1]).toMatchObject({ status: 'paused', count: 0 });
        expect(sleep.count).toBe(3);
        expect(snap.elements[0].count).toBe(0);
        expect(hasCounts(snap)).toBe(true);
    });

    it('can be read back from JSON', () => {
        expect(parseSnapshot(JSON.parse(JSON.stringify(snap)))?.elements[1].name).toBe('睡眠');
        expect(parseSnapshot({})).toBeNull();
    });
});

describe('recountSnapshot', () => {
    const cells = [cell('e1', 1, null, '睡眠'), cell('a1', 1, 0, '23時に寝る')];
    const model = buildChartModel(chart, cells);
    // 回数を数える前の記録(割合だけ)
    const old: ReviewSnapshot = {
        title: '健康的な体をつくる', period: WEEK,
        elements: [
            { index: 0, name: '', color: '#000', rate: null, cells: [] },
            { index: 1, name: '睡眠', color: '#000', rate: 40, cells: [{ index: 0, text: '23時に寝る', status: 'active', rate: 40, tasks: [{ title: '23時に布団に入る', type: 'habit', frequency: '毎日', rate: 29 }] }] },
        ],
    };
    const done = doneDaysByTask([
        { task_id: 't1', day: '2026-10-05', status: 'done' },
        { task_id: 't1', day: '2026-10-27', status: 'done' },
        { task_id: 't1', day: '2026-11-02', status: 'done' }, // 保存した日より後は数えない
        { task_id: 't9', day: '2026-10-27', status: 'done' }, // ひもづいていない
    ]);

    it('counts from the chart start until the day it was saved, using the tasks linked to the cell', () => {
        const linked = new Map([['a1', new Set(['t1'])]]);
        const r = recountSnapshot(old, model, linked, done, [{ id: 't1', title: '23時に布団に入る' }]);
        expect(r.period).toEqual({ from: '2026-10-01', to: '2026-11-01' });
        expect(r.elements[1].count).toBe(2);
        expect(r.elements[1].cells[0].count).toBe(2);
        expect(r.elements[1].cells[0].tasks[0].count).toBe(2);
        expect(hasCounts(old)).toBe(false);
    });

    it('leaves records that already have counts as they are', () => {
        const withCounts = { ...old, elements: old.elements.map((e) => ({ ...e, count: 5 })) };
        expect(recountSnapshot(withCounts, model, new Map(), done, [])).toBe(withCounts);
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

describe('recordKind', () => {
    it('tells saves apart from reviews by snapshot.kind', () => {
        expect(recordKind({ snapshot: { title: 'a', elements: [] } })).toBe('review');
        expect(recordKind({ snapshot: { title: 'a', elements: [], kind: 'save' } })).toBe('save');
        expect(recordKind({ snapshot: { title: 'a', elements: [], kind: 'final' } })).toBe('final');
        expect(recordKind({ snapshot: { kind: 'other' } })).toBe('review');
    });
});
