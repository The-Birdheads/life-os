import { todayJST } from "./day";

export function addDaysJST(day: string, delta: number) {
  const d = new Date(`${day}T00:00:00+09:00`);
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

export function canGoNextDay(day: string) {
  const maxDay = todayJST();
  return day < maxDay;
}
