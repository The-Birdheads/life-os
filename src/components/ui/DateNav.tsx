import { todayJST } from "../../lib/day";
import { useRef } from "react";


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

export default function DateNav({ day, setDay }: Props) {
  const maxDay = todayJST();
  const canNext = day < maxDay;
  const inputRef = useRef<HTMLInputElement>(null);


  const navBtn: React.CSSProperties = {
    width: 44,
    height: 44,
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--card)",
    color: "var(--text)",
    fontSize: 18,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "0.15s",
  };

  const dateDisplayBtn: React.CSSProperties = {
    minWidth: 170,
    textAlign: "center",
    padding: "10px 16px",
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--card)",
    color: "var(--text)",
    fontWeight: 700,
    letterSpacing: "0.06em",
    fontSize: 18,
    cursor: "pointer",
  };

  const hiddenDateInput: React.CSSProperties = {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
    pointerEvents: "none",
  };



  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: 14,
        width: "100%",
        position: "relative",
      }}
    >
      <button
        type="button"
        onClick={() => setDay(addDaysJST(day, -1))}
        aria-label="前日"
        style={navBtn}
      >
        ◀
      </button>

      <button
        type="button"
        style={dateDisplayBtn}
        aria-label="日付を選択"
        onClick={() => {
          const el = inputRef.current;
          if (!el) return;

          // Chromeなど対応ブラウザは showPicker() で確実に開く
          const anyEl = el as any;
          if (typeof anyEl.showPicker === "function") anyEl.showPicker();
          else {
            // フォールバック
            el.focus();
            el.click();
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            (e.currentTarget as HTMLButtonElement).click();
          }
        }}
      >
        {day.replaceAll("-", " / ")}
      </button>
      <input
        ref={inputRef}
        type="date"
        value={day}
        max={maxDay}
        onChange={(e) => setDay(e.target.value)}
        tabIndex={-1}
        aria-hidden="true"
        style={hiddenDateInput}
      />


      <button
        type="button"
        onClick={() => setDay(addDaysJST(day, +1))}
        disabled={!canNext}
        aria-label="翌日"
        style={{
          ...navBtn,
          opacity: canNext ? 1 : 0.4,
          cursor: canNext ? "pointer" : "default",
        }}
      >
        ▶
      </button>
    </div>
  );

}
