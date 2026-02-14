type Mode = "signIn" | "signUp";

type Props = {
  mode: Mode;
  setMode: (m: Mode) => void;
  email: string;
  setEmail: (s: string) => void;
  password: string;
  setPassword: (s: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  signInWithGoogle: () => void;

  layoutStyle: React.CSSProperties;
  containerStyle: React.CSSProperties;
};

export default function AuthView({
  mode,
  setMode,
  email,
  setEmail,
  password,
  setPassword,
  onSubmit,
  signInWithGoogle,
  layoutStyle,
  containerStyle,
}: Props) {
  return (
    <div style={layoutStyle}>
      <div style={containerStyle}>
        <div style={{ maxWidth: 520, margin: "40px auto", fontFamily: "sans-serif" }}>
          <h1>Life OS</h1>

          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <button onClick={() => setMode("signIn")} disabled={mode === "signIn"}>
              ログイン
            </button>
            <button onClick={() => setMode("signUp")} disabled={mode === "signUp"}>
              新規登録
            </button>
            <button type="button" onClick={signInWithGoogle}>
              Googleでログイン
            </button>
          </div>

          <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
            <label>
              メール
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ width: "100%", boxSizing: "border-box" }}
                autoComplete="email"
              />
            </label>

            <label>
              パスワード
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ width: "100%", boxSizing: "border-box" }}
                autoComplete={mode === "signUp" ? "new-password" : "current-password"}
              />
            </label>

            <button type="submit">{mode === "signUp" ? "登録する" : "ログインする"}</button>
          </form>
        </div>
      </div>
    </div>
  );
}
