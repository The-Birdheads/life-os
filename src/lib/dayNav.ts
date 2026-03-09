import { todayJST } from "./day";

export function addDaysJST(day: string, delta: number) {
  // 端末のローカルタイムの深夜0時としてパースする（+09:00を強制すると、JST以外の端末で日付がズレるため）
  const d = new Date(`${day}T00:00:00`);
  d.setDate(d.getDate() + delta);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function clampDayToToday(d: string) {
  const maxDay = todayJST();
  return d <= maxDay ? d : maxDay;
}

export function getDayOffset(day: string, delta: number) {
  return addDaysJST(day, delta);
}

export function formatDisplayDate(day: string) {
  const d = new Date(`${day}T00:00:00`);
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  return `${d.getMonth() + 1}月${d.getDate()}日(${days[d.getDay()]})`;
}

export function getStartOfWeek(day: string) {
  const d = new Date(`${day}T00:00:00`);
  // 月曜(1)を週の開始とする。日曜は0なので、0なら-6、それ以外なら 1-d.getDay()
  const dayOfWeek = d.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  return addDaysJST(day, diff);
}

export function canGoNextDay(day: string) {
  const maxDay = todayJST();
  return day < maxDay;
}
