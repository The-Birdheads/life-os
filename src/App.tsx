import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";
import { todayJST } from "./lib/day";
import type { Action, Task } from "./lib/types";

type Tab = "today" | "review" | "week" | "register";
type Mode = "signIn" | "signUp";

function num(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default function App() {
  // ------- Auth -------
  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [msg, setMsg] = useState<string>("");
  const [todayActionEntries, setTodayActionEntries] = useState<any[]>([]);

  // ------- UI -------
  const [tab, setTab] = useState<Tab>("today");
  const [day, setDay] = useState(() => todayJST());
  const layoutStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "center",
    width: "100%",
  };

  const containerStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: 720,
    padding: "16px 12px 40px",
    boxSizing: "border-box",
  };

  // ------- Data -------
  const [tasks, setTasks] = useState<Task[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [doneTaskIds, setDoneTaskIds] = useState<Set<string>>(new Set());
  const [doneActionIds, setDoneActionIds] = useState<Set<string>>(new Set());
  const [doneTaskIdsAnyDay, setDoneTaskIdsAnyDay] = useState<Set<string>>(new Set());
  const computed = useMemo(() => calcFulfillmentNow(), [tasks, actions, doneTaskIds, doneActionIds]);

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
      .select("id, action_id, note, satisfaction, created_at")
      .eq("user_id", userId)
      .eq("day", day)
      .order("created_at", { ascending: true });

    if (aeErr) throw aeErr;

    setTodayActionEntries(ae ?? []);

    // 互換：今日やった行動IDセット（振り返り等で使える）
    const doneA = new Set<string>();
    (ae ?? []).forEach((r: any) => doneA.add(r.action_id));
    setDoneActionIds(doneA);


  }

  function lastNDays(n: number): string[] {
    const out: string[] = [];
    const base = new Date(day + "T00:00:00");
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(base);
      d.setDate(d.getDate() - i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      out.push(`${yyyy}-${mm}-${dd}`);
    }
    return out;
  }

  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        await loadBase();
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
    must_score: number;
    want_score: number;
    due_date: string | null;
  }) {
    if (!userId) return;
    const { error } = await supabase.from("tasks").insert({
      user_id: userId,
      title: form.title,
      task_type: form.task_type,
      must_score: form.must_score,
      want_score: form.want_score,
      due_date: form.task_type === "oneoff" ? form.due_date : null,
    });
    if (error) throw error;
    await loadBase();
  }

  async function addAction(form: { title: string; category: string; want_score: number; must_score: number }) {
    if (!userId) return;
    const { error } = await supabase.from("actions").insert({
      user_id: userId,
      title: form.title,
      category: form.category,
      want_score: form.want_score,
      must_score: form.must_score,
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

  function calcFulfillmentNow() {
    console.log("DEBUG ids", {
      sampleTaskId: tasks[0]?.id,
      sampleTaskActive: tasks[0]?.is_active,
      doneTaskIds: Array.from(doneTaskIds).slice(0, 3),
    });
    const taskTotal = tasks
      .filter((t) => t.is_active && doneTaskIds.has(t.id))
      .reduce((s, t) => s + num(t.must_score, 0), 0);

    const actionById = new Map(actions.map((a) => [a.id, a]));

    const actionTotal = todayActionEntries.reduce((sum: number, e: any) => {
      const a = actionById.get(e.action_id);
      if (!a) return sum;
      if (a.is_active === false) return sum;

      const sat = Number(e.satisfaction ?? 3); // 未入力なら3扱い
      const weight = Math.min(5, Math.max(1, sat)) / 5;
      return sum + num(a.want_score, 0) * weight;
    }, 0);

    const totalScore = taskTotal + actionTotal;
    const taskRatio = totalScore === 0 ? 0 : taskTotal / totalScore;
    const actionRatio = totalScore === 0 ? 0 : actionTotal / totalScore;
    const balanceFactor = totalScore === 0 ? 0 : 1 - Math.abs(taskRatio - actionRatio);
    const f =
      totalScore === 0 ? 0 : totalScore * (0.5 + 0.5 * balanceFactor);


    return { taskTotal, actionTotal, totalScore, taskRatio, actionRatio, balanceFactor, fulfillment: f };
  }


  // ------- UI components -------
  function Tabs() {
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

  function Card({ children }: { children: React.ReactNode }) {
    return (
      <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginBottom: 12 }}>
        {children}
      </div>
    );
  }

  function ActionEntryForm({ activeActions }: { activeActions: any[] }) {
    const [actionId, setActionId] = useState<string>(activeActions[0]?.id ?? "");
    const [detail, setDetail] = useState<string>("");
    const [satisfaction, setSatisfaction] = useState<number>(3);

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
              satisfaction: Math.min(5, Math.max(1, Number(satisfaction))),
            });
            if (error) throw error;

            setDetail("");
            setSatisfaction(3);
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
                {a.title}
              </option>
            ))}
          </select>
        </label>

        <label>
          詳細（自由入力）
          <input value={detail} onChange={(e) => setDetail(e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} />
        </label>

        <label>
          満足度（1-5）
          <input
            type="number"
            min={1}
            max={5}
            value={satisfaction}
            onChange={(e) => setSatisfaction(Number(e.target.value))}
            style={{ width: "100%" }}
          />
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

    // ✅ 非表示ルール：過去完了済み かつ 今日完了ではない → 隠す
    const visibleOneoffs = activeOneoffs.filter(
      (t) => !doneTaskIdsAnyDay.has(t.id) || doneTaskIds.has(t.id)
    );

    return (
      <>
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <b>日付</b>
            <input
              type="date"
              value={day}
              max={todayJST()}
              onChange={(e) => setDay(e.target.value)}
            />
          </div>
        </Card>
        <Card>
          <h3 style={{ marginTop: 0 }}>習慣</h3>
          {habits.length === 0 ? (
            <p>まだありません（タスクタブで追加）</p>
          ) : (
            <ul style={{ paddingLeft: 18 }}>
              {habits.map((t) => {
                const checked = doneTaskIds.has(t.id);
                return (
                  <li key={t.id} style={{ marginBottom: 6 }}>
                    <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => toggleTaskDone(t.id, e.target.checked)}
                      />
                      <span style={{ opacity: checked ? 1 : 0.4 }}>
                        {t.title}
                      </span>
                      <small style={{ opacity: 0.7 }}>must {t.must_score} / want {t.want_score}</small>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <h3 style={{ marginTop: 0 }}>タスク</h3>
          {visibleOneoffs.length === 0 ? (
            <p>タスクがありません（タスクタブで追加）</p>
          ) : (
            <ul style={{ paddingLeft: 18 }}>
              {visibleOneoffs.map((t) => {
                const checked = doneTaskIds.has(t.id);
                return (
                  <li key={t.id} style={{ marginBottom: 6 }}>
                    <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => toggleTaskDone(t.id, e.target.checked)}
                      />
                      <span style={{ opacity: checked ? 1 : 0.4 }}>
                        {t.title}
                      </span>
                      <small style={{ opacity: 0.7 }}>
                        must {t.must_score} / want {t.want_score}
                        {t.due_date ? ` / due ${t.due_date}` : ""}
                      </small>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <h3 style={{ marginTop: 0 }}>行動（都度入力）</h3>

          <ActionEntryForm activeActions={activeActions} />

          <div style={{ marginTop: 12 }}>
            <h4 style={{ margin: "12px 0 6px" }}>今日の行動ログ</h4>
            {todayActionEntries.length === 0 ? (
              <p>まだありません</p>
            ) : (
              <ul style={{ paddingLeft: 18 }}>
                {todayActionEntries.map((e: any) => {
                  const a = actions.find((x) => x.id === e.action_id);
                  return (
                    <li key={e.id} style={{ marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <div>
                          <b>{a?.title ?? "（不明な行動）"}</b>{" "}
                          <small style={{ opacity: 0.7 }}>
                            満足度 {e.satisfaction ?? "-"} / {e.note ? `詳細: ${e.note}` : "詳細なし"}
                          </small>
                        </div>
                        <button
                          onClick={async () => {
                            if (!userId) return;
                            if (!confirm("この行動ログを削除しますか？")) return;
                            const { error } = await supabase
                              .from("action_entries")
                              .delete()
                              .eq("user_id", userId)
                              .eq("id", e.id);
                            if (error) {
                              setMsg(error.message);
                              return;
                            }
                            await loadTodayEntries();
                          }}
                        >
                          削除
                        </button>
                      </div>
                    </li>
                  );
                })}
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
    const [mustScore, setMustScore] = useState(3);
    const [wantScore, setWantScore] = useState(0);
    const [dueDate, setDueDate] = useState<string>("");

    const shownTasks = tasks.filter((t) => t.task_type === fixedType);

    function TaskRow({
      task,
      onSave,
    }: {
      task: Task;
      onSave: (patch: Partial<Task>) => Promise<void>;
    }) {
      const [editing, setEditing] = useState(false);
      const [title, setTitle] = useState(task.title);
      const [mustScore, setMustScore] = useState<number>(task.must_score);
      const [wantScore, setWantScore] = useState<number>(task.want_score);
      const [dueDate, setDueDate] = useState<string>(task.due_date ?? "");

      // 外部更新に追従（loadBaseでtasksが更新された時用）
      useEffect(() => {
        setTitle(task.title);
        setMustScore(task.must_score);
        setWantScore(task.want_score);
        setDueDate(task.due_date ?? "");
      }, [task]);

      if (!editing) {
        return (
          <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div>
                <b>{task.title}</b>{" "}
                <small style={{ opacity: 0.7 }}>
                  ({task.task_type}) must {task.must_score} want {task.want_score}
                  {task.due_date ? ` / due ${task.due_date}` : ""}
                </small>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setEditing(true)}>編集</button>

                {task.is_active ? (
                  <button
                    onClick={async () => {
                      if (!confirm("このタスクをアーカイブしますか？（今日の一覧から消えます）")) return;
                      await archiveTask(task.id);
                    }}
                  >
                    アーカイブ
                  </button>
                ) : (
                  <button
                    onClick={async () => {
                      await unarchiveTask(task.id);
                    }}
                  >
                    復帰
                  </button>
                )}

                <button
                  onClick={async () => {
                    if (
                      !confirm(
                        "完全削除しますか？過去の記録（task_entries）も消える可能性があります。"
                      )
                    )
                      return;
                    await deleteTaskForever(task.id);
                  }}
                >
                  完全削除
                </button>
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
              <input value={newTitle} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} placeholder={`${title}名を入力`} />
            </label>
            <label>
              やるべき度（1-5）
              <input
                type="number"
                min={1}
                max={5}
                value={mustScore}
                onChange={(e) => setMustScore(Number(e.target.value))}
                style={{ width: "100%", boxSizing: "border-box" }}
              />
            </label>

            <label>
              やりたい度（0-5）
              <input
                type="number"
                min={0}
                max={5}
                value={wantScore}
                onChange={(e) => setWantScore(Number(e.target.value))}
                style={{ width: "100%", boxSizing: "border-box" }}
              />
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
                    task_type: fixedType,
                    must_score: Math.min(5, Math.max(1, mustScore)),
                    want_score: Math.min(5, Math.max(0, wantScore)),
                    due_date: taskType === "oneoff" ? (dueDate ? dueDate : null) : null,
                  });
                  setEditing(false);
                }}
              >
                保存
              </button>
              <button
                onClick={() => {
                  // 変更を破棄して戻す
                  setTitle(task.title);
                  setMustScore(task.must_score);
                  setWantScore(task.want_score);
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
        <Card>
          <h2 style={{ marginTop: 0 }}>{title}追加</h2>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setMsg("");
              try {
                await addTask({
                  title: newTitle,
                  task_type: fixedType,
                  must_score: mustScore,
                  want_score: wantScore,
                  due_date: fixedType === "oneoff" ? (dueDate ? dueDate : null) : null,
                });
                setNewTitle("");
                setDueDate("");
                setMsg("タスクを追加しました。");
              } catch (err: any) {
                setMsg(err?.message ?? "追加エラー");
              }
            }}
            style={{ display: "grid", gap: 10 }}
          >
            <label>
              タイトル
              <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} placeholder={`${title}名を入力`} />
            </label>

            <label>
              やるべき度（1-5）
              <input
                type="number"
                min={1}
                max={5}
                value={mustScore}
                onChange={(e) => setMustScore(num(e.target.value, 3))}
                style={{ width: "100%" }}
              />
            </label>

            <label>
              やりたい度（0-5）
              <input
                type="number"
                min={0}
                max={5}
                value={wantScore}
                onChange={(e) => setWantScore(num(e.target.value, 0))}
                style={{ width: "100%", boxSizing: "border-box" }}
              />
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

        <Card>
          <h3 style={{ marginTop: 0 }}>登録済みタスク（編集）</h3>

          {tasks.length === 0 ? (
            <p>まだありません</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {shownTasks.map((t) => (
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
    const [title, setTitle] = useState("");
    const [category, setCategory] = useState("other");
    const [wantScore, setWantScore] = useState(3);
    const [mustScore, setMustScore] = useState(0);

    function ActionRow({
      actionItem,
      onSave,
    }: {
      actionItem: Action;
      onSave: (patch: Partial<Action>) => Promise<void>;
    }) {
      const [editing, setEditing] = useState(false);
      const [title, setTitle] = useState(actionItem.title);
      const [category, setCategory] = useState(actionItem.category);
      const [wantScore, setWantScore] = useState<number>(actionItem.want_score);
      const [mustScore, setMustScore] = useState<number>(actionItem.must_score);

      useEffect(() => {
        setTitle(actionItem.title);
        setCategory(actionItem.category);
        setWantScore(actionItem.want_score);
        setMustScore(actionItem.must_score);
      }, [actionItem]);

      if (!editing) {
        return (
          <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div>
                <b>{actionItem.title}</b>{" "}
                <small style={{ opacity: 0.7 }}>
                  (cat {actionItem.category}) want {actionItem.want_score} must {actionItem.must_score}
                </small>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setEditing(true)}>編集</button>

                {actionItem.is_active ? (
                  <button
                    onClick={async () => {
                      if (!confirm("この行動をアーカイブしますか？（今日の一覧から消えます）")) return;
                      await archiveAction(actionItem.id);
                    }}
                  >
                    アーカイブ
                  </button>
                ) : (
                  <button
                    onClick={async () => {
                      await unarchiveAction(actionItem.id);
                    }}
                  >
                    復帰
                  </button>
                )}

                <button
                  onClick={async () => {
                    if (
                      !confirm(
                        "完全削除しますか？過去の記録（action_entries）も消える可能性があります。"
                      )
                    )
                      return;
                    await deleteActionForever(actionItem.id);
                  }}
                >
                  完全削除
                </button>
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
              <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} />
            </label>

            <label>
              カテゴリ
              <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: "100%" }}>
                <option value="hobby">趣味</option>
                <option value="recovery">回復</option>
                <option value="growth">成長</option>
                <option value="other">その他</option>
              </select>
            </label>

            <label>
              やりたい度（1-5）
              <input
                type="number"
                min={1}
                max={5}
                value={wantScore}
                onChange={(e) => setWantScore(Number(e.target.value))}
                style={{ width: "100%", boxSizing: "border-box" }}
              />
            </label>

            <label>
              やるべき度（0-3）
              <input
                type="number"
                min={0}
                max={3}
                value={mustScore}
                onChange={(e) => setMustScore(Number(e.target.value))}
                style={{ width: "100%" }}
              />
            </label>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={async () => {
                  await onSave({
                    title: title.trim() || actionItem.title,
                    category,
                    want_score: Math.min(5, Math.max(1, wantScore)),
                    must_score: Math.min(3, Math.max(0, mustScore)),
                  });
                  setEditing(false);
                }}
              >
                保存
              </button>
              <button
                onClick={() => {
                  setTitle(actionItem.title);
                  setCategory(actionItem.category);
                  setWantScore(actionItem.want_score);
                  setMustScore(actionItem.must_score);
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
        <Card>
          <h2 style={{ marginTop: 0 }}>行動追加</h2>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setMsg("");
              try {
                await addAction({ title, category, want_score: wantScore, must_score: mustScore });
                setTitle("");
                setMsg("行動を追加しました。");
              } catch (err: any) {
                setMsg(err?.message ?? "追加エラー");
              }
            }}
            style={{ display: "grid", gap: 10 }}
          >
            <label>
              種類
              <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} placeholder={`行動の種類を入力`} />
            </label>

            <label>
              カテゴリ
              <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: "100%" }}>
                <option value="hobby">趣味</option>
                <option value="recovery">回復</option>
                <option value="growth">成長</option>
                <option value="other">その他</option>
              </select>
            </label>

            <label>
              やりたい度（1-5）
              <input
                type="number"
                min={1}
                max={5}
                value={wantScore}
                onChange={(e) => setWantScore(num(e.target.value, 3))}
                style={{ width: "100%", boxSizing: "border-box" }}
              />
            </label>

            <label>
              やるべき度（0-3）
              <input
                type="number"
                min={0}
                max={3}
                value={mustScore}
                onChange={(e) => setMustScore(num(e.target.value, 0))}
                style={{ width: "100%", boxSizing: "border-box" }}
              />
            </label>

            <button type="submit" disabled={!title.trim()}>
              追加
            </button>
          </form>
        </Card>

        <Card>
          <h3 style={{ marginTop: 0 }}>登録済み行動（編集）</h3>

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
                      await updateAction(a.id, patch as any);
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

  function ReviewView() {
    const [note, setNote] = useState("");
    const [satisfaction, setSatisfaction] = useState<number>(3);

    // 今日のログ（note/satisfaction）を読み込み
    useEffect(() => {
      if (!userId) return;

      // 日付切替時に一旦初期化（前日の表示が残らないように）
      setNote("");
      setSatisfaction(3);

      (async () => {
        const { data, error } = await supabase
          .from("daily_logs")
          .select("note,satisfaction")
          .eq("user_id", userId)
          .eq("day", day)
          .maybeSingle();

        if (error) {
          setMsg(error.message);
          return;
        }

        setNote(data?.note ?? "");
        setSatisfaction(data?.satisfaction ?? 3);
      })();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId, day]);


    const doneHabits = tasks.filter((t) => t.task_type === "habit" && doneTaskIds.has(t.id));
    const doneOneoffs = tasks.filter((t) => t.task_type === "oneoff" && doneTaskIds.has(t.id));
    const doneActions = actions.filter((a) => doneActionIds.has(a.id));
    const calc = calcFulfillmentNow();

    async function saveReview() {
      if (!userId) return;

      // 常に最新の計算値で daily_logs を upsert
      const { error } = await supabase.from("daily_logs").upsert(
        {
          user_id: userId,
          day,
          note: note.trim() ? note.trim() : null,
          satisfaction: satisfaction >= 1 && satisfaction <= 5 ? satisfaction : null,

          task_total: calc.taskTotal,
          action_total: calc.actionTotal,
          total_score: calc.totalScore,
          task_ratio: calc.taskRatio,
          action_ratio: calc.actionRatio,
          balance_factor: calc.balanceFactor,
          fulfillment: calc.fulfillment,
        },
        { onConflict: "user_id,day" }
      );

      if (error) throw error;
      setMsg("振り返りを保存しました。");
    }

    return (
      <>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <small style={{ opacity: 0.7 }}>日付</small>
              <input
                type="date"
                value={day}
                max={todayJST()}  // 未来日ロックしたいなら残す（不要なら消してOK）
                onChange={(e) => setDay(e.target.value)}
              />
            </div>
          </div>
        </Card>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div>
              充実度: <b>{computed.fulfillment.toFixed(2)}</b>
            </div>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <label>
              納得度（1-5）
              <input
                type="number"
                min={1}
                max={5}
                value={satisfaction}
                onChange={(e) => setSatisfaction(Number(e.target.value))}
                style={{ width: "100%", boxSizing: "border-box" }}
              />
            </label>

            <label>
              振り返りメモ
              <textarea
                rows={5}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                style={{ width: "100%" }}
                placeholder="例：今日はタスク偏重だった。明日は回復系を1つ入れる。"
              />
            </label>

            <button onClick={saveReview}>保存</button>
          </div>
        </Card>

        <Card>
          <h3 style={{ marginTop: 0 }}>今日やった習慣</h3>
          {doneHabits.length === 0 ? (
            <p>まだありません</p>
          ) : (
            <ul style={{ paddingLeft: 18 }}>
              {doneHabits.map((t) => (
                <li key={t.id}>
                  {t.title}{" "}
                  <small style={{ opacity: 0.7 }}>
                    must {t.must_score} / want {t.want_score}
                  </small>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h3 style={{ marginTop: 0 }}>今日やったタスク</h3>
          {doneOneoffs.length === 0 ? (
            <p>まだありません</p>
          ) : (
            <ul style={{ paddingLeft: 18 }}>
              {doneOneoffs.map((t) => (
                <li key={t.id}>
                  {t.title}{" "}
                  <small style={{ opacity: 0.7 }}>
                    must {t.must_score} / want {t.want_score}
                    {t.due_date ? ` / due ${t.due_date}` : ""}
                  </small>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h3 style={{ marginTop: 0 }}>今日やった行動</h3>
          {doneActions.length === 0 ? (
            <p>まだありません</p>
          ) : (
            <ul style={{ paddingLeft: 18 }}>
              {doneActions.map((a) => (
                <li key={a.id}>
                  {a.title}{" "}
                  <small style={{ opacity: 0.7 }}>
                    want {a.want_score} / cat {a.category}
                  </small>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </>
    );
  }

  function RegisterView() {
    return (
      <>
        <Card>
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

  function WeekView() {
    const [rows, setRows] = useState<any[]>([]);
    const days = useMemo(() => lastNDays(7), []);

    useEffect(() => {
      if (!userId) return;
      (async () => {
        try {
          const { data, error } = await supabase
            .from("daily_logs")
            .select("day, fulfillment, task_total, action_total, satisfaction")
            .eq("user_id", userId)
            .in("day", days)
            .order("day", { ascending: true });

          if (error) throw error;

          // 欠けてる日を0埋め
          const map = new Map<string, any>();
          (data ?? []).forEach((r: any) => map.set(r.day, r));
          const filled = days.map((d) => {
            const r = map.get(d);
            return {
              day: d,
              fulfillment: r?.fulfillment ?? 0,
              task_total: r?.task_total ?? 0,
              action_total: r?.action_total ?? 0,
              satisfaction: r?.satisfaction ?? null,
            };
          });
          setRows(filled);
        } catch (e: any) {
          setMsg(e?.message ?? "週次読み込みエラー");
        }
      })();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

    const avg = rows.length
      ? rows.reduce((s, r) => s + Number(r.fulfillment || 0), 0) / rows.length
      : 0;

    return (
      <>
        <Card>
          <h2 style={{ marginTop: 0 }}>週次（直近7日）</h2>
          <div>平均 充実度: <b>{avg.toFixed(2)}</b></div>
          <p style={{ opacity: 0.7, marginBottom: 0 }}>
            PDCAの見どころ：充実度の上下、タスク偏重/行動偏重、充実度と納得度のズレ
          </p>
        </Card>

        <Card>
          <h3 style={{ marginTop: 0 }}>日別</h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", paddingBottom: 6 }}>日付</th>
                <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", paddingBottom: 6 }}>充実度</th>
                <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", paddingBottom: 6 }}>タスク</th>
                <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", paddingBottom: 6 }}>行動</th>
                <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", paddingBottom: 6 }}>納得度</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.day}>
                  <td style={{ padding: "8px 0" }}>{r.day}</td>
                  <td style={{ padding: "8px 0", textAlign: "right" }}>{Number(r.fulfillment).toFixed(2)}</td>
                  <td style={{ padding: "8px 0", textAlign: "right" }}>{r.task_total}</td>
                  <td style={{ padding: "8px 0", textAlign: "right" }}>{r.action_total}</td>
                  <td style={{ padding: "8px 0", textAlign: "right" }}>{r.satisfaction ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </>
    );
  }


  // ------- Render -------
  if (!userId) {
    return (
      <div style={{ maxWidth: 520, margin: "40px auto", fontFamily: "sans-serif" }}>
        <h1>Life OS</h1>

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button onClick={() => setMode("signIn")} disabled={mode === "signIn"}>
            ログイン
          </button>
          <button onClick={() => setMode("signUp")} disabled={mode === "signUp"}>
            新規登録
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

          {msg && <p>{msg}</p>}
        </form>
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
          <Tabs />

          {msg && <p>{msg}</p>}

          {tab === "today" && <TodayView />}
          {tab === "register" && <RegisterView />}
          {tab === "review" && <ReviewView />}
          {tab === "week" && <WeekView />}
        </div>
      </div>
    </div>
  );
}
