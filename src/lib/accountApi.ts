import { Capacitor } from "@capacitor/core";
import { supabase } from "./supabase";

/**
 * Memory Calendar と共通のアカウントに関する、public スキーマの RPC。
 * (supabase クライアントの既定スキーマは habitas のため、`schema("public")` を明示する)
 */

export type AppId = "habitas" | "memory_calendar";

const APP_ID: AppId = "habitas";

/** Sign in with Apple の client_id(= Habitas のバンドルID)。revoke-apple-token の clientId にも渡す */
const APPLE_CLIENT_ID = "com.morikuma.habitas";

/**
 * このアカウントが Habitas を使い始めたことを記録する。冪等。
 * 失敗しても利用は妨げない(次回ログイン時にやり直す)。
 */
export async function registerAppUse(): Promise<void> {
  try {
    const { error } = await supabase.schema("public").rpc("register_app_use", { p_app: APP_ID });
    if (error) console.warn("[account] register_app_use failed:", error.message);
  } catch (e) {
    console.warn("[account] register_app_use error:", e);
  }
}

/**
 * このアカウントが使っているアプリの一覧。取得できなかったときは null。
 * アカウント削除の確認画面で、文言を出し分けるために使う。
 */
export async function getAccountUsage(): Promise<AppId[] | null> {
  try {
    const { data, error } = await supabase.schema("public").rpc("get_account_usage");
    if (error || !Array.isArray(data)) return null;
    return data as AppId[];
  } catch {
    return null;
  }
}

/**
 * Habitas のデータを削除する。他のアプリも使っていなければアカウントごと削除される。
 * 戻り値: true = アカウントごと削除した / false = Habitas のデータだけ削除した(アカウントは残る)
 */
export async function deleteAppData(): Promise<boolean> {
  const { data, error } = await supabase.schema("public").rpc("delete_app_data", { p_app: APP_ID });
  if (error) throw error;
  return data === true;
}

export type AppleRevocationOutcome = "not-apple" | "revoked" | "failed" | "cancelled";

function isAppleCancellation(e: unknown): boolean {
  const { code, message } = (e ?? {}) as { code?: unknown; message?: unknown };
  // iOS の ASAuthorizationError.canceled(1001)。プラグインは localizedDescription を reject する
  return /1001|cancel/i.test(`${String(code ?? "")} ${String(message ?? "")}`);
}

/**
 * アカウント削除の直前に呼ぶ。Apple でサインインしたユーザーの場合だけ、Apple の確認画面で
 * 本人確認(= 新しい認可コードの取得)をしてから、Edge Function 経由で Apple のトークンを失効させる
 * (App Store ガイドライン 5.1.1(v))。Apple の失効はアプリ単位なので、Habitas の client_id で行う。
 * - "cancelled": 確認画面を閉じた(削除を中止すべき)
 * - "failed": 失効できなかった(削除自体は続行してよい)
 * - "not-apple": Apple のユーザーではないので何もしていない
 */
export async function revokeAppleAuthorizationIfNeeded(): Promise<AppleRevocationOutcome> {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      console.warn("[account] revoke skipped: could not get the user:", userError?.message);
      return "failed";
    }
    const providers = (user.identities ?? []).map((identity) => identity.provider);
    if (!providers.includes("apple")) {
      console.log(`[account] revoke not needed: not an Apple user (providers: ${providers.join(",") || "none"})`);
      return "not-apple";
    }

    // Apple のネイティブ認証が使えるのは iOS のみ
    if (Capacitor.getPlatform() !== "ios") {
      console.warn("[account] revoke skipped: not on iOS");
      return "failed";
    }

    let authorizationCode: string | null | undefined;
    try {
      const { SignInWithApple } = await import("@capacitor-community/apple-sign-in");
      const result = await SignInWithApple.authorize({
        clientId: APPLE_CLIENT_ID,
        redirectURI: `${APPLE_CLIENT_ID}://login-callback`,
        scopes: "",
        state: Math.random().toString(36).substring(2),
      });
      authorizationCode = result.response.authorizationCode;
    } catch (e) {
      const cancelled = isAppleCancellation(e);
      console.warn(`[account] Apple authorization ${cancelled ? "cancelled" : "failed"}:`, (e as Error)?.message ?? e);
      return cancelled ? "cancelled" : "failed";
    }
    if (!authorizationCode) {
      console.warn("[account] Apple returned no authorization code");
      return "failed";
    }

    const { error } = await supabase.functions.invoke("revoke-apple-token", {
      body: { authorizationCode, clientId: APPLE_CLIENT_ID },
    });
    if (error) {
      // 失効に失敗しても削除は続行するため、原因調査用にログだけ残す(詳細は Edge Function のログ)
      console.warn("[account] revoke-apple-token failed:", error.message ?? error);
      return "failed";
    }
    console.log("[account] Apple authorization revoked");
    return "revoked";
  } catch (e) {
    console.warn("[account] revokeAppleAuthorizationIfNeeded error:", e);
    return "failed";
  }
}

export type DeleteConfirmVariant = "account" | "data-only" | "unknown";

/** 使用中アプリの一覧から、削除確認画面の種類を決める。 */
export function deleteConfirmVariant(usage: AppId[] | null): DeleteConfirmVariant {
  if (usage === null) return "unknown";
  return usage.includes("memory_calendar") ? "data-only" : "account";
}

export function deleteConfirmMessage(variant: DeleteConfirmVariant): string {
  switch (variant) {
    case "data-only":
      return "Habitasのデータがすべて削除されます。このアカウントはMemory Calendarでも使われているため、アカウント自体とMemory Calendarのデータは削除されません。削除したデータは復元できませんがよろしいですか？";
    case "account":
      return "登録済みのすべてのデータが削除され、アカウントも削除されます。復元することはできませんがよろしいですか？";
    default:
      return "Habitasのデータがすべて削除されます。Memory Calendarなど他のアプリでもこのアカウントを使っている場合、アカウント自体は削除されません。削除したデータは復元できませんがよろしいですか？";
  }
}

export function deleteDoneMessage(accountDeleted: boolean, revocation?: AppleRevocationOutcome): string {
  const base = accountDeleted
    ? "アカウントを削除しました"
    : "Habitasのデータを削除しました（アカウントはMemory Calendarで引き続き使えます）";
  // Apple でログインした人には、Apple 側の連携解除の結果も伝える(失敗時は手動で解除できる)
  if (revocation === "revoked") return `${base}。Appleのサインインも解除しました`;
  if (revocation === "failed") {
    return `${base}。Appleのサインインの解除に失敗しました。iPhoneの設定アプリの「Appleでサインイン」から解除できます`;
  }
  return base;
}
