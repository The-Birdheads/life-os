export function todayJST(): string {
  // 端末のローカル日付を YYYY-MM-DD で返す（JST運用想定）
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}