import { describe, it, expect } from 'vitest';
import { parseJsonColumn, stringifyJsonColumn, toLocalValue, toRemoteRow } from './rowCodec';

describe('rowCodec', () => {
    it('sends JSON columns kept as TEXT on the device as real JSON (not as a JSON string)', () => {
        const local = { id: 't1', title: '習慣', frequency_history: '[{"from":null,"to":"2026-10-31","kind":"daily","count":null,"days":null}]', is_active: 1 };
        const remote = toRemoteRow('tasks', local);
        expect(remote.frequency_history).toEqual([{ from: null, to: '2026-10-31', kind: 'daily', count: null, days: null }]);
        expect(remote.is_active).toBe(1);
        expect(local.frequency_history).toEqual(expect.any(String)); // 元の行は変えない
    });

    it('leaves tables without JSON columns untouched', () => {
        const row = { id: 'e1', note: '[not json]' };
        expect(toRemoteRow('action_entries', row)).toBe(row);
    });

    it('stores JSON from the server as TEXT, with an empty value for null', () => {
        expect(toLocalValue('mandala_reviews', 'snapshot', { title: 'x' })).toBe('{"title":"x"}');
        expect(toLocalValue('mandala_cells', 'paused_periods', null)).toBe('[]');
        expect(toLocalValue('mandala_cells', 'text', undefined)).toBeNull();
    });

    it('falls back to the empty value for broken JSON', () => {
        expect(parseJsonColumn('{broken', [])).toEqual([]);
        expect(parseJsonColumn(null, {})).toEqual({});
        expect(stringifyJsonColumn(undefined, [])).toBe('[]');
    });
});
