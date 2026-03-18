import React from "react";

type Props = {
  title: string;
  icon?: React.ReactNode;
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
    // コンテナ(padding: 12px)の端まで背景色を塗るためにネガティブマージンを使用
    margin: "0 -12px",
    padding: "0 12px",
    boxSizing: "border-box", // Widthが100% + paddingにならないよう調整
    width: "calc(100% + 24px)", // ネガティブマージン分を相殺して横幅ピッタリにする

    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    height: isLarge ? 56 : 44,

    background: accentColor ? `${accentColor}15` : defaultBgColor,
    color: defaultTextColor,

    fontSize: isLarge ? 16 : 14,
    lineHeight: 1.2,
    ...style,
  };

  // 中央揃えのmaxWidthレイヤー（Card等と同じ幅の仮想レイヤー）
  const innerWrap: React.CSSProperties = {
    width: "100%",
    maxWidth: 720 - 24, // コンテナ maxWidth から padding 分引いた幅
    margin: "0 auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  };

  const left: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    // 左端を開始位置を揃えるため少し余白を追加
    paddingLeft: 4,
  };

  const titleStyle: React.CSSProperties = {
    fontWeight: "bold",
    opacity: isLarge ? 1.0 : 0.9,
    margin: 0,
  };

  const rightWrap: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    paddingRight: 4,
  };

  return (
    <div style={{ ...wrap }}>
      <div style={innerWrap}>
        <div style={left}>
          {icon && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 20, height: 20 }}>
              {icon}
            </div>
          )}
          <h3 style={titleStyle}>{title}</h3>
        </div>

        {right ? <div style={rightWrap}>{right}</div> : null}
      </div>
    </div>
  );
}
