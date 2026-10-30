import React, { useEffect, useState, useRef } from "react";
import type { Action, Task } from "../lib/types";
import { addDaysJST } from "../lib/dayNav";
import { useUserSettings } from "../lib/context/UserSettingsContext";
import { sortTasks } from "../lib/sortTasks";

import Card from "../components/ui/Card";
import IconBtn from "../components/ui/IconBtn";

import CategoryBadge from "../components/badges/CategoryBadge";
import PriorityBadge from "../components/badges/PriorityBadge";
import VolBar from "../components/badges/VolBar";
import PrimaryBtn from "../components/ui/PrimaryBtn";
import SegmentedBar from "../components/ui/SegmentedBar";
import { FEATURES } from "../lib/features";
import SectionTitle from "../components/ui/SectionTitle";
import { RepeatIcon, CheckIcon, ZapIcon, PencilIcon, ShieldIcon, GridIcon } from "../components/ui/Icon";
import { frequencyAt, isScheduledOn } from "../lib/mandala/frequency";
import { space } from "../lib/ui/spacing";
import { theme } from "../lib/ui/theme";
import TextInput from "../components/ui/TextInput";
import Slider from "../components/ui/Slider";

type Filter = "all" | "habit" | "task" | "rule" | "action";

// 5つ並ぶと文字が切れるので、アイコンの下に小さく名前を出す(記録タブと同じ)
const segmentedItems = [
  { key: "all", label: "すべて", icon: <GridIcon size={16} /> },
  { key: "habit", label: "習慣", icon: <RepeatIcon size={16} /> },
  { key: "task", label: "タスク", icon: <CheckIcon size={16} /> },
  { key: "rule", label: "ルール", icon: <ShieldIcon size={16} /> },
  { key: "action", label: "行動", icon: <ZapIcon size={16} /> },
].filter((it) => it.key !== "action" || FEATURES.actions);

type Props = {
  userId: string | null;
  day: string;
  setDay: (d: string) => void;

  tasks: Task[];
  doneTaskIds: Set<string>;
  /** マイルールで × をつけたもの */
  missedTaskIds: Set<string>;
  actions: Action[];
  todayActionEntries: any[];

  note: string;
  setNote: (s: string) => void;
  fulfillment: number;
  setFulfillment: (n: number) => void;
  setMsg: (s: string) => void;

  cardStyle: React.CSSProperties; // ✅ App.tsx の cardStyle を渡して見た目維持
  dataVersion?: number; // フォアグラウンド復帰時の再取得トリガー
  /** マンダラチャート(無ければ「目標の進み」を出さない) */
  mandala?: { model: ChartModel | null; byCell: Map<string, Task[]> };
  /** 目標タブで要素を開く */
  onOpenGoal?: (element: number) => void;
};

import { sqliteRepo } from "../lib/db/instance";
import { namedElements, type ChartModel } from "../lib/mandala/chart";
import MandalaReplay from "../components/features/goal/MandalaReplay";

