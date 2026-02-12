import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";
import { todayJST } from "./lib/day";
import type { Action, Task } from "./lib/types";

type Tab = "today" | "review" | "week" | "tasks" | "actions";
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

  // ------- UI -------
  const [tab, setTab] = useState<Tab>("today");
  const day = useMemo(() => todayJST(), []);

  // ------- Data -------
  const [tasks, setTasks] = useState<Task[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [doneTaskIds, setDoneTaskIds] = useState<Set<string>>(new Set());
  const [doneActionIds, setDoneActionIds] = useState<Set<string>>(new Set());
  const computed = useMemo(() => calcFulfillmentNow(), [tasks, actions, doneTaskIds, doneActionIds]);


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

    const { data: ae, error: aeErr } = await supabase
      .from("action_entries")
      .select("action_id")
      .eq("user_id", userId)
      .eq("day", day);

    if (aeErr) throw aeErr;

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
  }, [userId]);

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


  async function toggleActionDone(actionId: string, nextDone: boolean) {
    if (!userId) return;

    // ✅ 先にローカルstateを更新（即時反映）
    setDoneActionIds((prev) => {
      const next = new Set(prev);
      if (nextDone) next.add(actionId);
      else next.delete(actionId);
      return next;
    });

    try {
      if (nextDone) {
        const { error } = await supabase.from("action_entries").upsert(
          { user_id: userId, day, action_id: actionId },
          { onConflict: "user_id,day,action_id" }
        );
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("action_entries")
          .delete()
          .eq("user_id", userId)
          .eq("day", day)
          .eq("action_id", actionId);
        if (error) throw error;
      }
    } catch (e) {
      await loadTodayEntries();
      throw e;
    }
  }

  async function recalcAndSaveDaily() {
    if (!userId) return;

    const c = computed;

    const { error } = await supabase.from("daily_logs").upsert(
      {
        user_id: userId,
        day,
        task_total: c.taskTotal,
        action_total: c.actionTotal,
        total_score: c.totalScore,
        task_ratio: c.taskRatio,
        action_ratio: c.actionRatio,
        balance_factor: c.balanceFactor,
        fulfillment: c.fulfillment,
      },
      { onConflict: "user_id,day" }
    );

    if (error) throw error;
    setMsg("今日の充実度を保存しました。");
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

    const actionTotal = actions
      .filter((a) => a.is_active && doneActionIds.has(a.id))
      .reduce((s, a) => s + num(a.want_score, 0), 0);

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
          今日
        </button>
        <button onClick={() => setTab("review")} disabled={tab === "review"}>
          振り返り
        </button>
        <button onClick={() => setTab("week")} disabled={tab === "week"}>
          週
        </button>
        <button onClick={() => setTab("tasks")} disabled={tab === "tasks"}>
          タスク
        </button>
        <button onClick={() => setTab("actions")} disabled={tab === "actions"}>
          行動
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

  function TodayView() {
    const habits = tasks.filter((t) => t.is_active && t.task_type === "habit");
    const oneoffs = tasks.filter((t) => t.is_active && t.task_type === "oneoff");
    const activeActions = actions.filter(a => a.is_active);


    return (
      <>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <h2 style={{ margin: 0 }}>今日 ({day})</h2>
            <div>
              充実度: <b>{computed.fulfillment.toFixed(2)}</b>
            </div>
          </div>

          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            <label>
              納得度（1-5）
              <input
                type="number"
                min={1}
                max={5}
                defaultValue={3}
                id="satisfaction"
                style={{ width: "100%" }}
              />
            </label>

            <label>
              メモ（振り返り）
              <textarea id="dailyNote" rows={3} style={{ width: "100%" }} />
            </label>

            <button
              onClick={async () => {
                try {
                  // 入力値を取得
                  const satEl = document.getElementById("satisfaction") as HTMLInputElement | null;
                  const noteEl = document.getElementById("dailyNote") as HTMLTextAreaElement | null;
                  const satisfaction = satEl ? Number(satEl.value) : null;
                  const note = noteEl ? noteEl.value : null;

                  // まず充実度を再計算して保存
                  await recalcAndSaveDaily();

                  // その後、納得度とメモを追記保存
                  const { error } = await supabase
                    .from("daily_logs")
                    .update({
                      satisfaction:
                        satisfaction && satisfaction >= 1 && satisfaction <= 5 ? satisfaction : null,
                      note: note && note.trim() ? note.trim() : null,
                    })
                    .eq("user_id", userId)
                    .eq("day", day);

                  if (error) throw error;

                  setMsg("充実度＋納得度＋メモを保存しました。");
                } catch (e: any) {
                  setMsg(e?.message ?? "保存エラー");
                }
              }}
            >
              今日の振り返りを保存（充実度も更新）
            </button>
          </div>
        </Card>


        <Card>
          <h3 style={{ marginTop: 0 }}>習慣タスク</h3>
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
          <h3 style={{ marginTop: 0 }}>突発タスク</h3>
          {oneoffs.length === 0 ? (
            <p>まだありません（タスクタブで追加）</p>
          ) : (
            <ul style={{ paddingLeft: 18 }}>
              {oneoffs.map((t) => {
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
          <h3 style={{ marginTop: 0 }}>行動（やりたいこと）</h3>
          {actions.length === 0 ? (
            <p>まだありません（行動タブで追加）</p>
          ) : (
            <ul style={{ paddingLeft: 18 }}>
              {activeActions.map((a) => {
                const checked = doneActionIds.has(a.id);
                return (
                  <li key={a.id} style={{ marginBottom: 6 }}>
                    <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => toggleActionDone(a.id, e.target.checked)}
                      />
                      <span>{a.title}</span>
                      <small style={{ opacity: 0.7 }}>want {a.want_score} / cat {a.category}</small>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </>
    );
  }

  function TasksView() {
    const [title, setTitle] = useState("");
    const [taskType, setTaskType] = useState<"habit" | "oneoff">("habit");
    const [mustScore, setMustScore] = useState(3);
    const [wantScore, setWantScore] = useState(0);
    const [dueDate, setDueDate] = useState<string>("");

    function TaskRow({
      task,
      onSave,
    }: {
      task: Task;
      onSave: (patch: Partial<Task>) => Promise<void>;
    }) {
      const [editing, setEditing] = useState(false);
      const [title, setTitle] = useState(task.title);
      const [taskType, setTaskType] = useState<Task["task_type"]>(task.task_type);
      const [mustScore, setMustScore] = useState<number>(task.must_score);
      const [wantScore, setWantScore] = useState<number>(task.want_score);
      const [dueDate, setDueDate] = useState<string>(task.due_date ?? "");

      // 外部更新に追従（loadBaseでtasksが更新された時用）
      useEffect(() => {
        setTitle(task.title);
        setTaskType(task.task_type);
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
              <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%" }} />
            </label>

            <label>
              種別
              <select value={taskType} onChange={(e) => setTaskType(e.target.value as any)} style={{ width: "100%" }}>
                <option value="habit">習慣</option>
                <option value="oneoff">突発</option>
              </select>
            </label>

            <label>
              やるべき度（1-5）
              <input
                type="number"
                min={1}
                max={5}
                value={mustScore}
                onChange={(e) => setMustScore(Number(e.target.value))}
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
                onChange={(e) => setWantScore(Number(e.target.value))}
                style={{ width: "100%" }}
              />
            </label>

            {taskType === "oneoff" && (
              <label>
                期限（任意）
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  style={{ width: "100%" }}
                />
              </label>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={async () => {
                  await onSave({
                    title: title.trim() || task.title,
                    task_type: taskType,
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
                  setTaskType(task.task_type);
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
          <h2 style={{ marginTop: 0 }}>タスク追加</h2>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setMsg("");
              try {
                await addTask({
                  title,
                  task_type: taskType,
                  must_score: mustScore,
                  want_score: wantScore,
                  due_date: dueDate ? dueDate : null,
                });
                setTitle("");
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
              <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%" }} />
            </label>

            <label>
              種別
              <select value={taskType} onChange={(e) => setTaskType(e.target.value as any)} style={{ width: "100%" }}>
                <option value="habit">習慣</option>
                <option value="oneoff">突発</option>
              </select>
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
                style={{ width: "100%" }}
              />
            </label>

            {taskType === "oneoff" && (
              <label>
                期限（任意）
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={{ width: "100%" }} />
              </label>
            )}

            <button type="submit" disabled={!title.trim()}>
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
              {tasks.map((t) => (
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
              <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%" }} />
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
                style={{ width: "100%" }}
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
              タイトル
              <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%" }} />
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
                style={{ width: "100%" }}
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
                style={{ width: "100%" }}
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
      (async () => {
        const { data } = await supabase
          .from("daily_logs")
          .select("note,satisfaction")
          .eq("user_id", userId)
          .eq("day", day)
          .maybeSingle();

        if (data?.note) setNote(data.note);
        if (data?.satisfaction) setSatisfaction(data.satisfaction);
      })();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

    const doneTasks = tasks.filter((t) => doneTaskIds.has(t.id));
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <h2 style={{ marginTop: 0 }}>振り返り（{day}）</h2>
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
                style={{ width: "100%" }}
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
          <h3 style={{ marginTop: 0 }}>今日やったタスク</h3>
          {doneTasks.length === 0 ? (
            <p>まだありません</p>
          ) : (
            <ul style={{ paddingLeft: 18 }}>
              {doneTasks.map((t) => (
                <li key={t.id}>
                  {t.title}{" "}
                  <small style={{ opacity: 0.7 }}>
                    must {t.must_score} / want {t.want_score} ({t.task_type})
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
              style={{ width: "100%" }}
              autoComplete="email"
            />
          </label>

          <label>
            パスワード
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: "100%" }}
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
      {tab === "review" && <ReviewView />}
      {tab === "week" && <WeekView />}
      {tab === "tasks" && <TasksView />}
      {tab === "actions" && <ActionsView />}
    </div>
  );
}
