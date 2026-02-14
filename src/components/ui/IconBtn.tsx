import React from "react";

type Props = {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  danger?: boolean;
};

export default function IconBtn({ children, onClick, title, danger }: Props) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 34,
        height: 34,
        borderRadius: 8,
        border: "1px solid #e5e7eb",
        background: danger ? "#fff1f2" : "#fff",
        cursor: "pointer",
        fontSize: 16,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "0.15s",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.background = danger ? "#ffe4e6" : "#f3f4f6")
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.background = danger ? "#fff1f2" : "#fff")
      }
    >
      {children}
    </button>
  );
}