export default function ReviewView({
  userId,
  day,
  tasks,
  doneTaskIds,
  missedTaskIds,
  actions,
  todayActionEntries,
  note,
  setNote,
  fulfillment,
  setFulfillment,
  setMsg,
  cardStyle,
  dataVersion,
  mandala,
  onOpenGoal,
}: Props) {
  const { sortRule, prioritizeDue } = useUserSettings();
  const [reviewLoading, setReviewLoading] = useState(false);
  const reqIdRef = useRef(0);

  // ✅ Segmented filter
  const [filter, setFilter] = useState<Filter>("all");

  // ✅ 「一度でも保存されたか」＋「編集モード」
  const [hasSavedReview, setHasSavedReview] = useState(false);
  const [isEditingReview, setIsEditingReview] = useState(true);

  // --- 明日の目標 / 前日の目標 ---
  const [tomorrowNote, setTomorrowNote] = useState("");
  const [yesterdayNote, setYesterdayNote] = useState<string | null>(null);
  const [achievement, setAchievement] = useState<"done" | "partial" | "failed" | "">("");
  const [isEditingAchievement, setIsEditingAchievement] = useState(false);

  useEffect(() => {
    if (!userId) return;

    const reqId = ++reqIdRef.current;
    setReviewLoading(true);

    (async () => {
      try {
        // 当日のログ
        const log = await sqliteRepo.getDailyLog(userId, day);
        // 前日のログ（明日の目標表示用）
        const prevDay = addDaysJST(day, -1);
        const prevLog = await sqliteRepo.getDailyLog(userId, prevDay);

        if (reqId !== reqIdRef.current) return;

        // 充実度・メモ・明日の目標のいずれかに内容があれば「登録済み」とみなす
        // （達成度のみ保存されたレコードは未入力扱い）
        const saved = !!(log && (
          log.fulfillment != null ||
          log.note?.trim() ||
          log.tomorrow_note?.trim()
        ));
        setHasSavedReview(saved);
        setIsEditingReview(false);

        setNote(log?.note ?? "");
        setFulfillment(typeof log?.fulfillment === "number" ? log.fulfillment : 0);
        setTomorrowNote(log?.tomorrow_note ?? "");
        setAchievement((log?.yesterday_achievement as any) ?? "");
        setIsEditingAchievement(false);

        // 前日の「明日の目標」が入力されていた場合のみ表示
        setYesterdayNote(prevLog?.tomorrow_note?.trim() || null);

      } catch (error: any) {
        if (reqId !== reqIdRef.current) return;
        setMsg(error.message || "読み込みエラー");
      } finally {
        if (reqId === reqIdRef.current) {
          setReviewLoading(false);
        }
      }
    })();
  }, [userId, day, dataVersion, setMsg, setNote, setFulfillment]);

  // ✅ その日完了したもの（表示用）
  const doneHabits = sortTasks(
    tasks.filter((t) => t.task_type === "habit" && doneTaskIds.has(t.id)),
    sortRule, false,
  );
  const doneOneoffs = sortTasks(
    tasks.filter((t) => t.task_type === "oneoff" && doneTaskIds.has(t.id)),
    sortRule, prioritizeDue,
  );

  // マイルール: その日の ○ / ×。予定があるのに答えていないものは、記録タブでつけてもらう
  const sortedRules = sortTasks(tasks.filter((t) => t.task_type === "rule" && t.is_active), sortRule, false);
  const keptRules = sortedRules.filter((t) => doneTaskIds.has(t.id));
  const missedRules = sortedRules.filter((t) => missedTaskIds.has(t.id));
  const unansweredRules = sortedRules.filter(
    (t) => !t.is_hidden && !doneTaskIds.has(t.id) && !missedTaskIds.has(t.id) && isScheduledOn(frequencyAt(t, day), day)
  );

  // ✅ 行動（その日のログを表示）
  const actionById = new Map(actions.map((a) => [a.id, a]));
  const doneActionEntries = (todayActionEntries ?? []).filter((e: any) => {
    const a = actionById.get(e.action_id);
    if (!a) return false;
    return a.is_active !== false;
  });

  const sumVolume = (arr: any[], getV: (x: any) => any) =>
    arr.reduce((acc, x) => acc + (Number(getV(x)) || 0), 0);

  const habitsCount = doneHabits.length;
  const habitsVol = sumVolume(doneHabits, (t) => (t as any).volume);

  const tasksCount = doneOneoffs.length;
  const tasksVol = sumVolume(doneOneoffs, (t) => (t as any).volume);

  const actionsCount = doneActionEntries.length;
  const actionsVol = sumVolume(doneActionEntries, (e) => (e as any).volume);

  async function saveReview() {
    if (!userId) return;

    const fNum = Number(fulfillment);
    const f = Number.isFinite(fNum) && fNum >= 1 && fNum <= 100 ? Math.trunc(fNum) : null;

    try {
      await sqliteRepo.upsertDailyLog({
        user_id: userId,
        day,
        note: note.trim() ? note.trim() : null,
        satisfaction: null,
        task_total: habitsCount + tasksCount,
        action_total: actionsCount,
        total_score: habitsVol + tasksVol + actionsVol,
        task_ratio: 0,
        action_ratio: 0,
        balance_factor: 0,
        fulfillment: f,
        tomorrow_note: tomorrowNote.trim() ? tomorrowNote.trim() : null,
        yesterday_achievement: (yesterdayNote && achievement) ? achievement : null,
      } as any);
    } catch (error: any) {
      setMsg(error?.message || "保存エラー");
      throw error;
    }

    setMsg("振り返りを保存しました。");

    // ✅ 保存後は「登録済」扱いにして確認画面へ
    setHasSavedReview(true);
    setIsEditingReview(false);
  }

  // --- 達成度の即時保存 ---
  async function saveAchievement(newAchievement: "done" | "partial" | "failed" | "") {
    if (!userId || !yesterdayNote) return;
    const fNum = Number(fulfillment);
    const f = Number.isFinite(fNum) && fNum >= 1 && fNum <= 100 ? Math.trunc(fNum) : null;
    try {
      await sqliteRepo.upsertDailyLog({
        user_id: userId,
        day,
        note: note.trim() ? note.trim() : null,
        satisfaction: null,
        task_total: habitsCount + tasksCount,
        action_total: actionsCount,
        total_score: habitsVol + tasksVol + actionsVol,
        task_ratio: 0,
        action_ratio: 0,
        balance_factor: 0,
        fulfillment: f,
        tomorrow_note: tomorrowNote.trim() ? tomorrowNote.trim() : null,
        yesterday_achievement: newAchievement || null,
      } as any);
    } catch (error: any) {
      setMsg(error?.message || "保存エラー");
    }
  }

  // --- UI parts style (Today/Registerと揃える) ---
  const listWrap: React.CSSProperties = {
    display: "grid",
    gap: 8,
  };

  const getItemCardStyle = (accentColor: string): React.CSSProperties => ({
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: "10px 12px",
    background: accentColor,
    color: "#ffffff",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)",
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "center",
    transition: "all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
  });

  const itemTitle: React.CSSProperties = {
    fontWeight: 600,
    minWidth: 0,
    wordBreak: "break-word",
    lineHeight: 1.3,
  };

  const metaLine: React.CSSProperties = {
    marginTop: 6,
    display: "flex",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
    opacity: 0.85,
  };

  const smallLabel: React.CSSProperties = {
    fontSize: 12,
    opacity: 0.7,
  };

  const sectionStats: React.CSSProperties = {
    display: "flex",
    gap: 8,
    fontSize: 12,
    opacity: 0.75,
    whiteSpace: "nowrap",
  };

  const statPill: React.CSSProperties = {
    border: "1px solid rgba(0,0,0,0.12)",
    borderRadius: 999,
    padding: "2px 8px",
    fontSize: 12,
    opacity: 0.8,
  };

  // ✅ 充実度「確認」画面用の見た目
  const confirmWrap: React.CSSProperties = {
    display: "grid",
    gap: 12,
  };

  const confirmRow: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 12,
  };

  const bigNumber: React.CSSProperties = {
    fontSize: 36,
    fontWeight: 900,
    lineHeight: 1,
    letterSpacing: 0.2,
  };

  const confirmLabel: React.CSSProperties = {
    fontSize: 12,
    opacity: 0.7,
  };

  const noteBox: React.CSSProperties = {
    border: "1px solid rgba(0,0,0,0.12)",
    borderRadius: 12,
    padding: "10px 12px",
    background: "rgba(255,255,255,0.02)",
    whiteSpace: "pre-wrap",
    lineHeight: 1.4,
  };

  // 達成度ボタンのスタイル
  const achievementBtn = (val: "done" | "partial" | "failed", label: string, color: string): React.ReactElement => {
    const selected = achievement === val;
    return (
      <button
        key={val}
        onClick={() => {
          const next = selected ? "" : val;
          setAchievement(next);
          saveAchievement(next);
          if (next) setIsEditingAchievement(false);
        }}
        style={{
          flex: 1,
          padding: "8px 4px",
          borderRadius: 10,
          border: selected ? `2px solid ${color}` : "1.5px solid rgba(0,0,0,0.12)",
          background: selected ? color : "transparent",
          color: selected ? "#fff" : theme.text,
          fontWeight: selected ? 700 : 500,
          fontSize: 13,
          cursor: "pointer",
          transition: "all 0.15s",
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <>
      <div style={{ display: "grid", gap: space.xl, marginTop: 0 }}>

        {/* ── 目標の進み（チャートがあるときだけ） ── */}
        {mandala?.model && namedElements(mandala.model).length > 0 && (
          <MandalaReplay
            userId={userId}
            day={day}
            model={mandala.model}
            byCell={mandala.byCell}
            refreshKey={`${dataVersion}|${[...doneTaskIds].join(",")}`}
            onOpenGoal={onOpenGoal}
          />
        )}

        {/* ── 目標の達成チェック（前日に tomorrow_note がある場合のみ表示） ── */}
        {FEATURES.dailyReview && yesterdayNote && (
          <div>
            <SectionTitle
              title="目標の達成チェック"
              isLarge={true}
              style={{ marginBottom: 8 }}
              right={
                achievement && !isEditingAchievement ? (
                  <IconBtn title="達成度を編集" onClick={() => setIsEditingAchievement(true)}>
                    <PencilIcon size={18} />
                  </IconBtn>
                ) : null
              }
            />

            {/* 今日の目標（記録タブと同サイズ・グレー枠の白ボックス） */}
            <div style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #e2e8f0",
              background: "#ffffff",
              display: "grid",
              gap: 2,
              marginBottom: 8,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#1e293b", letterSpacing: 0.5 }}>今日の目標</div>
              <div style={{ fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap", color: theme.text }}>{yesterdayNote}</div>
            </div>

            {/* 達成チェック: hasSavedReview に依存せず isEditingAchievement で独立制御 */}
            <Card style={cardStyle}>
              {achievement && !isEditingAchievement ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, opacity: 0.7 }}>達成度：</span>
                  <span style={{
                    padding: "3px 10px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 700,
                    background: achievement === "done" ? theme.habit : achievement === "partial" ? "#f59e0b" : "#ef4444",
                    color: "#fff",
                  }}>
                    {achievement === "done" ? "○ できた" : achievement === "partial" ? "△ 一部" : "× できなかった"}
                  </span>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>達成度</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {achievementBtn("done",    "○ できた",       theme.habit)}
                    {achievementBtn("partial", "△ 一部",         "#f59e0b")}
                    {achievementBtn("failed",  "× できなかった",  "#ef4444")}
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ✅ セクション：振り返り */}
        {FEATURES.dailyReview && (
        <div>
          <SectionTitle
            title="今日の振り返り"
            isLarge={true}
            right={
              hasSavedReview && !isEditingReview ? (
                <IconBtn title="編集" onClick={() => setIsEditingReview(true)}>
                  <PencilIcon size={18} />
                </IconBtn>
              ) : null
            }
            style={{ marginBottom: 8 }}
          />

          {/* ✅ 充実度Card：未登録時＆編集時 / 登録済で出し分け */}
          <Card style={cardStyle}>
            {reviewLoading && <small style={{ opacity: 0.7 }}>読み込み中…</small>}

            {/* 登録済＆確認モード */}
            {hasSavedReview && !isEditingReview ? (
              <div style={confirmWrap}>
                <div style={confirmRow}>
                  <div>
                    <div style={confirmLabel}>充実度</div>
                    <div style={bigNumber}>{fulfillment ? fulfillment : "—"}</div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div style={confirmLabel}>範囲</div>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>1〜100</div>
                  </div>
                </div>

                <div>
                  <div style={{ ...confirmLabel, marginBottom: 6 }}>振り返りメモ</div>
                  <div style={noteBox}>{note.trim() ? note : "（メモは未入力です）"}</div>
                </div>

                {tomorrowNote.trim() && (
                  <div>
                    <div style={{ ...confirmLabel, marginBottom: 6 }}>明日の目標</div>
                    <div style={noteBox}>{tomorrowNote.trim()}</div>
                  </div>
                )}
              </div>
            ) : !hasSavedReview && !isEditingReview ? (
              /* ✅ 追加要望11, 12: 未記入時は「振り返りを記入」ボタン（点線枠）のみ表示 */
              <div style={{ padding: "0" }}>
                <button
                  onClick={() => setIsEditingReview(true)}
                  style={{
                    width: "100%",
                    padding: "16px",
                    border: "2px dashed #cbd5e1",
                    borderRadius: 12,
                    background: "#f8fafc",
                    color: theme.subtext,
                    fontWeight: "bold",
                    cursor: "pointer",
                    transition: "background 0.2s"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "#e2e8f0"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "#f8fafc"}
                >
                  振り返りを記入
                </button>
              </div>
            ) : (
              /* 未登録で記入中、or 編集モード（プルダウン展開時） */
              <div style={{ display: "grid", gap: 10 }}>
                <div>
                  <div style={confirmLabel}>充実度を1〜100の範囲で入力</div>
                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                      <b>{fulfillment || 0}</b>
                      <TextInput
                        type="number"
                        min="1"
                        max="100"
                        value={fulfillment}
                        onChange={(e) => setFulfillment(Number(e.target.value))}
                        style={{ width: 90 }}
                      />
                    </div>

                    <Slider
                      min="1"
                      max="100"
                      step="1"
                      value={Math.min(100, Math.max(1, Number(fulfillment) || 1))}
                      onChange={(e) => setFulfillment(Number(e.target.value))}
                      fullWidth
                    />

                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.7 }}>
                      <span>1</span>
                      <span>50</span>
                      <span>100</span>
                    </div>
                  </div>
                </div>

                <label>
                  <div style={{ ...confirmLabel, marginBottom: 6 }}>振り返りメモを入力</div>
                  <textarea
                    rows={5}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    style={{ width: "100%", boxSizing: "border-box" }}
                    placeholder="例：今日はタスク偏重だった。明日は回復系を1つ入れる。"
                  />
                </label>

                <label>
                  <div style={{ ...confirmLabel, marginBottom: 6 }}>明日の目標（任意）</div>
                  <textarea
                    rows={3}
                    value={tomorrowNote}
                    onChange={(e) => setTomorrowNote(e.target.value)}
                    style={{ width: "100%", boxSizing: "border-box" }}
                    placeholder="例：早起きして読書を30分する"
                  />
                </label>

                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
                  <IconBtn
                    title="キャンセル"
                    onClick={() => setIsEditingReview(false)}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </IconBtn>

                  <PrimaryBtn onClick={saveReview}>保存</PrimaryBtn>
                </div>
              </div>
            )}
          </Card>
        </div>
        )}

        {/* ✅ 追加要望11: ダッシュボード（3分割パネル） */}
        <div>
          <SectionTitle title="ダッシュボード" isLarge={true} style={{ marginBottom: 8 }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {/* 習慣パネル */}
            <Card style={{ ...cardStyle, background: theme.habit, color: "#ffffff", padding: "16px 8px" }}>
              <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ fontSize: 12, opacity: 0.9, fontWeight: "bold" }}>習慣</div>
                <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1 }}>{habitsCount}</div>
                <div style={{ fontSize: 10, opacity: 0.8 }}>合計Vol: {habitsVol}</div>
              </div>
            </Card>

            {/* タスクパネル */}
            <Card style={{ ...cardStyle, background: theme.task, color: "#ffffff", padding: "16px 8px" }}>
              <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ fontSize: 12, opacity: 0.9, fontWeight: "bold" }}>タスク</div>
                <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1 }}>{tasksCount}</div>
                <div style={{ fontSize: 10, opacity: 0.8 }}>合計Vol: {tasksVol}</div>
              </div>
            </Card>

            {/* 行動パネル(行動を外しているあいだは、マイルールの ○ の数を出す) */}
            {!FEATURES.actions ? (
              <Card style={{ ...cardStyle, background: theme.rule, color: "#ffffff", padding: "16px 8px" }}>
                <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ fontSize: 12, opacity: 0.9, fontWeight: "bold" }}>マイルール</div>
                  <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1 }}>○ {keptRules.length}</div>
                  <div style={{ fontSize: 10, opacity: 0.8 }}>× {missedRules.length}</div>
                </div>
              </Card>
            ) : (
            <Card style={{ ...cardStyle, background: theme.action, color: "#ffffff", padding: "16px 8px" }}>
              <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ fontSize: 12, opacity: 0.9, fontWeight: "bold" }}>行動</div>
                <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1 }}>{actionsCount}</div>
                <div style={{ fontSize: 10, opacity: 0.8 }}>合計Vol: {actionsVol}</div>
              </div>
            </Card>
            )}
          </div>
        </div>

        {/* ✅ 見出し：実施したこと一覧（SegmentedBarの上） */}
        <div data-tutorial="review-content">
          <SectionTitle title="実施したこと一覧" isLarge={true} style={{ marginBottom: 0 }} />

          {/* ✅ SegmentedBar */}
          <SegmentedBar
            items={segmentedItems as any}
            value={filter}
            onChange={setFilter}
            ariaLabel="振り返りの表示切り替え"
          />
        </div>

        {/* ✅ 習慣 */}
        {(filter === "all" || filter === "habit") && (
          <div>
            <SectionTitle
              title="習慣"
              icon={<RepeatIcon size={18} />}
              accentColor={theme.habit}
              right={
                <div style={sectionStats}>
                  <span style={{ ...statPill, background: "rgba(0,0,0,0.05)", borderColor: "transparent", color: "#334155" }}>合計数: {habitsCount}</span>
                  <span style={{ ...statPill, background: "rgba(0,0,0,0.05)", borderColor: "transparent", color: "#334155" }}>合計vol: {habitsVol}</span>
                </div>
              }
              style={{ marginBottom: 8 }}
            />
            {doneHabits.length === 0 ? (
              <p style={{ margin: 0, opacity: 0.5, fontSize: 14 }}>まだありません</p>
            ) : (
              <div style={listWrap}>
                {doneHabits.map((t) => (
                  <div key={t.id} style={getItemCardStyle(theme.habit)}>
                    <div style={{ minWidth: 0, width: "100%" }}>
                      <div style={itemTitle}>{t.title}</div>
                      <div style={metaLine}>
                        <PriorityBadge value={(t as any).priority} />
                        <VolBar value={(t as any).volume} isReverse={true} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ✅ タスク */}
        {(filter === "all" || filter === "task") && (
          <div>
            <SectionTitle
              title="タスク"
              icon={<CheckIcon size={18} />}
              accentColor={theme.task}
              right={
                <div style={sectionStats}>
                  <span style={{ ...statPill, background: "rgba(0,0,0,0.05)", borderColor: "transparent", color: "#334155" }}>合計数: {tasksCount}</span>
                  <span style={{ ...statPill, background: "rgba(0,0,0,0.05)", borderColor: "transparent", color: "#334155" }}>合計vol: {tasksVol}</span>
                </div>
              }
              style={{ marginBottom: 8 }}
            />
            {doneOneoffs.length === 0 ? (
              <p style={{ margin: 0, opacity: 0.5, fontSize: 14 }}>まだありません</p>
            ) : (
              <div style={listWrap}>
                {doneOneoffs.map((t) => (
                  <div key={t.id} style={getItemCardStyle(theme.task)}>
                    <div style={{ minWidth: 0, width: "100%" }}>
                      <div style={itemTitle}>{t.title}</div>

                      <div style={metaLine}>
                        <PriorityBadge value={(t as any).priority} />
                        <VolBar value={(t as any).volume} isReverse={true} />
                      </div>

                      {t.due_date ? (
                        <div style={{ ...metaLine, marginTop: 4 }}>
                          <span style={smallLabel}>期限：</span>
                          <span style={smallLabel}>{t.due_date}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* マイルール(○× は記録タブでつけ、ここでは見るだけ) */}
        {(filter === "all" || filter === "rule") && (
          <div>
            <SectionTitle
              title="マイルール"
              icon={<ShieldIcon size={18} />}
              accentColor={theme.rule}
              right={
                <div style={sectionStats}>
                  <span style={{ ...statPill, background: "rgba(0,0,0,0.05)", borderColor: "transparent", color: "#334155" }}>○ {keptRules.length}</span>
                  <span style={{ ...statPill, background: "rgba(0,0,0,0.05)", borderColor: "transparent", color: "#334155" }}>× {missedRules.length}</span>
                </div>
              }
              style={{ marginBottom: 8 }}
            />
            {keptRules.length === 0 && missedRules.length === 0 ? (
              <p style={{ margin: 0, opacity: 0.5, fontSize: 14 }}>まだありません</p>
            ) : (
              <div style={listWrap}>
                {[...keptRules, ...missedRules].map((t) => {
                  const kept = doneTaskIds.has(t.id);
                  return (
                    <div
                      key={t.id}
                      style={kept ? getItemCardStyle(theme.rule) : { ...getItemCardStyle(theme.rule), background: "var(--card)", color: "var(--text)" }}
                    >
                      <div style={{ ...itemTitle, flex: 1 }}>{t.title}</div>
                      <span style={{ flexShrink: 0, fontSize: 13, fontWeight: 700, opacity: kept ? 1 : 0.7 }}>
                        {kept ? "○ 守れた" : "× 守れなかった"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            {unansweredRules.length > 0 && (
              <p style={{ margin: "8px 0 0", fontSize: 12, opacity: 0.7 }}>
                まだ ○× をつけていないもの：{unansweredRules.map((t) => t.title).join("、")}（記録タブでつけられます）
              </p>
            )}
          </div>
        )}

        {/* ✅ 行動 */}
        {FEATURES.actions && (filter === "all" || filter === "action") && (
          <div>
            <SectionTitle
              title="行動"
              icon={<ZapIcon size={18} />}
              accentColor={theme.action}
              right={
                <div style={sectionStats}>
                  <span style={{ ...statPill, background: "rgba(0,0,0,0.05)", borderColor: "transparent", color: "#334155" }}>合計数: {actionsCount}</span>
                  <span style={{ ...statPill, background: "rgba(0,0,0,0.05)", borderColor: "transparent", color: "#334155" }}>合計vol: {actionsVol}</span>
                </div>
              }
              style={{ marginBottom: 8 }}
            />
            {doneActionEntries.length === 0 ? (
              <p style={{ margin: 0, opacity: 0.5, fontSize: 14 }}>まだありません</p>
            ) : (
              <div style={listWrap}>
                {doneActionEntries.map((e: any) => {
                  const a = actionById.get(e.action_id);
                  const title = a ? (a.kind) : "（不明）";

                  return (
                    <div key={e.id} style={getItemCardStyle(theme.action)}>
                      <div style={{ minWidth: 0, width: "100%" }}>
                        <div style={itemTitle}>
                          {title}{" "}
                          <span style={{ marginLeft: 8 }}>
                            <CategoryBadge category={a?.category} />
                          </span>
                        </div>

                        {e.note ? (
                          <div style={{ ...smallLabel, marginTop: 6, opacity: 0.9 }}>{e.note}</div>
                        ) : null}

                        <div style={metaLine}>
                          <VolBar value={(e as any).volume} isReverse={true} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
