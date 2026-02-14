import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";
import { todayJST } from "./lib/day";
import type { Action, Task } from "./lib/types";
import { useRef } from "react";
import CategoryBadge from "./components/CategoryBadge";
import PriorityBadge from "./components/PriorityBadge";
import VolBar from "./components/VolBar";
import Card from "./components/ui/Card";
import IconBtn from "./components/ui/IconBtn";
import DateNav from "./components/ui/DateNav";
import Toast from "./components/ui/Toast";
import Tabs from "./components/ui/Tabs";



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


type ReviewViewProps = {
  userId: string | null;
  day: string;
  setDay: (d: string) => void;

  tasks: Task[];
  doneTaskIds: Set<string>;
  actions: Action[];
  todayActionEntries: any[];

  note: string;
  setNote: (s: string) => void;
  fulfillment: number;
  setFulfillment: (n: number) => void;

  setMsg: (s: string) => void;
  supabase: any;
};

function ReviewView({
  userId,
  day,
  setDay,
  tasks,
  doneTaskIds,
  actions,
  todayActionEntries,
  note,
  setNote,
  fulfillment,
  setFulfillment,
  setMsg,
  supabase,
}: ReviewViewProps) {
  const [reviewLoading, setReviewLoading] = useState(false);
  const reqIdRef = useRef(0);

  useEffect(() => {
    if (!userId) return;

    const reqId = ++reqIdRef.current;
    setReviewLoading(true);

    (async () => {
      const { data, error } = await supabase
        .from("daily_logs")
        .select("note, fulfillment")
        .eq("user_id", userId)
        .eq("day", day)
        .maybeSingle();

      // ✅ 古いリクエスト結果は捨てる（高速で日付移動した時の競合対策）
      if (reqId !== reqIdRef.current) return;

      if (error) {
        setMsg(error.message);
        setReviewLoading(false);
        return;
      }

      setNote(data?.note ?? "");
      setFulfillment(typeof data?.fulfillment === "number" ? data.fulfillment : 0);
      setReviewLoading(false);
    })();
  }, [userId, day]);


  // ✅ その日完了したもの（表示用）
  const doneHabits = tasks.filter((t) => t.task_type === "habit" && doneTaskIds.has(t.id));
  const doneOneoffs = tasks.filter((t) => t.task_type === "oneoff" && doneTaskIds.has(t.id));

  // ✅ 行動は「その日のログ（todayActionEntries）」を表示（詳細・ボリュームが出せる）
  const actionById = new Map(actions.map((a) => [a.id, a]));
  const doneActionEntries = (todayActionEntries ?? []).filter((e: any) => {
    const a = actionById.get(e.action_id);
    if (!a) return false;
    return a.is_active !== false; // 念のため
  });

  async function saveReview() {
    if (!userId) return;

    const fNum = Number(fulfillment);
    const f =
      Number.isFinite(fNum) && fNum >= 1 && fNum <= 100 ? Math.trunc(fNum) : null;

    const { error } = await supabase.from("daily_logs").upsert(
      {
        user_id: userId,
        day,
        note: note.trim() ? note.trim() : null,
        fulfillment: f, // ✅ ユーザー入力
      },
      { onConflict: "user_id,day" }
    );

    if (error) throw error;
    setMsg("振り返りを保存しました。");
  }

  return (
    <>
      <Card style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
          <DateNav day={day} setDay={setDay} />
        </div>
      </Card>

      <Card style={cardStyle}>
        {reviewLoading && <small style={{ opacity: 0.7 }}>読み込み中…</small>}
        <div style={{ display: "grid", gap: 10 }}>
          <label>
            充実度（1-100）
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <b>{fulfillment || 0}</b>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={fulfillment}
                  onChange={(e) => setFulfillment(Number(e.target.value))}
                  style={{ width: 90, boxSizing: "border-box" }}
                />
              </div>

              <input
                type="range"
                min={1}
                max={100}
                step={1}
                value={Math.min(100, Math.max(1, Number(fulfillment) || 1))}
                onChange={(e) => setFulfillment(Number(e.target.value))}
                style={{ width: "100%" }}
              />

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.7 }}>
                <span>1</span>
                <span>50</span>
                <span>100</span>
              </div>
            </div>
          </label>



          <label>
            振り返りメモ
            <textarea
              rows={5}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box" }}
              placeholder="例：今日はタスク偏重だった。明日は回復系を1つ入れる。"
            />
          </label>

          <button onClick={saveReview}>保存</button>
        </div>
      </Card>

      <Card style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>その日やった習慣</h3>
        {doneHabits.length === 0 ? (
          <p>まだありません</p>
        ) : (
          <ul style={{ paddingLeft: 18 }}>
            {doneHabits.map((t) => (
              <li key={t.id}>
                {t.title}{" "}
                <small style={{ opacity: 0.7 }}>
                  <PriorityBadge value={(t as any).priority} />{" "}
                  <VolBar value={(t as any).volume} />
                </small>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>その日やったタスク</h3>
        {doneOneoffs.length === 0 ? (
          <p>まだありません</p>
        ) : (
          <ul style={{ paddingLeft: 18 }}>
            {doneOneoffs.map((t) => (
              <li key={t.id}>
                {t.title}{" "}
                <small style={{ opacity: 0.7 }}>
                  <PriorityBadge value={(t as any).priority} />{" "}
                  <VolBar value={(t as any).volume} />
                </small>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>その日やった行動</h3>
        {doneActionEntries.length === 0 ? (
          <p>まだありません</p>
        ) : (
          <ul style={{ paddingLeft: 18 }}>
            {doneActionEntries.map((e: any) => {
              const a = actionById.get(e.action_id);
              return (
                <li key={e.id}>
                  {a ? (a.kind ?? a.title) : "（不明）"}{" "}
                  <small style={{ opacity: 0.7 }}>
                    <CategoryBadge category={a?.category} />{" "}
                    <VolBar value={(e as any).volume} />
                    {e.note ? ` / ${e.note}` : ""}
                  </small>

                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}

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

  // ------- Sub tab -------
  type RegisterTab = "habit" | "oneoff" | "action";
  const [registerTab, setRegisterTab] = useState<RegisterTab>("habit");

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
    console.count("loadTodayEntries called");
    if (!userId) return;

    const { data: te, error: teErr } = await supabase
      .from("task_entries")
      .select("task_id,status")
      .eq("user_id", userId)
      .eq("day", day);

    if (teErr) throw teErr;

    const doneT = new Set<string>();
    (te ?? []).forEach((r: any) => {
      if (r.status === "done") doneT.add(r.task_id);
    });
    setDoneTaskIds(doneT);

    // ✅ 過去いつでも done の task_id を取得（突発タスクの非表示判定に使う）
    const { data: teAll, error: teAllErr } = await supabase
      .from("task_entries")
      .select("task_id, status")
      .eq("user_id", userId)
      .eq("status", "done");

    if (teAllErr) throw teAllErr;

    const doneAll = new Set<string>();
    (teAll ?? []).forEach((r: any) => doneAll.add(r.task_id));
    setDoneTaskIdsAnyDay(doneAll);

    const { data: ae, error: aeErr } = await supabase
      .from("action_entries")
      .select("id, action_id, note, volume, created_at")
      .eq("user_id", userId)
      .eq("day", day)
      .order("created_at", { ascending: true });

    if (aeErr) throw aeErr;

    setTodayActionEntries(ae ?? []);

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
  async function addTask(form: {
    title: string;
    task_type: "habit" | "oneoff";
    priority: number; // 1-5
    volume: number;   // 1-5
    due_date: string | null;
  }) {
    if (!userId) return;

    const { error } = await supabase.from("tasks").insert({
      user_id: userId,
      title: form.title,
      task_type: form.task_type,

      // ✅ 新パラメータ
      priority: Math.min(5, Math.max(1, form.priority)),
      volume: Math.min(10, Math.max(1, form.volume)),

      // 期限はタスク(oneoff)のみ
      due_date: form.task_type === "oneoff" ? form.due_date : null,

      // （任意・互換用）旧カラムを残してるなら、とりあえず埋めておくと安全
      // must_score: form.priority,
      // want_score: 0,
    });

    if (error) throw error;
    await loadBase();
  }


  async function addAction(form: { kind: string; category: string; }) {
    if (!userId) return;
    const { error } = await supabase.from("actions").insert({
      user_id: userId,
      kind: form.kind,
      category: form.category,
    });
    if (error) throw error;
    await loadBase();
  }

  async function updateTask(taskId: string, patch: Partial<Task>) {
    if (!userId) return;
    const { error } = await supabase
      .from("tasks")
      .update(patch)
      .eq("user_id", userId)
      .eq("id", taskId);

    if (error) throw error;
    await loadBase();
  }

  async function updateAction(actionId: string, patch: Partial<Action>) {
    if (!userId) return;
    const { error } = await supabase
      .from("actions")
      .update(patch)
      .eq("user_id", userId)
      .eq("id", actionId);

    if (error) throw error;
    await loadBase();
  }

  async function archiveTask(taskId: string) {
    await updateTask(taskId, { is_active: false } as any);
  }

  async function unarchiveTask(taskId: string) {
    await updateTask(taskId, { is_active: true } as any);
  }

  async function deleteTaskForever(taskId: string) {
    if (!userId) return;
    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("user_id", userId)
      .eq("id", taskId);
    if (error) throw error;
    await loadBase();
  }

  async function archiveAction(actionId: string) {
    await updateAction(actionId, { is_active: false } as any);
  }

  async function unarchiveAction(actionId: string) {
    await updateAction(actionId, { is_active: true } as any);
  }

  async function deleteActionForever(actionId: string) {
    if (!userId) return;
    const { error } = await supabase
      .from("actions")
      .delete()
      .eq("user_id", userId)
      .eq("id", actionId);
    if (error) throw error;
    await loadBase();
  }

  async function toggleTaskDone(taskId: string, nextDone: boolean) {
    if (!userId) return;

    // ✅ 必ず“新しいSet”を作って返す（Reactが確実に再描画する）
    setDoneTaskIds((prev) => {
      const next = new Set(prev);
      if (nextDone) next.add(taskId);
      else next.delete(taskId);
      return next;
    });

    try {
      if (nextDone) {
        const { error } = await supabase.from("task_entries").upsert(
          { user_id: userId, day, task_id: taskId, status: "done" },
          { onConflict: "user_id,day,task_id" }
        );
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("task_entries")
          .delete()
          .eq("user_id", userId)
          .eq("day", day)
          .eq("task_id", taskId);
        if (error) throw error;
      }
    } catch (e) {
      // DB失敗時は正に戻す
      await loadTodayEntries();
      throw e;
    }
  }

  function isoDay(d: Date) {
    return d.toISOString().slice(0, 10);
  }
  function addDaysISO(day: string, delta: number) {
    const dt = new Date(day + "T00:00:00Z");
    dt.setUTCDate(dt.getUTCDate() + delta);
    return isoDay(dt);
  }

  function ActionEntryForm({ activeActions }: { activeActions: any[] }) {
    const [actionId, setActionId] = useState<string>(activeActions[0]?.id ?? "");
    const [detail, setDetail] = useState<string>("");
    const [volume, setVolume] = useState<number>(5);


    useEffect(() => {
      if (!actionId && activeActions[0]?.id) setActionId(activeActions[0].id);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeActions.length]);

    return (
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!userId) return;
          setMsg("");

          try {
            const { error } = await supabase.from("action_entries").insert({
              user_id: userId,
              day,
              action_id: actionId,
              note: detail.trim() ? detail.trim() : null,
              volume: Math.min(10, Math.max(1, Number(volume))),
            });
            if (error) throw error;

            setDetail("");
            setVolume(5);
            await loadTodayEntries();

          } catch (err: any) {
            setMsg(err?.message ?? "追加エラー");
          }
        }}
        style={{ display: "grid", gap: 10 }}
      >
        <label>
          行動名
          <select value={actionId} onChange={(e) => setActionId(e.target.value)} style={{ width: "100%" }}>
            {activeActions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.kind ?? a.title}
              </option>
            ))}
          </select>
        </label>

        <label>
          詳細（自由入力）
          <input value={detail} onChange={(e) => setDetail(e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} />
        </label>

        <label>
          ボリューム（1-10）: <b>{volume}</b>
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            style={{ width: "100%" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.7 }}>
            <span>1</span>
            <span>5</span>
            <span>10</span>
          </div>
        </label>


        <button type="submit" disabled={!actionId}>
          行動ログを追加
        </button>
      </form>
    );
  }


  function TodayView() {
    const habits = tasks.filter((t) => t.is_active && t.task_type === "habit");
    const activeActions = actions.filter((a) => a.is_active);
    const activeOneoffs = tasks.filter((t) => t.is_active && t.task_type === "oneoff");

    async function updateActionEntry(
      entryId: string,
      patch: { note?: string | null; volume?: number | null; action_id?: string | null }
    ) {
      if (!userId) return;

      const updateObj: any = {};
      if (patch.note !== undefined) updateObj.note = patch.note;
      if (patch.volume !== undefined) updateObj.volume = patch.volume;
      if (patch.action_id !== undefined) updateObj.action_id = patch.action_id;

      const { error } = await supabase
        .from("action_entries")
        .update(updateObj)
        .eq("user_id", userId)
        .eq("id", entryId);

      if (error) throw error;
      await loadTodayEntries();
    }


    function ActionEntryRow({ entry }: { entry: any }) {
      const a = actions.find((x) => x.id === entry.action_id);

      const [editing, setEditing] = useState(false);
      const [note, setNote] = useState<string>(entry.note ?? "");
      const [volume, setVolume] = useState<number>(Number(entry.volume ?? 5));
      const [actionId, setActionId] = useState<string>(entry.action_id);

      // day切替や再読み込みで entry が更新されたとき追従
      useEffect(() => {
        setActionId(entry.action_id);
        setNote(entry.note ?? "");
        setVolume(Number(entry.volume ?? 5));
        setEditing(false);
      }, [entry.id, entry.action_id, entry.note, entry.volume]);

      if (!editing) {
        return (
          <li style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>
                  {a ? (a.kind ?? a.title) : "（不明）"}
                  <small style={{ marginLeft: 8, opacity: 0.7 }}><VolBar value={entry.volume} /></small>
                </div>
                {entry.note ? <div style={{ opacity: 0.8, fontSize: 12 }}>{entry.note}</div> : null}
              </div>

              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <IconBtn title="編集" onClick={() => setEditing(true)}>✏️</IconBtn>

                <IconBtn
                  title="削除"
                  danger
                  onClick={async () => {
                    if (!userId) return;
                    if (!confirm("この行動ログを削除しますか？")) return;
                    const { error } = await supabase
                      .from("action_entries")
                      .delete()
                      .eq("user_id", userId)
                      .eq("id", entry.id);
                    if (error) {
                      setMsg(error.message);
                      return;
                    }
                    await loadTodayEntries();
                    setMsg("行動ログを削除しました。");
                  }}
                >
                  🗑️
                </IconBtn>
              </div>
            </div>
          </li>
        );
      }

      // 編集モード
      return (
        <li style={{ marginBottom: 8 }}>
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 10 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>
              {a ? (a.kind ?? a.title) : "（不明）"}
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <label>
                行動の種類
                <select
                  value={actionId}
                  onChange={(e) => setActionId(e.target.value)}
                  style={{ width: "100%", boxSizing: "border-box" }}
                >
                  {activeActions.map((x: any) => (
                    <option key={x.id} value={x.id}>
                      {x.kind ?? x.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                詳細
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  style={{ width: "100%", boxSizing: "border-box" }}
                  placeholder="自由入力"
                />
              </label>

              <label>
                ボリューム（1-10）: <b>{volume}</b>
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={1}
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  style={{ width: "100%" }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.7 }}>
                  <span>1</span><span>5</span><span>10</span>
                </div>
              </label>

              <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                <IconBtn
                  title="保存"
                  onClick={async () => {
                    try {
                      setMsg("");
                      await updateActionEntry(entry.id, {
                        action_id: actionId,
                        note: note.trim() ? note.trim() : null,
                        volume: Math.min(10, Math.max(1, Number(volume))),
                      });
                      setMsg("行動ログを更新しました。");
                    } catch (e: any) {
                      setMsg(e?.message ?? "更新エラー");
                    }
                  }}
                >
                  💾
                </IconBtn>

                <IconBtn
                  title="キャンセル"
                  onClick={() => {
                    setNote(entry.note ?? "");
                    setVolume(Number(entry.volume ?? 5));
                    setActionId(entry.action_id);
                    setEditing(false);
                  }}
                >
                  ✖️
                </IconBtn>
              </div>
            </div>
          </div>
        </li>
      );
    }



    // ✅ 非表示ルール：過去完了済み かつ 今日完了ではない → 隠す
    const visibleOneoffs = activeOneoffs.filter(
      (t) => !doneTaskIdsAnyDay.has(t.id) || doneTaskIds.has(t.id)
    );

    return (
      <>
        <Card style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <DateNav day={day} setDay={setDay} />
          </div>
        </Card>
        <Card style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>習慣</h3>
          {habits.length === 0 ? (
            <p>まだありません（タスクタブで追加）</p>
          ) : (
            <ul style={{ listStyle: "none", paddingLeft: 0, margin: 0 }}>
              {habits.map((t) => {
                const checked = doneTaskIds.has(t.id);
                return (
                  <li key={t.id} style={{ marginBottom: 6 }}>
                    <label style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => toggleTaskDone(t.id, e.target.checked)}
                      />
                      <span style={{ opacity: checked ? 1 : 0.4, minWidth: 0 }}>
                        {t.title}
                      </span>
                      <small style={{ opacity: 0.7 }}>
                        <PriorityBadge value={(t as any).priority} />{" "}
                        <VolBar value={(t as any).volume} />
                      </small>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>タスク</h3>
          {visibleOneoffs.length === 0 ? (
            <p>タスクがありません（タスクタブで追加）</p>
          ) : (
            <ul style={{ listStyle: "none", paddingLeft: 0, margin: 0 }}>
              {visibleOneoffs.map((t) => {
                const checked = doneTaskIds.has(t.id);
                return (
                  <li key={t.id} style={{ marginBottom: 6 }}>
                    <label style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => toggleTaskDone(t.id, e.target.checked)}
                      />
                      <span style={{ opacity: checked ? 1 : 0.4, minWidth: 0 }}>
                        {t.title}
                      </span>
                      <small style={{ opacity: 0.7 }}>
                        <PriorityBadge value={(t as any).priority} />{" "}
                        <VolBar value={(t as any).volume} /><br />
                        {t.due_date ? `期限: ${t.due_date}` : ""}
                      </small>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>行動（都度入力）</h3>

          <ActionEntryForm activeActions={activeActions} />

          <div style={{ marginTop: 12 }}>
            <h4 style={{ margin: "12px 0 6px" }}>今日の行動ログ</h4>

            {todayActionEntries.length === 0 ? (
              <p>まだありません</p>
            ) : (
              <ul style={{ paddingLeft: 18 }}>
                {(todayActionEntries ?? []).map((e: any) => (
                  <ActionEntryRow key={e.id} entry={e} />
                ))}
              </ul>
            )}
          </div>
        </Card>

      </>
    );
  }

  function TasksView({ fixedType, title }: { fixedType: "habit" | "oneoff"; title: string }) {
    const taskType = fixedType; // 固定
    const [newTitle, setNewTitle] = useState("");
    const [priority, setPriority] = useState(3);
    const [volume, setVolume] = useState(5);
    const [dueDate, setDueDate] = useState<string>("");

    const shownTasks = tasks.filter((t) => t.task_type === fixedType);

    const visibleTasks = shownTasks.filter((t) => {
      // 習慣は常に表示
      if (t.task_type === "habit") return true;

      // 突発タスクは「一度も完了してないものだけ表示」
      return !doneTaskIdsAnyDay.has(t.id);
    });

    function TaskRow({
      task,
      onSave,
    }: {
      task: Task;
      onSave: (patch: Partial<Task>) => Promise<void>;
    }) {
      const [editing, setEditing] = useState(false);
      const [title, setTitle] = useState(task.title);
      const [priority, setPriority] = useState<number>((task as any).priority ?? 3);
      const [volume, setVolume] = useState<number>((task as any).volume ?? 5);
      const [dueDate, setDueDate] = useState<string>(task.due_date ?? "");

      // 外部更新に追従（loadBaseでtasksが更新された時用）
      useEffect(() => {
        setTitle(task.title);
        setPriority((task as any).priority ?? 3);
        setVolume((task as any).volume ?? 5);
        setDueDate(task.due_date ?? "");
      }, [task]);

      if (!editing) {
        return (
          <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div>
                <b>{task.title}</b>{" "}
                <small style={{ opacity: 0.7 }}>
                  <PriorityBadge value={(task as any).priority} />{" "}
                  <VolBar value={(task as any).volume} /><br />
                  {task.due_date ? `期限: ${task.due_date}` : ""}
                </small>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <IconBtn title="編集" onClick={() => setEditing(true)}>✏️</IconBtn>

                {task.is_active ? (
                  <IconBtn
                    title="アーカイブ"
                    onClick={async () => {
                      if (!confirm("このタスクをアーカイブしますか？")) return;
                      await archiveTask(task.id);
                    }}
                  >
                    📦
                  </IconBtn>
                ) : (
                  <IconBtn title="復帰" onClick={() => unarchiveTask(task.id)}>
                    ♻️
                  </IconBtn>
                )}

                <IconBtn
                  title="完全削除"
                  danger
                  onClick={async () => {
                    if (!confirm("完全削除しますか？")) return;
                    await deleteTaskForever(task.id);
                  }}
                >
                  🗑️
                </IconBtn>
              </div>


            </div>
          </div>
        );
      }

      return (
        <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 10 }}>
          <div style={{ display: "grid", gap: 8 }}>
            <label>
              タイトル
              <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} placeholder={fixedType === "habit" ? "習慣名を入力" : "タスク名を入力"}
              />
            </label>
            <label>
              優先度（1-5）: <b>{priority}</b>
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                style={{ width: "100%" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.7 }}>
                <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
              </div>
            </label>


            <label>
              ボリューム（1-10）: <b>{volume}</b>
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                style={{ width: "100%" }}
              />

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.7 }}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => <span key={n}>{n}</span>)}
              </div>
            </label>



            {taskType === "oneoff" && (
              <label>
                期限（任意）
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  style={{ width: "100%", boxSizing: "border-box" }}
                />
              </label>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={async () => {
                  await onSave({
                    title: title.trim() || task.title,
                    task_type: fixedType, // タブ固定ならこれが安全
                    priority: Math.min(5, Math.max(1, priority)),
                    volume: Math.min(10, Math.max(1, volume)),
                    due_date: fixedType === "oneoff" ? (dueDate ? dueDate : null) : null,
                  } as any);
                  setEditing(false);
                }}
              >
                保存
              </button>
              <button
                onClick={() => {
                  // 変更を破棄して戻す
                  setTitle(task.title);
                  setPriority((task as any).priority ?? 3);
                  setVolume((task as any).volume ?? 5);
                  setDueDate(task.due_date ?? "");
                  setEditing(false);
                }}
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      );
    }


    return (
      <>
        <Card style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>{title}追加</h2>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setMsg("");
              try {
                await addTask({
                  title: newTitle,
                  task_type: fixedType,
                  priority: Math.min(5, Math.max(1, priority)),
                  volume: Math.min(10, Math.max(1, volume)),
                  due_date: fixedType === "oneoff" ? (dueDate ? dueDate : null) : null,
                });
                setNewTitle("");
                setDueDate("");
                setPriority(3);
                setVolume(5);
                setMsg("タスクを追加しました。");
              } catch (err: any) {
                setMsg(err?.message ?? "追加エラー");
              }
            }}
            style={{ display: "grid", gap: 10 }}
          >
            <label>
              タイトル
              <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} placeholder={fixedType === "habit" ? "習慣名を入力" : "タスク名を入力"}
              />
            </label>

            <label>
              優先度（1-5）: <b>{priority}</b>
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                style={{ width: "100%" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.7 }}>
                <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
              </div>
            </label>

            <label>
              ボリューム（1-10）: <b>{volume}</b>
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                style={{ width: "100%" }}
              />

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.7 }}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => <span key={n}>{n}</span>)}
              </div>
            </label>



            {taskType === "oneoff" && (
              <label>
                期限（任意）
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} />
              </label>
            )}

            <button type="submit" disabled={!newTitle.trim()}>
              追加
            </button>
          </form>
        </Card>

        <Card style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>登録済み{title}（編集）</h3>

          {tasks.length === 0 ? (
            <p>まだありません</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {visibleTasks.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  onSave={async (patch) => {
                    try {
                      setMsg("");
                      // 習慣に変えたら期限は消す
                      const finalPatch =
                        patch.task_type === "habit"
                          ? { ...patch, due_date: null }
                          : patch;
                      await updateTask(t.id, finalPatch as any);
                      setMsg("タスクを更新しました。");
                    } catch (e: any) {
                      setMsg(e?.message ?? "更新エラー");
                    }
                  }}
                />
              ))}
            </div>
          )}
        </Card>

      </>
    );
  }

  function ActionsView() {
    // ✅ title は「種類(kind)」入力として使う（変数名はそのままでもOK）
    const [kind, setKind] = useState("");
    const [category, setCategory] = useState("other");

    function ActionRow({
      actionItem,
      onSave,
    }: {
      actionItem: Action;
      onSave: (patch: Partial<Action>) => Promise<void>;
    }) {
      const [editing, setEditing] = useState(false);

      // ✅ 既存データは kind 優先、なければ title を種類として扱う
      const initialKind = (actionItem as any).kind ?? actionItem.title;

      const [kind, setKind] = useState<string>(initialKind);
      const [category, setCategory] = useState(actionItem.category);

      useEffect(() => {
        const k = (actionItem as any).kind ?? actionItem.title;
        setKind(k);
        setCategory(actionItem.category);
      }, [actionItem]);

      if (!editing) {
        return (
          <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div>
                <b>{(actionItem as any).kind ?? actionItem.title}</b>{" "}
                <small style={{ opacity: 0.7 }}><CategoryBadge category={actionItem.category} /></small>
              </div>

              <div style={{ display: "flex", gap: 6 }}>
                <IconBtn title="編集" onClick={() => setEditing(true)}>
                  ✏️
                </IconBtn>

                {actionItem.is_active ? (
                  <IconBtn
                    title="アーカイブ"
                    onClick={async () => {
                      if (!confirm("この行動をアーカイブしますか？")) return;
                      await archiveAction(actionItem.id);
                    }}
                  >
                    📦
                  </IconBtn>
                ) : (
                  <IconBtn title="復帰" onClick={() => unarchiveAction(actionItem.id)}>
                    ♻️
                  </IconBtn>
                )}

                <IconBtn
                  title="完全削除"
                  danger
                  onClick={async () => {
                    if (!confirm("完全削除しますか？")) return;
                    await deleteActionForever(actionItem.id);
                  }}
                >
                  🗑️
                </IconBtn>
              </div>
            </div>
          </div>
        );
      }

      return (
        <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 10 }}>
          <div style={{ display: "grid", gap: 8 }}>
            <label>
              種類
              <input
                value={kind}
                onChange={(e) => setKind(e.target.value)}
                style={{ width: "100%", boxSizing: "border-box" }}
              />
            </label>

            <label>
              カテゴリ
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{ width: "100%", boxSizing: "border-box" }}
              >
                <option value="hobby">趣味</option>
                <option value="recovery">回復</option>
                <option value="growth">成長</option>
                <option value="lifework">生活</option>
                <option value="other">その他</option>
              </select>
            </label>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={async () => {
                  const finalKind = (kind.trim() || initialKind).trim();
                  await onSave({
                    category,
                    // ✅ 新仕様
                    kind: finalKind as any,
                    // ✅ 互換（title参照してる箇所が残っても壊れない）
                    title: finalKind,
                    // want_score / must_score は送らない
                  } as any);
                  setEditing(false);
                }}
                disabled={!kind.trim()}
              >
                保存
              </button>

              <button
                onClick={() => {
                  setKind(initialKind);
                  setCategory(actionItem.category);
                  setEditing(false);
                }}
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      );
    }

    // ここから下：追加フォーム・一覧（あなたの既存コードに合わせて）
    return (
      <>
        <Card style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>行動（種類）追加</h2>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setMsg("");
              try {
                const finalKind = kind.trim();
                if (!finalKind) return;

                await addAction({
                  kind: finalKind,
                  category,
                } as any);

                setKind("");
                setCategory("other");
                setMsg("行動を追加しました。");
              } catch (err: any) {
                setMsg(err?.message ?? "追加エラー");
              }
            }}
            style={{ display: "grid", gap: 10 }}
          >
            <label>
              種類
              <input
                value={kind}
                onChange={(e) => setKind(e.target.value)}
                style={{ width: "100%", boxSizing: "border-box" }}
                placeholder="行動の種類を入力"
              />
            </label>

            <label>
              カテゴリ
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{ width: "100%", boxSizing: "border-box" }}
              >
                <option value="hobby">趣味</option>
                <option value="recovery">回復</option>
                <option value="growth">成長</option>
                <option value="lifework">生活</option>
                <option value="other">その他</option>
              </select>
            </label>

            <button type="submit" disabled={!kind.trim()}>
              追加
            </button>
          </form>
        </Card>

        <Card style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>登録済みの行動の種類（編集）</h3>

          {actions.length === 0 ? (
            <p>まだありません</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {actions.map((a) => (
                <ActionRow
                  key={a.id}
                  actionItem={a}
                  onSave={async (patch) => {
                    try {
                      setMsg("");
                      // ✅ kind変更時はtitleも同期（互換）
                      const k = (patch as any).kind;
                      const finalPatch =
                        typeof k === "string" ? ({ ...(patch as any), title: k } as any) : patch;

                      await updateAction(a.id, finalPatch as any);
                      setMsg("行動を更新しました。");
                    } catch (e: any) {
                      setMsg(e?.message ?? "更新エラー");
                    }
                  }}
                />
              ))}
            </div>
          )}
        </Card>
      </>
    );
  }


  function RegisterView() {
    return (
      <>
        <Card style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>登録</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setRegisterTab("habit")} disabled={registerTab === "habit"}>
              習慣
            </button>
            <button onClick={() => setRegisterTab("oneoff")} disabled={registerTab === "oneoff"}>
              タスク
            </button>
            <button onClick={() => setRegisterTab("action")} disabled={registerTab === "action"}>
              行動
            </button>
          </div>
        </Card>

        {registerTab === "habit" && <TasksView fixedType="habit" title="習慣" />}
        {registerTab === "oneoff" && <TasksView fixedType="oneoff" title="タスク" />}
        {registerTab === "action" && <ActionsView />}
      </>
    );
  }

  function WeekView({
    day,
    setDay,
    setTab,
  }: {
    day: string;
    setDay: (d: string) => void;
    setTab: (t: "today" | "register" | "review" | "week") => void;
  }) {

    const [rows, setRows] = useState<
      {
        day: string;
        habitDone: number;
        habitTotal: number;
        taskDone: number;
        actionDone: number;
        fulfillment: number | null;
      }[]
    >([]);
    const [weekLoading, setWeekLoading] = useState(false);

    // ✅ 選択日(day)までの直近7日
    const startDay = useMemo(() => addDaysISO(day, -6), [day]);
    const endDay = day;
    const days = useMemo(
      () => Array.from({ length: 7 }, (_, i) => addDaysISO(startDay, i)),
      [startDay]
    );

    const habitTotal = useMemo(
      () => tasks.filter((t) => t.task_type === "habit" && t.is_active).length,
      [tasks]
    );

    useEffect(() => {
      if (!userId) return;

      (async () => {
        setWeekLoading(true);
        try {
          const [{ data: te, error: teErr }, { data: ae, error: aeErr }, { data: dl, error: dlErr }] =
            await Promise.all([
              supabase
                .from("task_entries")
                .select("day, task_id, status")
                .eq("user_id", userId)
                .gte("day", startDay)
                .lte("day", endDay),

              supabase
                .from("action_entries")
                .select("day, id")
                .eq("user_id", userId)
                .gte("day", startDay)
                .lte("day", endDay),

              supabase
                .from("daily_logs")
                .select("day, fulfillment")
                .eq("user_id", userId)
                .gte("day", startDay)
                .lte("day", endDay),
            ]);

          if (teErr) throw teErr;
          if (aeErr) throw aeErr;
          if (dlErr) throw dlErr;

          const taskById = new Map(tasks.map((t) => [t.id, t]));

          const habitDoneMap = new Map<string, number>();
          const oneoffDoneMap = new Map<string, number>();
          const actionCountMap = new Map<string, number>();
          const fulfillmentMap = new Map<string, number | null>();

          (te ?? []).forEach((r: any) => {
            if (r.status !== "done") return;
            const t = taskById.get(r.task_id);
            if (!t) return;

            if (t.task_type === "habit") {
              habitDoneMap.set(r.day, (habitDoneMap.get(r.day) ?? 0) + 1);
            } else if (t.task_type === "oneoff") {
              oneoffDoneMap.set(r.day, (oneoffDoneMap.get(r.day) ?? 0) + 1);
            }
          });

          (ae ?? []).forEach((r: any) => {
            actionCountMap.set(r.day, (actionCountMap.get(r.day) ?? 0) + 1);
          });

          (dl ?? []).forEach((r: any) => {
            fulfillmentMap.set(r.day, typeof r.fulfillment === "number" ? r.fulfillment : null);
          });

          const nextRows = days.map((d) => ({
            day: d,
            habitDone: habitDoneMap.get(d) ?? 0,
            habitTotal,
            taskDone: oneoffDoneMap.get(d) ?? 0,
            actionDone: actionCountMap.get(d) ?? 0,
            fulfillment: fulfillmentMap.get(d) ?? null,
          }));

          setRows(nextRows);
        } catch (e: any) {
          setMsg(e?.message ?? "週の読み込みエラー");
        } finally {
          setWeekLoading(false);
        }
      })();
    }, [userId, startDay, endDay, days, tasks, habitTotal]);

    const avg = useMemo(() => {
      const vals = rows
        .map((r) => r.fulfillment)
        .filter((v): v is number => typeof v === "number");
      if (vals.length === 0) return 0;
      return vals.reduce((s, v) => s + v, 0) / vals.length;
    }, [rows]);

    return (
      <>
        <Card style={cardStyle}>
          {/* ✅ 週タブでも日付ナビ */}
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
            <DateNav day={day} setDay={setDay} label="" />
          </div>

          <h2 style={{ marginTop: 12 }}>{startDay} 〜 {endDay} の7日間</h2>
          <div>
            平均 充実度: <b>{avg.toFixed(1)}</b>
            {weekLoading ? <small style={{ marginLeft: 8, opacity: 0.7 }}>読み込み中…</small> : null}
          </div>
        </Card>

        <Card style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>日別</h3>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 520, borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #eee", padding: "8px 6px" }}>日付</th>
                  <th style={{ textAlign: "right", borderBottom: "1px solid #eee", padding: "8px 6px" }}>習慣</th>
                  <th style={{ textAlign: "right", borderBottom: "1px solid #eee", padding: "8px 6px" }}>タスク</th>
                  <th style={{ textAlign: "right", borderBottom: "1px solid #eee", padding: "8px 6px" }}>行動</th>
                  <th style={{ textAlign: "right", borderBottom: "1px solid #eee", padding: "8px 6px" }}>充実度</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((r) => (
                  <tr key={r.day}>
                    <td
                      style={{
                        padding: "8px 6px",
                        borderBottom: "1px solid #f3f4f6",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setDay(r.day);
                          setTab("review");
                        }}
                        style={{
                          padding: 0,
                          margin: 0,
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                          textDecoration: "underline",
                          font: "inherit",
                          color: "inherit",
                        }}
                        aria-label={`${r.day} の振り返りを開く`}
                      >
                        {r.day}
                      </button>
                    </td>

                    <td style={{ padding: "8px 6px", borderBottom: "1px solid #f3f4f6", textAlign: "right" }}>
                      {r.habitDone} / {r.habitTotal}
                    </td>
                    <td style={{ padding: "8px 6px", borderBottom: "1px solid #f3f4f6", textAlign: "right" }}>
                      {r.taskDone}
                    </td>
                    <td style={{ padding: "8px 6px", borderBottom: "1px solid #f3f4f6", textAlign: "right" }}>
                      {r.actionDone}
                    </td>
                    <td style={{ padding: "8px 6px", borderBottom: "1px solid #f3f4f6", textAlign: "right" }}>
                      {r.fulfillment == null ? "-" : r.fulfillment}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && !weekLoading ? (
                  <tr>
                    <td colSpan={5} style={{ padding: 12, opacity: 0.7 }}>
                      データがありません
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>
      </>
    );
  }

  // ------- Render -------
  if (!userId) {
    return (
      <div style={layoutStyle}>
        <div style={containerStyle}>
          <div style={{ maxWidth: 520, margin: "40px auto", fontFamily: "sans-serif" }}>
            <h1>Life OS</h1>

            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <button onClick={() => setMode("signIn")} disabled={mode === "signIn"}>
                ログイン
              </button>
              <button onClick={() => setMode("signUp")} disabled={mode === "signUp"}>
                新規登録
              </button>
              <button type="button" onClick={signInWithGoogle}>
                Googleでログイン
              </button>
            </div>

            <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
              <label>
                メール
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ width: "100%", boxSizing: "border-box" }}
                  autoComplete="email"
                />
              </label>

              <label>
                パスワード
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ width: "100%", boxSizing: "border-box" }}
                  autoComplete={mode === "signUp" ? "new-password" : "current-password"}
                />
              </label>

              <button type="submit">{mode === "signUp" ? "登録する" : "ログインする"}</button>

            </form>
          </div>
        </div>
      </div>
    );
  }

  return (

    <div style={layoutStyle}>
      <div style={containerStyle}>
        <div style={{ maxWidth: 720, margin: "40px auto", fontFamily: "sans-serif" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <h1 style={{ margin: 0 }}>Life OS</h1>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <small style={{ opacity: 0.7 }}>{userEmail}</small>
              <button onClick={signOut}>ログアウト</button>
            </div>
          </div>

          <hr />

          <Toast msg={msg} wrapStyle={toastWrapStyle} toastStyle={toastStyle} />
          <Tabs tab={tab} setTab={setTab} />


          {tab === "today" && <TodayView />}
          {tab === "register" && <RegisterView />}
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
            />
          )}
          {tab === "week" && <WeekView day={day} setDay={setDay} setTab={setTab} />}

        </div>
      </div>
    </div>
  );
}
