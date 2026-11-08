/**
 * 同期(サーバー → 端末)で、サーバーの行を端末に取り込むかの判断。
 *
 * ふつうは更新時刻(updated_at)が新しいほうを残す。
 * ただし更新時刻が同じなのに中身が違うときは、端末で更新時刻を変えずに書き換えたもの
 * (以前のログイン時の統合が、同じ名前のタスクの記録を別のタスクへ付け替えていた)なので、
 * サーバーの値に戻す。サーバーへは、更新時刻が新しくないので送られていない。
 */

/** 更新時刻が同じときに見比べる列(統合で書き換わっていた列) */
export const DRIFT_COLUMNS: Partial<Record<string, readonly string[]>> = {
    task_entries: ["day", "task_id", "status"],
    mandala_cell_events: ["task_id"],
    tasks: ["mandala_cell_id", "mandala_linked_at"],
};

/** 更新時刻(ISO)をミリ秒に。読めなければ 0 */
export function timeOf(iso: string | null | undefined): number {
    const t = iso ? new Date(iso).getTime() : NaN;
    return Number.isNaN(t) ? 0 : t;
}

const norm = (v: unknown) => (v === undefined || v === null || v === "" ? null : String(v));

export function shouldPull(table: string, local: Record<string, any> | undefined, remote: Record<string, any>): boolean {
    if (!local) return true;
    const l = timeOf(local.updated_at);
    const r = timeOf(remote.updated_at);
    if (r > l) return true;
    if (r < l) return false;
    return (DRIFT_COLUMNS[table] ?? []).some((c) => c in local && norm(local[c]) !== norm(remote[c]));
}
