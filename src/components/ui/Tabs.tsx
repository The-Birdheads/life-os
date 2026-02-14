import React from "react";

type Tab = "today" | "review" | "week" | "register";

type Props = {
  tab: Tab;
  setTab: (t: Tab) => void;
};

export default function Tabs({ tab, setTab }: Props) {
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
      <button onClick={() => setTab("today")} disabled={tab === "today"}>
        記録
      </button>
      <button onClick={() => setTab("register")} disabled={tab === "register"}>
        登録
      </button>
      <button onClick={() => setTab("review")} disabled={tab === "review"}>
        振り返り
      </button>
      <button onClick={() => setTab("week")} disabled={tab === "week"}>
        週
      </button>
    </div>
  );
}
