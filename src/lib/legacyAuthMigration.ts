/**
 * 旧 Supabase プロジェクトからの移行(Memory Calendar とのログイン共通化)で、
 * 更新前にログインしていた端末のデータを引き継ぐための処理。
 *
 * 背景:
 * - 接続先プロジェクトが変わると、ログイン状態の保存先(localStorage のキー)が変わるため、
 *   更新後は未ログインになる。
 * - 端末内の SQLite のデータは旧クラウドのユーザーID(旧セッションの user.id)に紐づいており、
 *   そのままだと、更新後の未ログイン状態(端末ごとのローカルID)では見えなくなる。
 * → 更新後の初回起動で、旧セッションのユーザーIDを見つけて、ローカルIDへ付け替える。
 *   その後ログインすれば、既存の「ローカル → クラウド」の移行(App.tsx の onAuthStateChange)で、
 *   サーバー側に移行済みのデータと統合される(行IDは移行スクリプトが保持する前提)。
 */

/** 旧プロジェクトの ref(旧 VITE_SUPABASE_URL のサブドメイン) */
export const LEGACY_PROJECT_REF = "nxspggurjyguhbdkraog";

/** supabase-js が旧プロジェクトのセッションを保存していたキー */
export const LEGACY_SESSION_KEY = `sb-${LEGACY_PROJECT_REF}-auth-token`;

type StorageLike = Pick<Storage, "getItem" | "removeItem">;

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** 旧プロジェクトで最後にログインしていたユーザーID。ログアウト状態だった・該当なしなら null。 */
export function readLegacySessionUserId(storage: StorageLike | null = defaultStorage()): string | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(LEGACY_SESSION_KEY);
    if (!raw) return null;
    const id = JSON.parse(raw)?.user?.id;
    return typeof id === "string" && id.length > 0 ? id : null;
  } catch {
    return null;
  }
}

export function clearLegacySession(storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.removeItem(LEGACY_SESSION_KEY);
  } catch {
    /* 失敗しても動作に影響しない */
  }
}

export type LegacyMigrationResult = {
  /** 旧セッションが見つかったか(= 更新前にログインしていた端末か) */
  hadLegacySession: boolean;
  /** 端末内データのローカルIDへの付け替えに成功したか */
  adopted: boolean;
};

/**
 * 更新前にログインしていた端末なら、端末内データを localId へ付け替える。
 * 未ログイン(ローカルID)で起動したときにだけ呼ぶこと。冪等。
 * 付け替えに失敗したときは旧セッション情報を残し、次回起動でやり直す。
 */
export async function adoptLegacyUserData(
  repo: { migrate(oldUserId: string, newUserId: string): Promise<void> },
  localId: string,
  storage: StorageLike | null = defaultStorage()
): Promise<LegacyMigrationResult> {
  const legacyUserId = readLegacySessionUserId(storage);
  if (!legacyUserId) {
    console.log("[legacy] no legacy session found (not logged in before the update, or storage was cleared)");
    return { hadLegacySession: false, adopted: false };
  }
  if (legacyUserId === localId) return { hadLegacySession: true, adopted: true };

  try {
    await repo.migrate(legacyUserId, localId);
    console.log(`[legacy] adopted local data of the legacy account ${legacyUserId} into local mode ${localId}`);
    return { hadLegacySession: true, adopted: true };
  } catch (e) {
    console.error("[legacy] Failed to adopt legacy user data:", e);
    return { hadLegacySession: true, adopted: false };
  }
}
