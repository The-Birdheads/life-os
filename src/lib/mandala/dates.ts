/**
 * 日付(YYYY-MM-DD)の計算。タイムゾーンの影響を受けないよう、日付だけを扱う。
 */

function parts(day: string): [number, number, number] {
  const [y, m, d] = day.split("-").map(Number);
  return [y, m, d];
}

function format(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toUtc(day: string): Date {
  const [y, m, d] = parts(day);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDays(day: string, n: number): string {
  const date = toUtc(day);
  date.setUTCDate(date.getUTCDate() + n);
  return format(date);
}

/** from〜to(両端を含む)の日付の一覧。from > to なら空 */
export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** 曜日の番号。月=0, 火=1, … 日=6 */
export function weekdayIndex(day: string): number {
  return (toUtc(day).getUTCDay() + 6) % 7;
}

/** その日を含む週の月曜日 */
export function weekStart(day: string): string {
  return addDays(day, -weekdayIndex(day));
}

/** 保存時刻(ISO、UTC)を、端末の日付(YYYY/MM/DD)で表す */
export function localDateLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10).replace(/-/g, "/");
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

export function maxDay(...days: (string | null | undefined)[]): string | null {
  const valid = days.filter((d): d is string => !!d);
  return valid.length ? valid.reduce((a, b) => (a > b ? a : b)) : null;
}

export function minDay(...days: (string | null | undefined)[]): string | null {
  const valid = days.filter((d): d is string => !!d);
  return valid.length ? valid.reduce((a, b) => (a < b ? a : b)) : null;
}
