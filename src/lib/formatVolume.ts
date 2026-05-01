/**
 * Converts a volume value (1-10) to a human-readable label based on volumeUnit setting.
 * @param volume  1-10 raw volume value
 * @param volumeUnit '15' | '30' | '60' | 'none'
 */
export function formatVolumeLabel(volume: number, volumeUnit: string): string {
  if (volumeUnit === "none") return String(volume);
  const mins = volume * Number(volumeUnit);
  if (mins < 60) return `${mins}分`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}時間${m}分` : `${h}時間`;
}
