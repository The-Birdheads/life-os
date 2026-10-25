import { describe, it, expect, vi, beforeEach } from "vitest";

const { rpc, schema, getUser, invoke, authorize, getPlatform } = vi.hoisted(() => {
  const rpc = vi.fn();
  const schema = vi.fn(() => ({ rpc }));
  return {
    rpc,
    schema,
    getUser: vi.fn(),
    invoke: vi.fn(),
    authorize: vi.fn(),
    getPlatform: vi.fn(() => "ios"),
  };
});

vi.mock("./supabase", () => ({
  supabase: { schema, auth: { getUser }, functions: { invoke } },
}));
vi.mock("@capacitor/core", () => ({ Capacitor: { getPlatform } }));
vi.mock("@capacitor-community/apple-sign-in", () => ({ SignInWithApple: { authorize } }));

import {
  deleteAppData,
  deleteConfirmMessage,
  deleteConfirmVariant,
  deleteDoneMessage,
  getAccountUsage,
  registerAppUse,
  revokeAppleAuthorizationIfNeeded,
} from "./accountApi";

beforeEach(() => {
  vi.clearAllMocks();
  getPlatform.mockReturnValue("ios");
});

describe("accountApi", () => {
  it("RPC は habitas ではなく public スキーマで呼ぶ", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await registerAppUse();
    expect(schema).toHaveBeenCalledWith("public");
    expect(rpc).toHaveBeenCalledWith("register_app_use", { p_app: "habitas" });
  });

  it("registerAppUse は失敗しても例外を出さない", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    rpc.mockRejectedValue(new Error("offline"));
    await expect(registerAppUse()).resolves.toBeUndefined();
  });

  it("getAccountUsage は利用アプリ一覧を返し、失敗時は null", async () => {
    rpc.mockResolvedValueOnce({ data: ["habitas", "memory_calendar"], error: null });
    expect(await getAccountUsage()).toEqual(["habitas", "memory_calendar"]);
    rpc.mockResolvedValueOnce({ data: null, error: { message: "x" } });
    expect(await getAccountUsage()).toBeNull();
    rpc.mockRejectedValueOnce(new Error("offline"));
    expect(await getAccountUsage()).toBeNull();
  });

  it("deleteAppData は結果(アカウントごと削除したか)を返し、エラーは投げる", async () => {
    rpc.mockResolvedValueOnce({ data: true, error: null });
    expect(await deleteAppData()).toBe(true);
    expect(rpc).toHaveBeenCalledWith("delete_app_data", { p_app: "habitas" });
    rpc.mockResolvedValueOnce({ data: false, error: null });
    expect(await deleteAppData()).toBe(false);
    rpc.mockResolvedValueOnce({ data: null, error: new Error("denied") });
    await expect(deleteAppData()).rejects.toThrow("denied");
  });

  it("削除確認の文言は、Memory Calendar の利用有無で出し分ける", () => {
    expect(deleteConfirmVariant(["habitas"])).toBe("account");
    expect(deleteConfirmVariant(["habitas", "memory_calendar"])).toBe("data-only");
    expect(deleteConfirmVariant(null)).toBe("unknown");
    expect(deleteConfirmMessage("data-only")).toContain("アカウント自体");
    expect(deleteConfirmMessage("account")).toContain("アカウントも削除");
    expect(deleteDoneMessage(true)).toBe("アカウントを削除しました");
    expect(deleteDoneMessage(false)).toContain("Memory Calendar");
    expect(deleteDoneMessage(true, "revoked")).toContain("Appleのサインインも解除しました");
    expect(deleteDoneMessage(true, "failed")).toContain("解除に失敗しました");
    expect(deleteDoneMessage(true, "not-apple")).toBe("アカウントを削除しました");
  });
});

describe("revokeAppleAuthorizationIfNeeded", () => {
  const appleUser = { identities: [{ provider: "apple" }] };

  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("does nothing for users who did not sign in with Apple (e.g. Google)", async () => {
    getUser.mockResolvedValue({ data: { user: { identities: [{ provider: "google" }] } }, error: null });

    expect(await revokeAppleAuthorizationIfNeeded()).toBe("not-apple");
    expect(authorize).not.toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("gets a fresh authorization code for Habitas and asks the Edge Function to revoke it", async () => {
    getUser.mockResolvedValue({ data: { user: appleUser }, error: null });
    authorize.mockResolvedValue({ response: { authorizationCode: "code-123" } });
    invoke.mockResolvedValue({ data: { revoked: true }, error: null });

    expect(await revokeAppleAuthorizationIfNeeded()).toBe("revoked");
    expect(authorize).toHaveBeenCalledWith(expect.objectContaining({ clientId: "com.morikuma.habitas" }));
    expect(invoke).toHaveBeenCalledWith("revoke-apple-token", {
      body: { authorizationCode: "code-123", clientId: "com.morikuma.habitas" },
    });
  });

  it("returns cancelled (so the deletion is aborted) when the user dismisses Apple's confirmation", async () => {
    getUser.mockResolvedValue({ data: { user: appleUser }, error: null });
    authorize.mockRejectedValue(
      new Error("The operation couldn’t be completed. (com.apple.AuthenticationServices.AuthorizationError error 1001.)")
    );

    expect(await revokeAppleAuthorizationIfNeeded()).toBe("cancelled");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("returns failed (deletion may continue) for other Apple errors, a missing code, or an Edge Function error", async () => {
    getUser.mockResolvedValue({ data: { user: appleUser }, error: null });

    authorize.mockRejectedValueOnce(new Error("something else"));
    expect(await revokeAppleAuthorizationIfNeeded()).toBe("failed");

    authorize.mockResolvedValueOnce({ response: { authorizationCode: "" } });
    expect(await revokeAppleAuthorizationIfNeeded()).toBe("failed");

    authorize.mockResolvedValueOnce({ response: { authorizationCode: "code" } });
    invoke.mockResolvedValueOnce({ data: null, error: new Error("502") });
    expect(await revokeAppleAuthorizationIfNeeded()).toBe("failed");
  });

  it("returns failed without prompting when not on iOS, or when the user cannot be fetched", async () => {
    getUser.mockResolvedValue({ data: { user: appleUser }, error: null });
    getPlatform.mockReturnValue("android");
    expect(await revokeAppleAuthorizationIfNeeded()).toBe("failed");
    expect(authorize).not.toHaveBeenCalled();

    getPlatform.mockReturnValue("ios");
    getUser.mockResolvedValue({ data: { user: null }, error: new Error("no session") });
    expect(await revokeAppleAuthorizationIfNeeded()).toBe("failed");
  });
});
