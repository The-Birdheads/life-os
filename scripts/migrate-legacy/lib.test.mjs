import { describe, it, expect } from "vitest";
import {
  TABLE_BY_NAME,
  chunk,
  dropOrphans,
  identityKeys,
  identitySql,
  indexUsers,
  missingIdentities,
  matchUser,
  normalizeEmail,
  planTable,
  transformRow,
} from "./lib.mjs";

const NEW_USER = "11111111-1111-4111-8111-111111111111";
const ID1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ID2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("ユーザーの突き合わせ", () => {
  const newUsers = [
    { id: "n1", email: "Alice@Example.com", identities: [{ provider: "google", identity_data: { sub: "g-111" } }] },
    { id: "n2", email: "relay@privaterelay.appleid.com", identities: [{ provider: "apple", identity_data: { sub: "a-222" } }] },
    { id: "n3", email: "bob@example.com", identities: [{ provider: "email" }] },
  ];
  const index = indexUsers(newUsers);

  it("識別子(sub)を取り出す。apple/google 以外は無視する", () => {
    expect(identityKeys(newUsers[0])).toEqual(["google:g-111"]);
    expect(identityKeys(newUsers[2])).toEqual([]);
    expect(identityKeys({ identities: [{ provider: "apple", provider_id: "p-1" }] })).toEqual(["apple:p-1"]);
  });

  it("Apple の sub が一致すれば、メールが違っても同じユーザーとみなす", () => {
    const m = matchUser({ email: "other@example.com", identities: [{ provider: "apple", identity_data: { sub: "a-222" } }] }, index);
    expect(m.user.id).toBe("n2");
    expect(m.via).toBe("apple-sub");
  });

  it("Google の sub が一致すればそのユーザー", () => {
    const m = matchUser({ email: "x@example.com", identities: [{ provider: "google", identity_data: { sub: "g-111" } }] }, index);
    expect(m.user.id).toBe("n1");
    expect(m.via).toBe("google-sub");
  });

  it("識別子が無い・一致しないときは、メール(大文字小文字を区別しない)で探す", () => {
    expect(matchUser({ email: "alice@example.com", identities: [] }, index).via).toBe("email");
    expect(matchUser({ email: "BOB@example.com" }, index).user.id).toBe("n3");
  });

  it("どれも一致しなければ null", () => {
    expect(matchUser({ email: "nobody@example.com", identities: [] }, index)).toBeNull();
    expect(matchUser({ email: null }, index)).toBeNull();
    expect(normalizeEmail("  A@B.com ")).toBe("a@b.com");
  });
});

describe("行の変換", () => {
  const tasks = TABLE_BY_NAME.tasks;

  it("user_id を新しいユーザーに付け替え、行IDは変えない。0/1 の真偽値を boolean にし、空の日付は null にする", () => {
    const { row, error } = transformRow(tasks, {
      id: ID1, user_id: "legacy-uid", title: "運動", task_type: "habit", due_date: "", is_active: 1, is_hidden: 0,
      priority: 2, volume: 5, memo: "", remind_on: "1", remind_hour: 8, remind_minute: 0,
      deleted_at: null, updated_at: "2026-10-01T00:00:00Z", unknown_column: "x",
    }, NEW_USER);
    expect(error).toBeUndefined();
    expect(row.id).toBe(ID1);
    expect(row.user_id).toBe(NEW_USER);
    expect(row.is_active).toBe(true);
    expect(row.is_hidden).toBe(false);
    expect(row.remind_on).toBe(true);
    expect(row.due_date).toBeNull();
    expect(row.memo).toBeNull();
    expect(row).not.toHaveProperty("unknown_column");
  });

  it("uuid でない行IDの行は、移行せずエラーにする", () => {
    const { error } = transformRow(tasks, { id: "not-a-uuid", title: "t", task_type: "habit" }, NEW_USER);
    expect(error).toContain("uuid");
  });

  it("task_entries は task_id も uuid であること。notification_settings の id が無ければ補う", () => {
    expect(transformRow(TABLE_BY_NAME.task_entries, { id: ID1, day: "2026-10-01", task_id: "x", status: "done" }, NEW_USER).error).toContain("task_id");
    const ns = transformRow(TABLE_BY_NAME.notification_settings, { habit_remind_on: 0 }, NEW_USER);
    expect(ns.row.id).toBe(`settings_${NEW_USER}`);
    expect(ns.row.habit_remind_on).toBe(false);
  });
});

