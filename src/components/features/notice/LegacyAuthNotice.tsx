import PrimaryBtn from "../../ui/PrimaryBtn";
import { theme } from "../../../lib/ui/theme";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

/**
 * Memory Calendar とのログイン共通化に伴う、更新後の初回起動時のお知らせ。
 * 更新前にログインしていた端末にだけ表示する(判定は legacyAuthMigration.ts)。
 */
export default function LegacyAuthNotice({ isOpen, onClose }: Props) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="ログイン方法のお知らせ"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.5)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 300,
        padding: 16,
      }}
    >
      <div
        style={{
          width: "min(92vw, 380px)",
          borderRadius: 20,
          background: theme.card,
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
          padding: 24,
          color: theme.text,
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>ログイン方法のお知らせ</div>
        <div style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 20 }}>
          Habitasのログイン基盤を、Memory Calendarと共通のものに変更しました。
          <br />
          お手数ですが、<b>以前と同じ方法（GoogleまたはApple）</b>でもう一度ログインしてください。ログインすると、これまでのデータが引き継がれます。
          <br />
          <br />
          ログインは、右上のメニューの「ログイン」から行えます。
        </div>
        <PrimaryBtn fullWidth onClick={onClose}>
          OK
        </PrimaryBtn>
      </div>
    </div>
  );
}
