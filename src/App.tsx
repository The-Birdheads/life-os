import { useEffect, useMemo, useState, useRef } from "react";
import { todayJST } from "./lib/day";
import { clampDayToToday, addDaysJST, canGoNextDay } from "./lib/dayNav";
import type { Action, Task } from "./lib/types";
import AppShell from "./views/AppShell";
import WeekView from "./views/WeekView";
import ReviewView from "./views/ReviewView";
import TodayView from "./views/TodayView";
import FABMenu from "./components/features/register/FABMenu";
import RegisterModals from "./components/features/register/RegisterModals";
import NotificationSettingsModal from "./components/features/settings/NotificationSettingsModal";
import UserSettingsModal from "./components/features/settings/UserSettingsModal";
import SpotlightTutorial from "./components/features/onboarding/SpotlightTutorial";
import HabitTutorial from "./components/features/onboarding/HabitTutorial";
import { UserSettingsContext } from "./lib/context/UserSettingsContext";
import type { SortRule } from "./lib/context/UserSettingsContext";
import { initSqlite } from "./lib/db/initSqlite";
import { getLocalUserId } from "./lib/db/localUser";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { SplashScreen } from "@capacitor/splash-screen";
import { AdMob, AdmobConsentStatus } from "@capacitor-community/admob";
import BannerAd from "./components/ui/BannerAd";
import { supabase } from "./lib/supabase";
import { scheduleNotifications, setupNotificationListeners, cancelAllNotifications, requestNotificationPermissions } from "./lib/notifications";
import { syncWidgetData, processPendingCompletions } from "./lib/widgetData";
import { sqliteRepo } from "./lib/db/instance";
import { registerAppUse, getAccountUsage, deleteAppData, deleteDoneMessage, revokeAppleAuthorizationIfNeeded } from "./lib/accountApi";
import { adoptLegacyUserData, clearLegacySession } from "./lib/legacyAuthMigration";
import LegacyAuthNotice from "./components/features/notice/LegacyAuthNotice";
import {
  cardStyle,
  layoutStyle,
  containerStyle,
  toastWrapStyle,
} from "./lib/ui/style";

// グローバルなリポジトリインスタンスは ./lib/db/instance.ts へ移動しました

import type { Tab } from "./lib/tabs";
import GoalView, { type GoalFocus } from "./views/GoalView";
import { useMandala } from "./lib/mandala/useMandala";

function toHeaderDateLabel(dayISO: string) {
  const [y, m, d] = dayISO.split("-");
  return `${y} / ${m} / ${d}`;
}

