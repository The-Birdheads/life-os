import { describe, expect, it } from "vitest";
import { storedSessionUser } from "./storedSession";

const storage = (items: Record<string, string>) => {
    const keys = Object.keys(items);
    return { length: keys.length, key: (i: number) => keys[i] ?? null, getItem: (k: string) => items[k] ?? null };
};

describe("端末に残っているログイン", () => {
    it("Supabase のログインの保存から、ユーザーを読む", () => {
        const s = storage({ other: "x", "sb-abc-auth-token": JSON.stringify({ access_token: "t", user: { id: "u1", email: "a@example.com" } }) });
        expect(storedSessionUser(s)).toEqual({ id: "u1", email: "a@example.com" });
    });

    it("保存が無い・読めないときは null", () => {
        expect(storedSessionUser(storage({}))).toBeNull();
        expect(storedSessionUser(storage({ "sb-abc-auth-token": "{broken" }))).toBeNull();
        expect(storedSessionUser(undefined)).toBeNull();
    });
});
