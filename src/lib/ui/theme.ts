export const theme = {
  // 基本の色
  bg: "#f1f5f9", // スレート系の少し落ち着いた背景
  bgGradient: "linear-gradient(135deg, #f1f5f9 0%, #cbd5e1 100%)", // 薄い背景グラデーション
  text: "#334155", // やわらかいスレート（黒より深みがある）
  subtext: "#64748b",

  card: "#ffffff",
  border: "#cbd5e1",

  // アクセントカラー（シックなDark Slate系）
  primary: "#334155", // Slate 700 (メインテーマ)
  primaryHover: "#1e293b", // Slate 800
  primarySoft: "#e2e8f0", // Slate 200

  // ヘッダー・フッター用のシックなダークカラー
  surfaceDark: "rgba(30, 41, 59, 0.9)", // Slate 800 の半透明
  surfaceDarkText: "#f8fafc", // 白抜き文字用

  // 状態カラー（全体に合わせて少し彩度を落とす）
  success: "#059669", // Emerald 600
  danger: "#dc2626", // Red 600
  warning: "#d97706", // Amber 600

  // 種別カラー (追加要望6) -> 要望7にて色入れ替え
  habit: "#3b82f6", // Blue 500 (旧タスク色)
  task: "#10b981", // Emerald 500 (旧習慣色)
  action: "#f59e0b", // Amber 500

  toastBg: "rgba(15, 23, 42, 0.95)", // より濃いスレート
  toastText: "#ffffff",
} as const;

