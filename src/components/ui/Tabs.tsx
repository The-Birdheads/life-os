
type Tab = "today" | "register" | "review" | "week";

type Props = {
  tab: Tab;
  setTab: (t: Tab) => void;
};

const tabList: { key: Tab; label: string }[] = [
  { key: "today", label: "記録" },
  { key: "register", label: "編集" },
  { key: "review", label: "振り返り" },
  { key: "week", label: "週" },
];

export default function Tabs({ tab, setTab }: Props) {
  return (
    <nav
      aria-label="メインナビゲーション"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        gap: 8,
        overflowX: "hidden",
      }}
    >
      {tabList.map((t) => {
        const active = tab === t.key;

        return (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            aria-current={active ? "page" : undefined}
            style={{
              width: "100%",
              minWidth: 0,
              padding: "10px 6px",
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: active ? "var(--card)" : "transparent",

              // ✅ ここを修正：ライト/ダーク両対応
              color: "var(--text)",
              opacity: active ? 1 : 0.72, // 未選択は薄くするだけ

              fontWeight: 800,
              cursor: "pointer",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              transition: "0.15s",
            }}
          >
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}
