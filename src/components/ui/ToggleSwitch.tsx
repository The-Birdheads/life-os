type Props = {
    checked: boolean;
    onChange: (checked: boolean) => void;
    color?: string;
    disabled?: boolean;
};

export default function ToggleSwitch({ checked, onChange, color = "#3b82f6", disabled = false }: Props) {
    return (
        <div
            role="switch"
            aria-checked={checked}
            onClick={() => !disabled && onChange(!checked)}
            style={{
                width: 44,
                height: 26,
                borderRadius: 13,
                background: checked ? color : "#cbd5e1",
                position: "relative",
                cursor: disabled ? "not-allowed" : "pointer",
                transition: "background 0.2s ease",
                flexShrink: 0,
                opacity: disabled ? 0.5 : 1,
            }}
        >
            <div style={{
                position: "absolute",
                top: 3,
                left: checked ? 21 : 3,
                width: 20,
                height: 20,
                borderRadius: 10,
                background: "#ffffff",
                boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                transition: "left 0.2s ease",
            }} />
        </div>
    );
}
