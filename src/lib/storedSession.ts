/**
 * 端末に残っているログインの情報(Supabase が localStorage に保存しているもの)から、ログインしていたユーザーを読む。
 *
 * 起動時に電波が弱い・オフラインだと、ログインの更新(リフレッシュ)に失敗して、
 * getSession がセッションなしを返すことがある。このとき Supabase は保存したログインを消さずに、
 * つながったら更新し直す。ここでログアウト扱い(端末だけのユーザー)にすると、
 * あとで戻ったときにユーザーの切り替え(統合)が走ってしまうので、残っているユーザーのまま始める。
 * 本当にログアウトされたとき(更新トークンが無効など)は、Supabase が保存を消すので null になる。
 */
export type StoredUser = { id: string; email: string };

export function storedSessionUser(storage: Pick<Storage, "length" | "key" | "getItem"> | undefined = globalThis.localStorage): StoredUser | null {
    if (!storage) return null;
    try {
        for (let i = 0; i < storage.length; i++) {
            const key = storage.key(i);
            if (!key || !/^sb-.+-auth-token$/.test(key)) continue;
            const raw = storage.getItem(key);
            if (!raw) continue;
            const user = JSON.parse(raw)?.user;
            if (user?.id) return { id: String(user.id), email: String(user.email ?? "") };
        }
    } catch {
        // 読めなければ、残っていないものとして扱う
    }
    return null;
}
