import React from "react";

type Props = {
  title: string;
  icon?: string;
  accentColor?: string;
  right?: React.ReactNode;
  style?: React.CSSProperties;
  isLarge?: boolean; // ✅ 追加：振り返り等の大きな見出し用
};

export default function SectionTitle({
  title,
  icon,
  accentColor,
  right,
  style,
  isLarge,
}: Props) {
  // サブタブと同じ色
  const defaultBgColor = isLarge ? "#64748b" : "#f1f5f9"; // Slate 500 or Slate 100
  const defaultTextColor = isLarge ? "#ffffff" : "#111827"; // 中見出しは黒/濃いグレー

  const wrap: React.CSSProperties = {
    // 画面横幅いっぱいに広げるためのネガティブマージン（コンテナのpadding:12pxを相殺）
    margin: "0 -12px",
    padding: "0 12px",
    boxSizing: "border-box", // ✅ paddingとmarginの干渉で100%幅をオーバーしないように追加

    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    height: isLarge ? 56 : 44, // ✅ ヘッダーと同じ56px、中見出しは少し小さい44pxに設定

    background: accentColor ? `${accentColor}15` : defaultBgColor,
    color: defaultTextColor,

    // フォント等の設定
    fontSize: isLarge ? 16 : 14, // ✅ isLargeのときは文字サイズを大きく
    lineHeight: 1.2,
    ...style,
  };

  const left: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    // 親要素の 100vw の中で、元のコンテンツ幅に合わせるためのパディング
    // アプリ全体の max-width が 600px 程度だと仮定して中央寄せ＆内側マージンを計算
    paddingLeft: "calc(max(0px, 50vw - 300px) + 16px)", // ✅ 目安: Cardの枠と同じくらいに開始位置を合わせる
  };

  const titleStyle: React.CSSProperties = {
    fontWeight: "bold",
    opacity: isLarge ? 1.0 : 0.9,
  };

  const rightWrap: React.CSSProperties = {
    paddingRight: "calc(max(0px, 50vw - 300px) + 16px)", // ✅ 目安: 終了位置もCard内側に合わせる
    display: "flex",
    alignItems: "center",
    gap: 6,
  };

  return (
    <div style={{ ...wrap }}>
      <div style={left}>
        {icon && <span style={{ fontSize: 16, lineHeight: 1 }}>{icon}</span>}
        <h3 style={titleStyle}>{title}</h3>
      </div>

      {right ? <div style={rightWrap}>{right}</div> : null}
    </div>
  );
}
