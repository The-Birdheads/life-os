import Toast from "../ui/Toast";
import Tabs from "../ui/Tabs";

type Tab = "today" | "review" | "week" | "register";

type Props = {
  userEmail: string | null;
  onSignOut: () => void;

  msg: string;

  tab: Tab;
  setTab: (t: Tab) => void;

  layoutStyle: React.CSSProperties;
  containerStyle: React.CSSProperties;
  toastWrapStyle: React.CSSProperties;
  toastStyle: React.CSSProperties;

  children: React.ReactNode;
};

export default function AppShell({
  userEmail,
  onSignOut,
  msg,
  tab,
  setTab,
  layoutStyle,
  containerStyle,
  toastWrapStyle,
  toastStyle,
  children,
}: Props) {
  return (
    <div style={layoutStyle}>
      <div style={containerStyle}>
        <div style={{ maxWidth: 720, margin: "40px auto", fontFamily: "sans-serif" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <h1 style={{ margin: 0 }}>Life OS</h1>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <small style={{ opacity: 0.7 }}>{userEmail}</small>
              <button onClick={onSignOut}>ログアウト</button>
            </div>
          </div>

          <hr />

          <Toast msg={msg} wrapStyle={toastWrapStyle} toastStyle={toastStyle} />
          <Tabs tab={tab} setTab={setTab} />

          {children}
        </div>
      </div>
    </div>
  );
}
