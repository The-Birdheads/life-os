import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import { todayJST } from "./lib/day";
import { clampDayToToday, addDaysJST, canGoNextDay } from "./lib/dayNav";
import type { Action, Task } from "./lib/types";
import AuthView from "./views/AuthView";
import AppShell from "./views/AppShell";
import WeekView from "./views/WeekView";
import ReviewView from "./views/ReviewView";
import RegisterView from "./views/RegisterView";
import TodayView from "./views/TodayView";
import { fetchTodayEntries } from "./lib/api/today";
import { fetchBase } from "./lib/api/base";
import {
  cardStyle,
  layoutStyle,
  containerStyle,
  toastWrapStyle,
  toastStyle,
} from "./lib/ui/style";

type Tab = "today" | "review" | "week" | "register";
type Mode = "signIn" | "signUp";

function toHeaderDateLabel(dayISO: string) {
  const [y, m, d] = dayISO.split("-");
  return `${y} / ${m} / ${d}`;
}

export default function App() {
  // ------- Auth -------
  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(""), 3000);
    return () => clearTimeout(t);
  }, [msg]);

  // ------- UI -------
  const [tab, setTab] = useState<Tab>("today");

  useEffect(() => {
    setMsg("");
  }, [tab]);

  // ⭐ 日付状態（唯一の真実）
  const [day, _setDay] = useState(() => todayJST());

  // ⭐ 安全 setter（全経路ここ通過）
  const safeSetDay = (d: string) => {
    _setDay(clampDayToToday(d));
  };

  // ⭐ 日付移動も統一
  const safeShiftDay = (delta: number) => {
    safeSetDay(addDaysJST(day, delta));
  };

  const canNext = canGoNextDay(day);

  // ------- Data -------
  const [tasks, setTasks] = useState<Task[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [doneTaskIds, setDoneTaskIds] = useState<Set<string>>(new Set());
  const [doneTaskIdsAnyDay, setDoneTaskIdsAnyDay] = useState<Set<string>>(new Set());
  const [todayActionEntries, setTodayActionEntries] = useState<any[]>([]);
  const [note, setNote] = useState("");
  const [fulfillment, setFulfillment] = useState(0);

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

  useEffect(() => {
    const handler = (e: any) => safeSetDay(e.detail);
    window.addEventListener("lifeos:setDay", handler);
    return () => window.removeEventListener("lifeos:setDay", handler);
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
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
  }

  // ------- Load base -------
  async function loadBase() {
    if (!userId) return;
    const res = await fetchBase({ supabase, userId });
    setTasks(res.tasks);
    setActions(res.actions);
  }

  async function loadTodayEntries() {
    if (!userId) return;
    const res = await fetchTodayEntries({ supabase, userId, day });
    setDoneTaskIds(res.doneTaskIds);
    setDoneTaskIdsAnyDay(res.doneTaskIdsAnyDay);
    setTodayActionEntries(res.todayActionEntries);
  }

  useEffect(() => {
    if (!userId) return;
    loadBase().catch((e: any) => setMsg(e?.message ?? "読み込みエラー"));
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    loadTodayEntries().catch((e: any) => setMsg(e?.message ?? "読み込みエラー"));
  }, [userId, day]);

  // ------- Render -------
  if (!userId) {
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

  const headerDateLabel =
    tab !== "register" ? toHeaderDateLabel(day) : undefined;

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
      headerDateLabel={headerDateLabel}
      onPrevDay={tab !== "register" ? () => safeShiftDay(-1) : undefined}
      onNextDay={tab !== "register" && canNext ? () => safeShiftDay(1) : undefined}
      canGoNext={canNext}
    >
      {tab === "today" && (
        <TodayView
          userId={userId}
          day={day}
          setDay={safeSetDay}
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
          setDay={safeSetDay}
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
          setDay={safeSetDay}
          setTab={setTab}
          setMsg={setMsg}
          supabase={supabase}
          cardStyle={cardStyle}

        />
      )}
    </AppShell>
  );
}
