import React from "react";
import { theme } from "../../lib/ui/theme";
import { radius } from "../../lib/ui/radius";

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
    fullWidth?: boolean;
};

export default function Slider({ fullWidth = true, style, ...props }: Props) {
    const min = Number(props.min || 0);
    const max = Number(props.max || 100);
    const val = Number(props.value || 0);

    // 進行度合い（0〜100%）を計算
    const percentage = Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100));

    const trackStyle: React.CSSProperties = {
        appearance: "none",
        width: fullWidth ? "100%" : "auto",
        height: "8px",
        background: `linear-gradient(to right, ${theme.primary} ${percentage}%, ${theme.border} ${percentage}%)`,
        borderRadius: radius.pill,
        outline: "none",
        margin: "12px 0",
        ...style,
    };

    return (
        <>
            <style>{`
        .custom-slider::-webkit-slider-thumb {
          appearance: none;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: #ffffff;
          cursor: pointer;
          border: 2px solid ${theme.primary};
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          transition: transform 0.1s ease, box-shadow 0.1s ease;
        }
        .custom-slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #ffffff;
          cursor: pointer;
          border: 2px solid ${theme.primary};
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          transition: transform 0.1s ease, box-shadow 0.1s ease;
        }
        .custom-slider:active::-webkit-slider-thumb {
          transform: scale(1.15);
          box-shadow: 0 3px 6px rgba(0,0,0,0.25);
        }
        .custom-slider:active::-moz-range-thumb {
          transform: scale(1.15);
          box-shadow: 0 3px 6px rgba(0,0,0,0.25);
        }
      `}</style>
            <input
                type="range"
                className="custom-slider"
                style={trackStyle}
                {...props}
            />
        </>
    );
}
