// src/lib/releaseNotes.ts

export type ReleaseNote = {
    date: string; // YYYY-MM-DD
    version: string; // e.g. "0.8.1"
    items: string[];
};

// ここだけ編集すればOKにする（最上位）
export const APP_VERSION = "0.9.0";

export const RELEASE_NOTES: ReleaseNote[] = [
    {
        date: "2026-02-17",
        version: "0.9.0",
        items: [
            "下タブのアイコン追加",
            "日付切り替えをヘッダーバーへ統一",
            "ダークモードを削除しモードを統一",
            "ヘッダーの整理等、全体的なUIの調整",
        ],
    },
    {
        date: "2026-02-16",
        version: "0.8.3",
        items: [
            "タブを下に固定表示",
        ],
    },
    {
        date: "2026-02-16",
        version: "0.8.2",
        items: [
            "ハンバーガーメニューをダークモード対応",
        ],
    },
    {
        date: "2026-02-16",
        version: "0.8.1",
        items: [
            "ログイン後ヘッダを整理（Life OS + ハンバーガーメニュー）",
            "ハンバーガーメニュー内にバージョン / リリースノートを追加",
            "「登録」タブの各登録済み項目の表示、非表示切り替えに対応",
        ],
    },
    {
        date: "2026-02-14",
        version: "0.8.0",
        items: ["UI/UX微調整（カード・余白・視認性）"],
    },
];