describe("書き込み計画", () => {
  const tasks = TABLE_BY_NAME.tasks;

  it("移行先に無ければ追加、あれば移行元が新しいときだけ更新、それ以外は変更なし(移行先の新しいデータを上書きしない)", () => {
    const source = [
      { id: ID1, updated_at: "2026-10-01T00:00:00Z" }, // 移行先に無い
      { id: ID2, updated_at: "2026-10-05T00:00:00Z" }, // 移行元が新しい
      { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", updated_at: "2026-10-01T00:00:00Z" }, // 移行先が新しい
    ];
    const target = [
      { id: ID2, updated_at: "2026-10-02T00:00:00Z" },
      { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", updated_at: "2026-10-09T00:00:00Z" },
    ];
    const plan = planTable(tasks, source, target);
    expect(plan.insert.map((r) => r.id)).toEqual([ID1]);
    expect(plan.update.map((r) => r.id)).toEqual([ID2]);
    expect(plan.skip.length).toBe(1);
  });

  it("task_entries は (日付, task_id) で同じ行かを判断し、daily_logs は日付で判断する", () => {
    const entries = TABLE_BY_NAME.task_entries;
    const plan = planTable(entries,
      [{ id: ID1, day: "2026-10-01", task_id: "t1", updated_at: "2026-10-03T00:00:00Z" }],
      [{ id: ID2, day: "2026-10-01", task_id: "t1", updated_at: "2026-10-01T00:00:00Z" }]);
    expect(plan.update.length).toBe(1);
    const logs = planTable(TABLE_BY_NAME.daily_logs, [{ day: "2026-10-01", updated_at: "2026-10-01T00:00:00Z" }], []);
    expect(logs.insert.length).toBe(1);
  });

  it("参照先の無い entries を取り除く", () => {
    const { kept, orphans } = dropOrphans("task_entries", [{ task_id: "t1" }, { task_id: "gone" }], new Set(["t1"]));
    expect(kept.length).toBe(1);
    expect(orphans.length).toBe(1);
    expect(dropOrphans("action_entries", [{ action_id: "a1" }], new Set(["a1"])).kept.length).toBe(1);
  });

  it("chunk は配列を指定サイズに分ける", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 3)).toEqual([]);
  });
});

describe("識別子の引き継ぎ", () => {
  const legacyUser = {
    identities: [
      { provider: "apple", identity_data: { sub: "a-1", email: "relay@privaterelay.appleid.com" } },
      { provider: "google", identity_data: { sub: "g-1" } },
      { provider: "email", identity_data: { sub: "e-1" } },
    ],
  };

  it("新ユーザーに無い Apple/Google の識別子だけを返す(email は対象外)", () => {
    const target = { identities: [{ provider: "google", identity_data: { sub: "g-1" } }, { provider: "email" }] };
    const missing = missingIdentities(legacyUser, target);
    expect(missing.map((i) => `${i.provider}:${i.provider_id}`)).toEqual(["apple:a-1"]);
    expect(missing[0].identity_data).toEqual({ sub: "a-1", email: "relay@privaterelay.appleid.com" });
    expect(missingIdentities(legacyUser, { identities: legacyUser.identities }).length).toBe(0);
    expect(missingIdentities(legacyUser, null).length).toBe(2);
  });

  it("登録 SQL は冪等で、値の引用符をエスケープする", () => {
    const sql = identitySql("uid-1", { provider: "apple", provider_id: "a'1", identity_data: { sub: "a'1", name: "O'Brien" } });
    expect(sql).toContain("insert into auth.identities");
    expect(sql).toContain("on conflict (provider_id, provider) do nothing;");
    expect(sql).toContain("'a''1'");
    expect(sql).toContain("O''Brien");
    expect(sql).toContain("::jsonb");
  });
});
