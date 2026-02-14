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

  const dateWrap: React.CSSProperties = {
    position: "relative",
    minWidth: 170,
    height: 44,
  };

  const dateDisplay: React.CSSProperties = {
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 16px",
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--card)",
    color: "var(--text)",
    fontWeight: 700,
    letterSpacing: "0.06em",
    fontSize: 18,
  };

  const overlayDateInput: React.CSSProperties = {
    position: "absolute",
    inset: 0,          // ✅ top/left/right/bottom を全部 0（ズレ防止）
    width: "100%",
    height: "100%",
    opacity: 0,        // ✅ 見えないが、クリック/タップは拾う
    cursor: "pointer",
    zIndex: 1,         // ✅ 表示の上に確実に乗せる
    border: "none",
    background: "transparent",
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

      <div style={dateWrap}>
        <div style={dateDisplay}>
          {day.replaceAll("-", " / ")}
        </div>

        <input
          ref={inputRef}
          type="date"
          value={day}
          max={maxDay}
          onChange={(e) => setDay(e.target.value)}
          aria-label="日付を選択"
          style={overlayDateInput}
          onPointerDown={() => {
            // ✅ Chrome系は showPicker が効く（ユーザー操作中ならOK）
            const el = inputRef.current as any;
            if (el?.showPicker) el.showPicker();
          }}
        />
      </div>


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
