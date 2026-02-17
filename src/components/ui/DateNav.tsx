import { useRef } from "react";

type Props = {
  day: string;

  // ✅ App.tsxで一元化した安全関数を渡す
  onPrev: () => void;
  onNext: () => void;
  canNext: boolean;

  // ✅ date input からの日付変更も安全関数（safeSetDay）に繋ぐ
  onPick: (d: string) => void;

  // ✅ input の max を App 側で渡す（例：todayJST()）
  maxDay: string;

  label?: string;
};

export default function DateNav({
  day,
  onPrev,
  onNext,
  canNext,
  onPick,
  maxDay,
}: Props) {
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
    whiteSpace: "nowrap",
  };

  const overlayDateInput: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    opacity: 0,
    cursor: "pointer",
    zIndex: 1,
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
      <button type="button" onClick={onPrev} aria-label="前日" style={navBtn}>
        ◀
      </button>

      <div style={dateWrap}>
        <div style={dateDisplay}>{day.replaceAll("-", " / ")}</div>

        <input
          ref={inputRef}
          type="date"
          value={day}
          max={maxDay}
          onChange={(e) => onPick(e.target.value)}
          aria-label="日付を選択"
          style={overlayDateInput}
          onPointerDown={() => {
            const el = inputRef.current as any;
            if (el?.showPicker) el.showPicker();
          }}
        />
      </div>

      <button
        type="button"
        onClick={() => {
          if (canNext) onNext();
        }}
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