export default function App() {
  // ------- Auth -------
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [adHeight, setAdHeight] = useState(0);
  const [noAds, setNoAds] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  // 旧プロジェクトからの移行(ログイン共通化)のお知らせ。更新前にログインしていた端末にだけ出す
  const [legacyNoticeOpen, setLegacyNoticeOpen] = useState(false);
  const legacyAdoptedRef = useRef(false);
  const registeredUidRef = useRef<string | null>(null);
  // アカウント削除中は、サインアウトに伴う「ログアウトしました」の表示を出さない(削除完了の表示を優先)
  const deletingRef = useRef(false);

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

  // ------- Notifications -------
  useEffect(() => {
    const cleanup = setupNotificationListeners();
    return cleanup;
  }, []);

  useEffect(() => {
    if (!userId) return;
    const handleSchedule = async () => {
        try {
            await scheduleNotifications(userId);
        } catch (e) {
            console.error("[App] Failed to schedule notifications, DB might not be ready", e);
        }
    };
    
    // Initial schedule on load (delay slightly to ensure DB is mounted)
    setTimeout(handleSchedule, 2000);

    window.addEventListener("lifeos:scheduleNotifications", handleSchedule);
    return () => window.removeEventListener("lifeos:scheduleNotifications", handleSchedule);
  }, [userId]);

  useEffect(() => {
    const handleNotifClick = (e: Event) => {
      const type = (e as CustomEvent).detail;
      if (type === 1) {
        setTab("today");
        setTimeout(() => window.dispatchEvent(new CustomEvent("lifeos:setTodayFilter", { detail: "habit" })), 100);
      } else if (type === 2) {
        setTab("today");
        setTimeout(() => window.dispatchEvent(new CustomEvent("lifeos:setTodayFilter", { detail: "task" })), 100);
      } else if (type === 3) {
        setTab("review");
      }
    };
    window.addEventListener("lifeos:notificationClick", handleNotifClick);
    return () => window.removeEventListener("lifeos:notificationClick", handleNotifClick);
  }, []);

  // ------- Deep Links (OAuth Callback) -------
  useEffect(() => {
    CapApp.addListener('appUrlOpen', async (data: any) => {
      console.log('App opened with URL:', data.url);
      const url = new URL(data.url);
      
      // habitas://login-callback#access_token=... 形式を処理
      if (url.host === 'login-callback') {
        const hash = url.hash.substring(1); // # を除く
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (accessToken && refreshToken) {
          console.log('[App] Deep link login-callback detected. Setting session...');
          // SFSafariViewController を閉じる
          try {
            const { Browser } = await import("@capacitor/browser");
            await Browser.close();
          } catch (_) {}
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) {
            console.error('[App] Failed to set session from deep link:', error.message);
            setMsg(`ログインエラー: ${error.message}`);
          } else {
            // sync は onAuthStateChange リスナーに任せる（二重呼び出し防止）
            setMsg('ログイン完了。同期中...');
          }
        }
      }
    });
  }, []);

  // ------- Data -------
  const [tasks, setTasks] = useState<Task[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [doneTaskIds, setDoneTaskIds] = useState<Set<string>>(new Set());
  const [doneTaskIdsAnyDay, setDoneTaskIdsAnyDay] = useState<Set<string>>(new Set());
  const [todayActionEntries, setTodayActionEntries] = useState<any[]>([]);
  const [note, setNote] = useState("");
  const [fulfillment, setFulfillment] = useState(0);
  const [yesterdayGoal, setYesterdayGoal] = useState<string | null>(null);

  // ------- Modals -------
  const [openModal, setOpenModal] = useState<"habit" | "oneoff" | "action" | null>(null);
  const [notifSettingsOpen, setNotifSettingsOpen] = useState(false);
  const [userSettingsOpen, setUserSettingsOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [habTutOpen, setHabTutOpen] = useState(false);
  const [fabForceOpen, setFabForceOpen] = useState(false);
  const [volumeUnit, setVolumeUnit] = useState("30");
  const [sortRule, setSortRule] = useState<SortRule>("priority");
  const [prioritizeDue, setPrioritizeDue] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);
  // 記録タブのチップから、目標タブの要素を開く
  const [goalFocus, setGoalFocus] = useState<GoalFocus>(null);

  const prevUserIdRef = useRef<string | null>(null);

  // 一体化した初期化フロー
  useEffect(() => {
    let sub: any;

    const setupApp = async () => {
      try {
        console.log("[App] Starting initialization...");

        // 1. 基本的な初期化（AdMob / SQL）
        if (Capacitor.getPlatform() !== 'web') {
          if (Capacitor.getPlatform() === 'ios') {
            // 専用ATTプラグインで requestTrackingAuthorization を確実に呼ぶ
            try {
              const { AppTrackingTransparency } = await import('capacitor-plugin-app-tracking-transparency');
              await AppTrackingTransparency.requestPermission();
            } catch (e) {
              console.warn('[ATT] requestPermission failed:', e);
            }
          }

          // UMP consent flow（Google Mobile Ads SDK v12+ の必須要件）
          try {
            const consentInfo = await AdMob.requestConsentInfo({});
            console.log('[AdMob] Consent status:', consentInfo.status, 'canRequestAds:', consentInfo.canRequestAds);
            if (consentInfo.isConsentFormAvailable && consentInfo.status === AdmobConsentStatus.REQUIRED) {
              console.log('[AdMob] Showing consent form...');
              await AdMob.showConsentForm();
            }
          } catch (e) {
            console.warn('[AdMob] Consent flow failed:', e);
          }

          await AdMob.initialize({ initializeForTesting: false });
        }

        console.log("[App] Initializing SQL...");
        await initSqlite();
        console.log("[App] SQL Initialized.");

        // 通知権限を起動時に要求（TestFlight/本番向け）
        if (Capacitor.isNativePlatform()) {
          console.log("[App] Requesting notification permissions...");
          await requestNotificationPermissions();
        }

        // 2. セッション情報の取得（getSessionはタイムアウト付きで安全に）
        console.log("[App] Fetching Supabase session...");
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Supabase Timeout")), 5000));

        let initialSession: any = null;
        try {
          const res: any = await Promise.race([sessionPromise, timeoutPromise]);
          initialSession = res.data?.session;
          console.log("[App] Supabase session fetch result:", initialSession ? "session found" : "no session");
        } catch (e) {
          console.warn("[App] Supabase session fetch timed out or failed, proceeding as local.", e);
        }

        // 3. 初期IDの設定
        let initialId: string;
        if (initialSession?.user) {
          initialId = initialSession.user.id;
          setUserEmail(initialSession.user.email ?? "");
          clearLegacySession(); // 新プロジェクトにログイン済み。旧セッションの情報は不要
          console.log("[App] Initial ID from Supabase session:", initialId);
          // no_ads フラグをフェッチ（非同期・ノンブロッキング）
          fetchNoAds(initialId);
        } else {
          initialId = await getLocalUserId();
          setUserEmail("offline-user@local");
          // 更新前にログインしていた端末なら、端末内データをローカルIDへ付け替えて、再ログインを案内する
          const legacy = await adoptLegacyUserData(sqliteRepo, initialId);
          if (legacy.hadLegacySession) {
            legacyAdoptedRef.current = legacy.adopted;
            setLegacyNoticeOpen(true);
          }
          console.log("[App] Initial ID from local storage:", initialId);
        }

        console.log("[App] Setting initial ID:", initialId);
        prevUserIdRef.current = initialId;
        setUserId(initialId);

        // スプラッシュを非表示（初期化完了）
        if (Capacitor.isNativePlatform()) {
          await SplashScreen.hide({ fadeOutDuration: 300 });
        }

        // 4. 認証リスナーの登録
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
          console.log("[App] Auth Event:", event, session?.user?.id ? `User ID: ${session.user.id}` : "No user in session");
          const newUserId = session?.user?.id;
          const oldUserId = prevUserIdRef.current;

          if (session?.user && newUserId) {
            setUserEmail(session.user.email ?? "");
            fetchNoAds(newUserId);
            // Memory Calendar と共通のアカウントで、Habitas を使っていることを記録する(冪等・失敗は無視)
            if (registeredUidRef.current !== newUserId) {
              registeredUidRef.current = newUserId;
              void registerAppUse();
            }

            const doSync = async (uid: string, delayMs = 0, silent = false) => {
              if (delayMs > 0) {
                console.log(`[App] Waiting ${delayMs}ms before sync (network recovery)...`);
                await new Promise(r => setTimeout(r, delayMs));
              }
              console.log(`[App] Starting sync for uid: ${uid} (silent=${silent})`);
              if (!silent) setIsSyncing(true);
              try {
                const res = await sqliteRepo.sync(uid);
                console.log("[App] Sync done:", res);
                if (!silent) setMsg(res.success ? "同期完了" : res.message);
                if (res.success) {
                  // uid を明示渡し（stale closure 対策）
                  await loadBase(uid);
                  await loadTodayEntries(uid);
                  // 同期後のSQLiteデータをReviewViewに反映（振り返りデータはdataVersionで管理）
                  setDataVersion(v => v + 1);
                  // 同期後のユーザ設定を再読み込み（ログアウト→ログイン後に設定が反映されない問題の対策）
                  const s = await sqliteRepo.getNotificationSettings(uid);
                  if (s) {
                    setVolumeUnit(s.volume_unit ?? "30");
                    setSortRule((s.sort_rule as SortRule) ?? "priority");
                    setPrioritizeDue(!!s.prioritize_due);
                  }
                }
              } catch (e: any) {
                console.error("[App] Sync error:", e?.message ?? e);
                if (!silent) setMsg("同期エラー: " + (e?.message ?? "不明なエラー"));
              } finally {
                if (!silent) setIsSyncing(false);
              }
            };

            if (newUserId !== oldUserId) {
              console.log(`[App] User ID changed from ${oldUserId} to ${newUserId}.`);
              if (oldUserId && oldUserId.includes("-")) {
                console.log("[App] Migrating data from local to new cloud user.");
                setMsg("データを統合中...");
                try {
                  await sqliteRepo.migrate(oldUserId, newUserId);
                  console.log("[App] Migration done.");
                } catch (e: any) {
                  // 統合に失敗しても、ログインと同期は続ける(ここで例外を出すと、同期まで進めずに止まってしまう)
                  console.error("[App] Migration error (continuing with sync):", e?.message ?? e);
                  setMsg("データの統合に失敗しました。同期を続けます");
                }
              }
              prevUserIdRef.current = newUserId;
              setUserId(newUserId);
              setMsg("クラウドから同期中...");
              // Safari からの復帰直後はネットワーク復元を 2 秒待ってから sync
              doSync(newUserId, 2000);
            } else if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
              // バックグラウンド復帰時も SIGNED_IN が再発行されることがあるため、
              // INITIAL_SESSION と同様に5分以内ならスキップ、それ以外はバックグラウンドで静かに同期
              console.log(`[App] ${event} event for existing user. Checking sync cooldown...`);
              try {
                const { Preferences } = await import('@capacitor/preferences');
                const { value: lastSyncStr } = await Preferences.get({ key: `last_sync_at_${newUserId}` });
                if (lastSyncStr) {
                  const elapsedMs = Date.now() - new Date(lastSyncStr).getTime();
                  if (elapsedMs < 5 * 60 * 1000) {
                    console.log(`[App] ${event}: last sync was ${Math.round(elapsedMs / 1000)}s ago, skipping.`);
                    return;
                  }
                }
              } catch (_) { /* Preferences 失敗は無視して同期実行 */ }
              // バックグラウンドで同期（UIをブロックしない）
              doSync(newUserId, 0, true);
            }
          } else if (event === "SIGNED_OUT") {
            console.log("[App] SIGNED_OUT event.");
            setNoAds(false);
            const localId = await getLocalUserId();
            if (prevUserIdRef.current !== localId) {
              console.log(`[App] Switching to local ID ${localId} after sign out.`);
              prevUserIdRef.current = localId;
              setUserId(localId);
              setUserEmail("offline-user@local");
              if (!deletingRef.current) setMsg("ログアウトしました");
            } else {
              console.log("[App] Already using local ID after sign out.");
            }
          }
        });
        sub = subscription;
        console.log("[App] Auth listener registered.");

      } catch (err: any) {
        console.error("[App] CRITICAL Error during setup:", err);
        const errorMsg = err.message || JSON.stringify(err);
        setMsg(`初期化エラー: ${errorMsg}`);

        // エラーでもローカルIDで動かせるように試行（ただしDBが壊れている可能性が高い）
        try {
          const id = await getLocalUserId();
          if (!prevUserIdRef.current) {
            console.log("[App] Falling back to local ID due to critical error:", id);
            setUserId(id);
          }
        } catch (e) {
          console.error("[App] Failed to get local user ID during error recovery:", e);
        }
        // エラー時もスプラッシュを必ず非表示に
        if (Capacitor.isNativePlatform()) {
          await SplashScreen.hide({ fadeOutDuration: 300 }).catch(() => {});
        }
      }
    };

    setupApp();
    
    // リトライ用のグローバルイベントリスナー
    const handleRetry = () => {
      console.log("[App] Retry initialization requested.");
      setMsg("再試行中...");
      setupApp();
    };
    window.addEventListener("lifeos:retryInit", handleRetry);

    return () => {
      window.removeEventListener("lifeos:retryInit", handleRetry);
      if (sub) {
        console.log("[App] Unsubscribing auth listener.");
        sub.unsubscribe();
      }
    };
  }, []);

  async function signInWithGoogle() {
    const { supabase } = await import("./lib/supabase");
    if (Capacitor.isNativePlatform()) {
      // iOS/Android: SFSafariViewController でアプリ内ブラウザを使用
      const { Browser } = await import("@capacitor/browser");
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'com.morikuma.habitas://login-callback',
          skipBrowserRedirect: true,
          // 前回の Google アカウントで自動的にログインせず、毎回アカウントを選べるようにする
          queryParams: { prompt: 'select_account' },
        }
      });
      if (error) { setMsg(`エラー: ${error.message}`); return; }
      if (data.url) await Browser.open({ url: data.url });
    } else {
      // Web: 通常のリダイレクト
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin, queryParams: { prompt: 'select_account' } }
      });
      if (error) setMsg(`エラー: ${error.message}`);
    }
  }

  async function signInWithApple() {
    try {
      const { SignInWithApple } = await import("@capacitor-community/apple-sign-in");
      const { supabase } = await import("./lib/supabase");

      // rawNonce を生成 → SHA-256ハッシュ化してAppleに渡す
      const rawNonce = Math.random().toString(36).substring(2)
        + Math.random().toString(36).substring(2);
      const msgBuffer = new TextEncoder().encode(rawNonce);
      const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
      const hashedNonce = Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, "0")).join("");

      const result = await SignInWithApple.authorize({
        clientId: "com.morikuma.habitas",
        redirectURI: "com.morikuma.habitas://login-callback",
        scopes: "email name",
        state: Math.random().toString(36).substring(2),
        nonce: hashedNonce, // Appleにはハッシュ済みを渡す
      });
      const identityToken = result.response.identityToken;
      if (!identityToken) { setMsg("Apple認証に失敗しました"); return; }
      const { error } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: identityToken,
        nonce: rawNonce, // Supabaseにはrawを渡す（Supabaseがハッシュ照合）
      });
      if (error) setMsg(`エラー: ${error.message}`);
    } catch (e: any) {
      if (e?.message !== "The operation was cancelled.") {
        setMsg(`Appleログインエラー: ${e?.message ?? "不明なエラー"}`);
      }
    }
  }

  async function signOut() {
    const { supabase } = await import("./lib/supabase");
    // Memory Calendar と同じアカウントを共有しているため、この端末だけログアウトする
    // (既定の global だと、全端末・Memory Calendar のログインまで外れる)
    await supabase.auth.signOut({ scope: "local" });
  }

  async function deleteAccount() {
    if (!userId) return;

    // Apple でログインした人は、削除の前に Apple のトークンも失効させる(Apple の確認画面が出る)。
    // 確認画面を閉じたら削除を中止する。失効に失敗しても削除は続行する(削除できなくなるのを避ける)。
    // サーバー側の削除より前に行う(失効の Edge Function はログイン中のユーザーのJWTが必要なため)
    const revocation = await revokeAppleAuthorizationIfNeeded();
    if (revocation === "cancelled") {
      setMsg("アカウントの削除を中止しました");
      return;
    }

    setIsDeleting(true);
    deletingRef.current = true;
    try {
      // サーバー側を先に削除する(失敗したら端末内のデータは消さない)。
      // 他のアプリ(Memory Calendar)も使っていなければアカウントごと削除される
      const accountDeleted = await deleteAppData();
      await cancelAllNotifications();
      await sqliteRepo.deleteAllUserData(userId);
      const { supabase } = await import("./lib/supabase");
      // アカウントが残る場合に他のアプリのログインを巻き込まないよう、この端末だけログアウトする
      await supabase.auth.signOut({ scope: "local" });
      setMsg(deleteDoneMessage(accountDeleted, revocation));
      setIsDeleting(false);
    } catch (err: any) {
      setMsg(`削除エラー: ${err.message}`);
      setIsDeleting(false);
    } finally {
      // SIGNED_OUT のハンドラは非同期で後から動くため、少し待ってから戻す
      setTimeout(() => { deletingRef.current = false; }, 3000);
    }
  }

  // ------- No-Ads フラグ -------
  // Supabase の user_profiles テーブルから no_ads フラグを取得し、
  // Capacitor Preferences にキャッシュする（オフライン対応）
  async function fetchNoAds(uid: string) {
    // まずキャッシュから即時ロード（起動直後に広告が見えるのを防ぐ）
    try {
      const { Preferences } = await import('@capacitor/preferences');
      const { value: cached } = await Preferences.get({ key: `no_ads_${uid}` });
      if (cached !== null) setNoAds(cached === 'true');
    } catch { /* キャッシュなし → そのまま続行 */ }

    // 次にネットワークから最新値を取得してキャッシュを更新
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('no_ads')
        .eq('user_id', uid)
        .maybeSingle();
      const value = data?.no_ads === true;
      setNoAds(value);
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.set({ key: `no_ads_${uid}`, value: String(value) });
    } catch {
      // ネットワーク失敗時はキャッシュ値のまま（上で既に設定済み）
    }
  }

  // noAds が true になったらバナーエリアも閉じる
  useEffect(() => {
    if (noAds) setAdHeight(0);
  }, [noAds]);

  // ------- Load base -------
  async function loadBase(overrideUid?: string) {
    const uid = overrideUid ?? userId;
    if (!uid) return;
    try {
      const dbTasks = await sqliteRepo.getTasks(uid);
      const dbActions = await sqliteRepo.getActions(uid);
      setTasks(dbTasks);
      setActions(dbActions);
    } catch (err: any) {
      setMsg(err?.message ?? "読み込みエラー");
    }
  }

  async function loadTodayEntries(overrideUid?: string) {
    const uid = overrideUid ?? userId;
    if (!uid) return;
    try {
      const ae = await sqliteRepo.getTodayActionEntries(uid, day);
      const doneIds = await sqliteRepo.getDoneTaskEntryIds(uid);

      const teToday = await sqliteRepo.getTodayTaskEntries(uid, day);
      const doneToday = new Set<string>();
      for (const t of teToday) {
        if (t.status === "done") doneToday.add(t.task_id);
      }

      setDoneTaskIds(doneToday);
      setDoneTaskIdsAnyDay(new Set(doneIds));
      setTodayActionEntries(ae);

      // 前日の目標を取得（同期後も確実に更新されるようApp側で管理）
      const prevDay = addDaysJST(day, -1);
      const prevLog = await sqliteRepo.getDailyLog(uid, prevDay).catch(() => null);
      setYesterdayGoal(prevLog?.tomorrow_note?.trim() || null);
    } catch (err: any) {
      setMsg(err?.message ?? "読み込みエラー");
    }
  }

  useEffect(() => {
    if (!userId) return;
    loadBase().catch((e: any) => setMsg(e?.message ?? "読み込みエラー"));
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    sqliteRepo.getNotificationSettings(userId).then(s => {
      if (s?.volume_unit) setVolumeUnit(s.volume_unit);
      if (s?.sort_rule) setSortRule(s.sort_rule as SortRule);
      if (typeof s?.prioritize_due === "boolean") setPrioritizeDue(s.prioritize_due);
    });
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    if (!localStorage.getItem("onboarding_done")) setOnboardingOpen(true);
  }, [userId]);

  const handleOnboardingClose = () => {
    setOnboardingOpen(false);
    localStorage.setItem("onboarding_done", "1");
  };

  const handleHabTutOpen = () => {
    setFabForceOpen(true);   // チュートリアル開始時はFABメニューを開いた状態にする
    setHabTutOpen(true);
  };

  const handleOpenHabitTutorialFromMenu = () => {
    setTab("today");         // 記録タブに移動
    setFabForceOpen(true);   // ＋ボタンが押下された状態を再現
    setHabTutOpen(true);
  };

  const handleHabTutClose = () => {
    setHabTutOpen(false);
    setFabForceOpen(false);
    localStorage.setItem("fab_tutorial_done", "1");
  };

  useEffect(() => {
    if (!userId) return;
    loadTodayEntries().catch((e: any) => setMsg(e?.message ?? "読み込みエラー"));
  }, [userId, day]);

  // ------- Widget Sync -------
  useEffect(() => {
    if (!userId || tasks.length === 0) return;
    syncWidgetData(tasks, doneTaskIds, doneTaskIdsAnyDay);
  }, [tasks, doneTaskIds, doneTaskIdsAnyDay]);

  // ウィジェットからの習慣完了をフォアグラウンド復帰時に処理
  useEffect(() => {
    if (!userId) return;
    const handleActive = async () => {
      // ウィジェットからの完了を処理
      const pendingIds = await processPendingCompletions();
      if (pendingIds.length > 0) {
        const today = (await import("./lib/day")).todayJST();
        for (const taskId of pendingIds) {
          await sqliteRepo.upsertTaskEntry({
            id: crypto.randomUUID(),
            user_id: userId,
            day: today,
            task_id: taskId,
            status: "done",
          });
        }
      }
      // フォアグラウンド復帰時は常にデータをリロード（今日の目標・完了状態を最新化）
      await loadBase(userId);
      await loadTodayEntries(userId);
      setDataVersion(v => v + 1);
    };

    // 起動直後にも一度チェック
    handleActive();

    const listener = CapApp.addListener("appStateChange", (state) => {
      if (state.isActive) handleActive();
    });
    return () => { listener.then(l => l.remove()); };
  }, [userId]);

  // 目標タブ(マンダラチャート)。同期・完了の切り替え・習慣の変更のたびに読み直す
  const mandalaRefreshKey = useMemo(() => ({}), [dataVersion, doneTaskIds, tasks]);
  const mandala = useMandala(userId, tasks, {
    refreshKey: mandalaRefreshKey,
    reloadTasks: () => loadBase(),
    onAfterWrite: webAutoSync,
  });
  // 記録タブのカードに出す、要素のチップ(習慣・タスクの id → 要素)
  const goalChips = useMemo(() => {
    const map = new Map<string, { label: string; color: string; element: number }>();
    for (const el of mandala.model?.elements ?? []) {
      if (!el.name) continue;
      for (const c of el.actions) {
        for (const t of c ? mandala.byCell.get(c.id) ?? [] : []) {
          map.set(t.id, { label: el.name, color: el.color, element: el.index });
        }
      }
    }
    return map;
  }, [mandala.model, mandala.byCell]);

  // ------- Render -------
  if (!userId) {
    return (
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", height: "100vh", background: "var(--bg)", color: "var(--text)", gap: "16px", padding: 20 }}>
        <p style={{ fontWeight: 700 }}>Initialzing LifeOS...</p>
        <p style={{ opacity: 0.7, fontSize: "0.9em" }}>Database is being prepared...</p>
        {msg && (
          <div style={{ textAlign: "center", background: "rgba(255,255,255,0.05)", padding: 16, borderRadius: 12, width: "100%", maxWidth: 320 }}>
             <p style={{ color: "var(--accent)", fontSize: "0.85em", marginBottom: 12, wordBreak: "break-all" }}>{msg}</p>
             
             {(msg.includes("UNIMPLEMENTED") || msg.includes("cap sync")) && (
               <div style={{ background: "rgba(0,0,0,0.2)", padding: 10, borderRadius: 8, textAlign: "left", fontSize: "0.75em", marginBottom: 16, borderLeft: "4px solid var(--accent)" }}>
                 <p style={{ fontWeight: 700, marginBottom: 4 }}>🔧 ネイティブ同期が必要です:</p>
                 <ol style={{ paddingLeft: 18, margin: 0 }}>
                   <li>Macのターミナルで <code>npx cap sync ios</code> を実行</li>
                   <li>Xcodeで <code>Product {' > '} Clean Build Folder</code></li>
                   <li>Xcodeで <code>Run</code> (再ビルド)</li>
                 </ol>
               </div>
             )}

             <button 
               onClick={() => window.dispatchEvent(new CustomEvent("lifeos:retryInit"))}
               style={{
                 background: "var(--accent)",
                 color: "white",
                 border: "none",
                 padding: "8px 16px",
                 borderRadius: 8,
                 fontWeight: 600,
                 cursor: "pointer"
               }}
             >
               Retry Initialization
             </button>
          </div>
        )}
      </div>
    );
  }

  const headerDateLabel = toHeaderDateLabel(day);

  async function handleSync() {
    if (!userId || isSyncing) return;
    setMsg("同期中...");
    setIsSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setMsg("同期エラー: ログインセッションがありません。再ログインしてください。");
        return;
      }
      const res = await sqliteRepo.sync(userId);
      setMsg(res.message);
      if (res.success) {
        await loadBase();
        await loadTodayEntries();
      }
    } finally {
      setIsSyncing(false);
    }
  }

  // Web版：書き込み後に自動同期（サイレント）
  async function webAutoSync() {
    if (Capacitor.getPlatform() !== 'web') return;
    if (!userId || !userEmail || userEmail === 'offline-user@local' || isSyncing) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await sqliteRepo.sync(userId);
    if (res.success) {
      await loadBase();
      await loadTodayEntries();
    }
  }

  return (
    <UserSettingsContext.Provider value={{ volumeUnit, sortRule, prioritizeDue }}>
    <AppShell
      userEmail={userEmail}
      onSignOut={signOut}
      onDeleteAccount={deleteAccount}
      onFetchAccountUsage={getAccountUsage}
      isDeleting={isDeleting}
      isSyncing={isSyncing}
      msg={msg}
      tab={tab}
      setTab={setTab}
      layoutStyle={layoutStyle}
      containerStyle={containerStyle}
      toastWrapStyle={toastWrapStyle}

      headerDateLabel={headerDateLabel}
      onPrevDay={() => safeShiftDay(-1)}
      onNextDay={canNext ? () => safeShiftDay(1) : undefined}
      canGoNext={canNext}
      onSync={handleSync}
      adHeight={adHeight}
      onSignInWithGoogle={signInWithGoogle}
      onSignInWithApple={Capacitor.getPlatform() === 'ios' ? signInWithApple : undefined}
      onDateSelect={safeSetDay}
      onOpenNotificationSettings={() => setNotifSettingsOpen(true)}
      onOpenUserSettings={() => setUserSettingsOpen(true)}
      onOpenOnboarding={() => setOnboardingOpen(true)}
      onOpenHabitTutorial={handleOpenHabitTutorialFromMenu}
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
          yesterdayGoal={yesterdayGoal}
          setMsg={setMsg}
          loadTodayEntries={loadTodayEntries}
          loadBase={loadBase}
          onAfterWrite={webAutoSync}
          adHeight={adHeight}
          goalChips={goalChips}
          onOpenGoal={(element) => { setGoalFocus({ element, nonce: Date.now() }); setTab("goal"); }}
        />
      )}

      {tab === "goal" && (
        <GoalView
          mandala={mandala}
          tasks={tasks}
          adHeight={adHeight}
          setMsg={setMsg}
          focus={goalFocus}
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
          cardStyle={cardStyle}
          dataVersion={dataVersion}
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
          cardStyle={cardStyle}

        />
      )}

      {tab === "today" && (
        <FABMenu
            onSelect={(type) => setOpenModal(type)}
            onFirstPress={handleHabTutOpen}
            forceOpen={fabForceOpen}
          />
      )}

      <RegisterModals
        openModal={openModal}
        setOpenModal={setOpenModal}
        userId={userId}
        day={day}
        tasks={tasks}
        actions={actions}
        doneTaskIdsAnyDay={doneTaskIdsAnyDay}
        setMsg={setMsg}
        loadBase={loadBase}
        loadTodayEntries={loadTodayEntries}
        onAfterWrite={webAutoSync}
        adHeight={adHeight}
      />

      <NotificationSettingsModal
        isOpen={notifSettingsOpen}
        onClose={() => setNotifSettingsOpen(false)}
        userId={userId}
        setMsg={setMsg}
        adHeight={adHeight}
      />

      <UserSettingsModal
        isOpen={userSettingsOpen}
        onClose={() => setUserSettingsOpen(false)}
        userId={userId}
        setMsg={setMsg}
        adHeight={adHeight}
        onVolumeUnitChange={setVolumeUnit}
        onSortSettingsChange={(rule, due) => { setSortRule(rule); setPrioritizeDue(due); }}
      />

      {/* AdMob Banner: no_ads フラグが false のときのみ表示 */}
      {!noAds && <BannerAd onStatusChange={setAdHeight} />}
    </AppShell>

    <LegacyAuthNotice
      isOpen={legacyNoticeOpen}
      onClose={() => {
        setLegacyNoticeOpen(false);
        // 付け替えに成功していれば、旧セッションの情報を消してお知らせを繰り返さない
        // (失敗していれば残して、次回起動でやり直す)
        if (legacyAdoptedRef.current) clearLegacySession();
      }}
    />
    <SpotlightTutorial isOpen={onboardingOpen} onClose={handleOnboardingClose} onSetTab={setTab} />
    <HabitTutorial
      isOpen={habTutOpen}
      onClose={handleHabTutClose}
      callbacks={{
        closeFABMenu: () => setFabForceOpen(false),
        openHabitModal: () => setOpenModal("habit"),
      }}
    />
    </UserSettingsContext.Provider>
  );
}
