import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import { todayJST } from "./lib/day";
import type { Action, Task } from "./lib/types";
import AuthView from "./views/AuthView";
import AppShell from "./views/AppShell";
import WeekView from "./views/WeekView";
import ReviewView from "./views/ReviewView";
import RegisterView from "./views/RegisterView";
import TodayView from "./views/TodayView";
import { fetchTodayEntries } from "./lib/api/today";




type Tab = "today" | "review" | "week" | "register";
type Mode = "signIn" | "signUp";

const theme = {
  bg: "var(--bg)",
  text: "var(--text)",
  card: "var(--card)",
  border: "var(--border)",
  toastBg: "var(--toast-bg)",
  toastText: "var(--toast-text)",
};

const cardStyle = {
  background: theme.card,
  border: `1px solid ${theme.border}`,
  borderRadius: 12,
  padding: 14,
};


export default function App() {
  // ------- Auth -------
  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [msg, setMsg] = useState<string>("");

  useEffect(() => {
    if (!msg) return;

    const t = setTimeout(() => {
      setMsg("");
    }, 3000);

    return () => clearTimeout(t);
  }, [msg]);

  const [todayActionEntries, setTodayActionEntries] = useState<any[]>([]);

  // ------- UI -------
  const [tab, setTab] = useState<Tab>("today");
  useEffect(() => {
    setMsg("");
  }, [tab]);
  const [day, setDay] = useState(() => todayJST());
  const layoutStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "center",
    width: "100%",
    background: theme.bg,
    color: theme.text,
    minHeight: "100vh",
  };

  const containerStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: 720,
    margin: "0 auto",
    padding: "0 12px",
    boxSizing: "border-box",
  };


  const toastWrapStyle: React.CSSProperties = {
    position: "fixed",
    top: 12,
    left: 0,
    right: 0,
    display: "flex",
    justifyContent: "center",
    pointerEvents: "none", // 背後のUI操作を邪魔しない
    zIndex: 9999,
    padding: "0 12px",
    boxSizing: "border-box",
  };


  const toastStyle: React.CSSProperties = {
    pointerEvents: "auto",
    maxWidth: 720,
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: theme.toastBg,
    color: theme.toastText,
    boxShadow: "0 6px 18px rgba(0,0,0,0.12)",
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)",
    fontSize: 14,
  };


  // ------- Data -------
  const [tasks, setTasks] = useState<Task[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [doneTaskIds, setDoneTaskIds] = useState<Set<string>>(new Set());
  const [doneTaskIdsAnyDay, setDoneTaskIdsAnyDay] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [fulfillment, setFulfillment] = useState<number>(0);


  // ------- Auth init -------
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null;
      setUserId(u?.id ?? null);
      setUserEmail(u?.email ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUserId(u?.id ?? null);
      setUserEmail(u?.email ?? null);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");

    try {
      if (mode === "signUp") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMsg("登録しました。");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setMsg("ログインしました。");
      }
    } catch (err: any) {
      setMsg(err?.message ?? "エラーが発生しました。");
    }
  }

  async function signOut() {
    setMsg("");
    await supabase.auth.signOut();
  }

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // ログイン後に戻したい場所（例：トップ）
        redirectTo: window.location.origin,
      },
    });

    if (error) throw error;
  }

  // async function linkGoogle() {
  //   const { data, error } = await supabase.auth.linkIdentity({ provider: "google" });
  //   if (error) throw error;
  // ブラウザ実行なら通常はリダイレクトして戻ってきます
  // }


  // ------- Load base data -------
  async function loadBase() {
    if (!userId) return;

    const { data: t, error: tErr } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", userId)
      .order("due_date", { ascending: true, nullsFirst: false })

    if (tErr) throw tErr;
    setTasks((t ?? []) as any);

    const { data: a, error: aErr } = await supabase
      .from("actions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })

    if (aErr) throw aErr;
    setActions((a ?? []) as any);
  }

  async function loadTodayEntries() {
  if (!userId) return;

  const res = await fetchTodayEntries({
    supabase,
    userId,
    day,
  });

  setDoneTaskIds(res.doneTaskIds);
  setDoneTaskIdsAnyDay(res.doneTaskIdsAnyDay);
  setTodayActionEntries(res.todayActionEntries);
}


  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        await loadBase();
      } catch (e: any) {
        setMsg(e?.message ?? "読み込みエラー");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        await loadTodayEntries();
      } catch (e: any) {
        setMsg(e?.message ?? "読み込みエラー");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, day]);


  // ------- Insert helpers -------





  // ------- Render -------
  if (!userId) { //ログイン前
    return (
      <AuthView
        mode={mode}
        setMode={setMode}
        email={email}
        setEmail={setEmail}
        password={password}
        setPassword={setPassword}
        onSubmit={onSubmit}
        signInWithGoogle={signInWithGoogle}
        layoutStyle={layoutStyle}
        containerStyle={containerStyle}
      />
    );
  }
  // ログイン後
  return (
    <AppShell
      userEmail={userEmail}
      onSignOut={signOut}
      msg={msg}
      tab={tab}
      setTab={setTab}
      layoutStyle={layoutStyle}
      containerStyle={containerStyle}
      toastWrapStyle={toastWrapStyle}
      toastStyle={toastStyle}
    >
      {tab === "today" && (
        <TodayView
          userId={userId}
          day={day}
          setDay={setDay}
          tasks={tasks}
          actions={actions}
          doneTaskIds={doneTaskIds}
          setDoneTaskIds={setDoneTaskIds}
          doneTaskIdsAnyDay={doneTaskIdsAnyDay}
          todayActionEntries={todayActionEntries}
          setMsg={setMsg}
          supabase={supabase}
          cardStyle={cardStyle}
          loadTodayEntries={loadTodayEntries}
        />
      )}
      {tab === "register" && (
        <RegisterView
          userId={userId}
          tasks={tasks}
          actions={actions}
          doneTaskIdsAnyDay={doneTaskIdsAnyDay}
          setMsg={setMsg}
          supabase={supabase}
          cardStyle={cardStyle}
          loadBase={loadBase}
        />
      )}
      {tab === "review" && (
        <ReviewView
          userId={userId}
          day={day}
          setDay={setDay}
          tasks={tasks}
          doneTaskIds={doneTaskIds}
          actions={actions}
          todayActionEntries={todayActionEntries}
          note={note}
          setNote={setNote}
          fulfillment={fulfillment}
          setFulfillment={setFulfillment}
          setMsg={setMsg}
          supabase={supabase}
          cardStyle={cardStyle}
        />
      )}
      {tab === "week" && (
        <WeekView
          userId={userId}
          tasks={tasks}
          day={day}
          setDay={setDay}
          setTab={setTab}
          setMsg={setMsg}
          supabase={supabase}
          cardStyle={cardStyle}
        />
      )}

    </AppShell>
  );

}
