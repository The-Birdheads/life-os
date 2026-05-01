-- v9: ソフトデリート（論理削除）用 deleted_at カラムの追加
-- tasks / actions / action_entries のレコード削除を物理削除→論理削除へ変更するための準備

ALTER TABLE public.tasks
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.actions
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.action_entries
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
