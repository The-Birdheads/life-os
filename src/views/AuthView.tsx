import { theme } from "../lib/ui/theme";
import TextInput from "../components/ui/TextInput";

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

  const btnBaseStyle: React.CSSProperties = {
    padding: "12px 24px",
    borderRadius: "12px",
    fontWeight: 600,
    fontSize: "15px",
    cursor: "pointer",
    border: "none",
    transition: "all 0.2s ease",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    width: "100%",
  };

  const primaryBtnStyle: React.CSSProperties = {
    ...btnBaseStyle,
    background: `linear-gradient(135deg, ${theme.primary}, ${theme.primaryHover})`,
    color: "#fff",
    boxShadow: "0 4px 14px 0 rgba(99, 102, 241, 0.39)",
  };

  const secondaryBtnStyle: React.CSSProperties = {
    ...btnBaseStyle,
    background: "#fff",
    color: theme.text,
    border: `1px solid ${theme.border}`,
    boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
  };

  return (
    <div style={{ ...layoutStyle, position: "relative", overflow: "hidden", minHeight: "100vh" }}>
      {/* 装飾的な背景シェイプ */}
      <div style={{
        position: "absolute", top: "-10%", left: "-10%", width: "50vw", height: "50vw",
        background: `radial-gradient(circle, ${theme.primarySoft} 0%, transparent 70%)`,
        opacity: 0.7, zIndex: 0, filter: "blur(40px)"
      }} />
      <div style={{
        position: "absolute", bottom: "-10%", right: "-10%", width: "40vw", height: "40vw",
        background: `radial-gradient(circle, #fce7f3 0%, transparent 70%)`,
        opacity: 0.5, zIndex: 0, filter: "blur(40px)"
      }} />

      <div style={{ ...containerStyle, position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>

        <div className="glass-panel" style={{
          width: "100%", maxWidth: "440px",
          borderRadius: "24px",
          padding: "40px",
          textAlign: "center"
        }}>

          <div style={{
            width: "64px", height: "64px",
            background: `linear-gradient(135deg, ${theme.primary}, ${theme.primaryHover})`,
            borderRadius: "16px", margin: "0 auto 24px",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 8px 16px -4px rgba(99, 102, 241, 0.4)",
            color: "white", fontSize: "28px", fontWeight: "bold"
          }}>
            L
          </div>

          <h1 style={{
            fontSize: "28px", fontWeight: 800, margin: "0 0 8px", color: theme.text,
            letterSpacing: "-0.5px"
          }}>
            Life OS
          </h1>
          <p style={{ margin: "0 0 32px", color: theme.subtext, fontSize: "15px" }}>
            あなたの人生を記録し、より良くする
          </p>

          <div style={{
            display: "flex", background: "rgba(241, 245, 249, 0.7)",
            borderRadius: "14px", padding: "4px", marginBottom: "28px"
          }}>
            <button
              onClick={() => setMode("signIn")}
              style={{
                flex: 1, padding: "10px", borderRadius: "10px",
                border: "none", cursor: "pointer", fontSize: "14px", fontWeight: 600,
                transition: "all 0.2s ease",
                background: mode === "signIn" ? "#fff" : "transparent",
                color: mode === "signIn" ? theme.primary : theme.subtext,
                boxShadow: mode === "signIn" ? "0 2px 4px rgba(0,0,0,0.05)" : "none",
              }}
            >
              ログイン
            </button>
            <button
              onClick={() => setMode("signUp")}
              style={{
                flex: 1, padding: "10px", borderRadius: "10px",
                border: "none", cursor: "pointer", fontSize: "14px", fontWeight: 600,
                transition: "all 0.2s ease",
                background: mode === "signUp" ? "#fff" : "transparent",
                color: mode === "signUp" ? theme.primary : theme.subtext,
                boxShadow: mode === "signUp" ? "0 2px 4px rgba(0,0,0,0.05)" : "none",
              }}
            >
              新規登録
            </button>
          </div>

          <form onSubmit={onSubmit} style={{ display: "grid", gap: "20px", textAlign: "left" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: theme.subtext, marginBottom: "8px" }}>
                メールアドレス
              </label>
              <TextInput
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
                fullWidth
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: theme.subtext, marginBottom: "8px" }}>
                パスワード
              </label>
              <TextInput
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "signUp" ? "new-password" : "current-password"}
                placeholder="••••••••"
                fullWidth
              />
            </div>

            <button
              type="submit"
              className="hover-elevate"
              style={{ ...primaryBtnStyle, marginTop: "8px" }}
            >
              {mode === "signUp" ? "アカウントを作成する" : "ログインする"}
            </button>
          </form>

          <div style={{ display: "flex", alignItems: "center", margin: "24px 0", gap: "12px", opacity: 0.6 }}>
            <div style={{ flex: 1, height: "1px", background: theme.border }} />
            <span style={{ fontSize: "12px", fontWeight: 500 }}>または</span>
            <div style={{ flex: 1, height: "1px", background: theme.border }} />
          </div>

          <button
            type="button"
            onClick={signInWithGoogle}
            className="hover-elevate"
            style={secondaryBtnStyle}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25C22.56 11.47 22.49 10.72 22.36 10H12V14.26H17.92C17.66 15.63 16.88 16.78 15.72 17.56V20.32H19.28C21.36 18.4 22.56 15.6 22.56 12.25Z" fill="#4285F4" />
              <path d="M12 23C14.97 23 17.46 22.02 19.28 20.32L15.72 17.56C14.73 18.23 13.48 18.63 12 18.63C9.14 18.63 6.71 16.69 5.84 14.09H2.17V16.94C3.98 20.53 7.69 23 12 23Z" fill="#34A853" />
              <path d="M5.84 14.09C5.62 13.43 5.49 12.73 5.49 12C5.49 11.27 5.62 10.57 5.84 9.91V7.06H2.17C1.43 8.54 1 10.22 1 12C1 13.78 1.43 15.46 2.17 16.94L5.84 14.09Z" fill="#FBBC05" />
              <path d="M12 5.38C13.62 5.38 15.06 5.94 16.21 7.03L19.35 3.89C17.45 2.12 14.97 1 12 1C7.69 1 3.98 3.47 2.17 7.06L5.84 9.91C6.71 7.31 9.14 5.38 12 5.38Z" fill="#EA4335" />
            </svg>
            Googleで続ける
          </button>

        </div>
      </div>
    </div>
  );
}

