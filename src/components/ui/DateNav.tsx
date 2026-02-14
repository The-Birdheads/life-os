import { todayJST } from "../../lib/day";

function addDaysJST(day: string, delta: number) {
  const d = new Date(`${day}T00:00:00+09:00`);
  d.setDate(d.getDate() + delta);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

type Props = {
  day: string;
  setDay: (d: string) => void;
  label?: string;
};

export default function DateNav({ day, setDay, label }: Props) {
  const maxDay = todayJST();
  const canNext = day < maxDay;

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: 10,
        width: "100%",
      }}
    >
      {label ? <b>{label}</b> : null}

      <button type="button" onClick={() => setDay(addDaysJST(day, -1))} aria-label="前日">
        ◀
      </button>

      <input
        type="date"
        value={day}
        max={maxDay}
        onChange={(e) => setDay(e.target.value)}
        aria-label="日付を選択"
        style={{
          padding: "6px 10px",
          borderRadius: 8,
          background: "#f3f4f6",
          border: "1px solid #e5e7eb",
          fontWeight: 700,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      />

      <button
        type="button"
        onClick={() => setDay(addDaysJST(day, +1))}
        disabled={!canNext}
        aria-label="翌日"
      >
        ▶
      </button>
    </div>
  );
}
