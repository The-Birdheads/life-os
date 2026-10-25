import { describe, it, expect, vi } from "vitest";
import {
  LEGACY_SESSION_KEY,
  adoptLegacyUserData,
  clearLegacySession,
  readLegacySessionUserId,
} from "./legacyAuthMigration";

function makeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    removeItem: (k: string) => void data.delete(k),
    has: (k: string) => data.has(k),
  };
}

const legacySession = (id: string) => JSON.stringify({ access_token: "x", user: { id } });

describe("readLegacySessionUserId", () => {
  it("旧セッションのユーザーIDを返す", () => {
    const storage = makeStorage({ [LEGACY_SESSION_KEY]: legacySession("old-uid") });
    expect(readLegacySessionUserId(storage)).toBe("old-uid");
  });

  it("旧セッションが無い・壊れている・ユーザーIDが無いときは null", () => {
    expect(readLegacySessionUserId(makeStorage())).toBeNull();
    expect(readLegacySessionUserId(makeStorage({ [LEGACY_SESSION_KEY]: "{not json" }))).toBeNull();
    expect(readLegacySessionUserId(makeStorage({ [LEGACY_SESSION_KEY]: JSON.stringify({ user: {} }) }))).toBeNull();
    expect(readLegacySessionUserId(null)).toBeNull();
  });
});

describe("adoptLegacyUserData", () => {
  it("旧セッションのユーザーのデータをローカルIDへ付け替える", async () => {
    const repo = { migrate: vi.fn().mockResolvedValue(undefined) };
    const storage = makeStorage({ [LEGACY_SESSION_KEY]: legacySession("old-uid") });

    const result = await adoptLegacyUserData(repo, "local-id", storage);

    expect(repo.migrate).toHaveBeenCalledWith("old-uid", "local-id");
    expect(result).toEqual({ hadLegacySession: true, adopted: true });
    // 旧セッション情報はお知らせを閉じるまで残す(ここでは消さない)
    expect(storage.has(LEGACY_SESSION_KEY)).toBe(true);
  });

  it("旧セッションが無い(更新前にログアウトしていた・新規)なら何もしない", async () => {
    const repo = { migrate: vi.fn() };

    const result = await adoptLegacyUserData(repo, "local-id", makeStorage());

    expect(repo.migrate).not.toHaveBeenCalled();
    expect(result).toEqual({ hadLegacySession: false, adopted: false });
  });

  it("付け替えに失敗したら adopted=false を返す(旧セッションは残して次回やり直す)", async () => {
    const repo = { migrate: vi.fn().mockRejectedValue(new Error("db error")) };
    const storage = makeStorage({ [LEGACY_SESSION_KEY]: legacySession("old-uid") });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await adoptLegacyUserData(repo, "local-id", storage);

    expect(result).toEqual({ hadLegacySession: true, adopted: false });
    expect(storage.has(LEGACY_SESSION_KEY)).toBe(true);
  });

  it("clearLegacySession は旧セッションを消す", () => {
    const storage = makeStorage({ [LEGACY_SESSION_KEY]: legacySession("old-uid") });
    clearLegacySession(storage);
    expect(storage.has(LEGACY_SESSION_KEY)).toBe(false);
  });
});
