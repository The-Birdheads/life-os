import { useEffect, useState, useRef } from "react";
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
import { initSqlite } from "./lib/db/initSqlite";
import { getLocalUserId } from "./lib/db/localUser";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { AdMob } from "@capacitor-community/admob";
import { StatusBar, Style } from "@capacitor/status-bar";
import BannerAd from "./components/ui/BannerAd";
import { supabase } from "./lib/supabase";
import { scheduleNotifications, setupNotificationListeners } from "./lib/notifications";
import { sqliteRepo } from "./lib/db/instance";
import {
  cardStyle,
  layoutStyle,
  containerStyle,
  toastWrapStyle,
  toastStyle,
} from "./lib/ui/style";

// グローバルなリポジトリインスタンスは ./lib/db/instance.ts へ移動しました

type Tab = "today" | "review" | "week";

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
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) {
            console.error('[App] Failed to set session from deep link:', error.message);
            setMsg(`ログインエラー: ${error.message}`);
          } else {
            setMsg('ログイン中...');
            window.location.hash = ''; // ハッシュを消去
            setTimeout(() => window.location.reload(), 100);
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

  // ------- Modals -------
  const [openModal, setOpenModal] = useState<"habit" | "oneoff" | "action" | null>(null);
  const [notifSettingsOpen, setNotifSettingsOpen] = useState(false);

  const prevUserIdRef = useRef<string | null>(null);
  const isSyncingRef = useRef(false);

  // 一体化した初期化フロー
  useEffect(() => {
    let sub: any;

    const setupApp = async () => {
      try {
        console.log("[App] Starting initialization...");

        // 1. 基本的な初期化（AdMob / SQL / StatusBar）
        if (Capacitor.getPlatform() !== 'web') {
          if (Capacitor.getPlatform() === 'ios') {
            try { await AdMob.requestTrackingAuthorization(); } catch (e) { }
          }
          await AdMob.initialize();
          try {
            await StatusBar.setStyle({ style: Style.Dark });
            await StatusBar.setBackgroundColor({ color: '#1E293B' });
          } catch (e) {
            console.warn("[App] StatusBar setting failed", e);
          }
        }

        console.log("[App] Initializing SQL...");
        await initSqlite();
        console.log("[App] SQL Initialized.");

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
          console.log("[App] Initial ID from Supabase session:", initialId);
        } else {
          initialId = await getLocalUserId();
          setUserEmail("offline-user@local");
          console.log("[App] Initial ID from local storage:", initialId);
        }

        console.log("[App] Setting initial ID:", initialId);
        prevUserIdRef.current = initialId;
        setUserId(initialId);

        // 4. 認証リスナーの登録
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
          console.log("[App] Auth Event:", event, session?.user?.id ? `User ID: ${session.user.id}` : "No user in session");
          const newUserId = session?.user?.id;
          const oldUserId = prevUserIdRef.current;

          if (session?.user && newUserId) {
            setUserEmail(session.user.email ?? "");
            if (newUserId !== oldUserId) {
              console.log(`[App] User ID changed from ${oldUserId} to ${newUserId}.`);
              if (oldUserId && oldUserId.includes("-")) {
                console.log("[App] Migrating data from local to new cloud user.");
                setMsg("データを統合中...");
                await sqliteRepo.migrate(oldUserId, newUserId);
              }
              console.log("[App] Syncing data from cloud.");
              handleSync(newUserId);
            } else if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
              console.log("[App] SIGNED_IN or INITIAL_SESSION event for existing user. Syncing data.");
              handleSync(newUserId);
            }
          } else if (event === "SIGNED_OUT") {
            console.log("[App] SIGNED_OUT event.");
            const localId = await getLocalUserId();
            if (prevUserIdRef.current !== localId) {
              console.log(`[App] Switching to local ID ${localId} after sign out.`);
              prevUserIdRef.current = localId;
              setUserId(localId);
              setUserEmail("offline-user@local");
              setMsg("ログアウトしました");
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
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: Capacitor.isNativePlatform() ? 'com.morikuma.habitas://login-callback' : window.location.origin
      }
    });
    if (error) setMsg(`エラー: ${error.message}`);
  }

  async function signOut() {
    const { supabase } = await import("./lib/supabase");
    await supabase.auth.signOut();
  }

  // ------- Load base -------
  async function loadBase(targetId: string = userId!) {
    if (!targetId) return;
    try {
      const dbTasks = await sqliteRepo.getTasks(targetId);
      const dbActions = await sqliteRepo.getActions(targetId);
      setTasks(dbTasks);
      setActions(dbActions);
    } catch (err: any) {
      setMsg(err?.message ?? "読み込みエラー");
    }
  }

  async function loadTodayEntries(targetId: string = userId!) {
    if (!targetId) return;
    try {
      const ae = await sqliteRepo.getTodayActionEntries(targetId, day);
      const doneIds = await sqliteRepo.getDoneTaskEntryIds(targetId);

      const teToday = await sqliteRepo.getTodayTaskEntries(targetId, day);
      const doneToday = new Set<string>();
      for (const t of teToday) {
        if (t.status === "done") doneToday.add(t.task_id);
      }

      setDoneTaskIds(doneToday);
      setDoneTaskIdsAnyDay(new Set(doneIds));
      setTodayActionEntries(ae);
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
    loadTodayEntries().catch((e: any) => setMsg(e?.message ?? "読み込みエラー"));
  }, [userId, day]);

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

  async function handleSync(targetId: string = userId!) {
    if (!targetId) return;
    if (isSyncingRef.current) {
      console.log("[App] Sync already in progress.");
      return;
    }
    
    isSyncingRef.current = true;
    try {
      setMsg("同期中...");
      const res = await sqliteRepo.sync(targetId);
      setMsg(res.message);
      if (res.success) {
        await loadBase(targetId);
        await loadTodayEntries(targetId);
      }
    } finally {
      isSyncingRef.current = false;
    }
  }

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
      onPrevDay={() => safeShiftDay(-1)}
      onNextDay={canNext ? () => safeShiftDay(1) : undefined}
      canGoNext={canNext}
      onSync={handleSync}
      adHeight={adHeight}
      onSignInWithGoogle={signInWithGoogle}
      onDateSelect={safeSetDay}
      onOpenNotificationSettings={() => setNotifSettingsOpen(true)}
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
          cardStyle={cardStyle}
          loadTodayEntries={loadTodayEntries}
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
          cardStyle={cardStyle}

        />
      )}

      {tab === "today" && (
        <FABMenu onSelect={(type) => setOpenModal(type)} />
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
        adHeight={adHeight}
      />

      <NotificationSettingsModal
        isOpen={notifSettingsOpen}
        onClose={() => setNotifSettingsOpen(false)}
        userId={userId}
        setMsg={setMsg}
        adHeight={adHeight}
      />

      {/* AdMob Banner */}
      <BannerAd onStatusChange={setAdHeight} />
    </AppShell>
  );
}
