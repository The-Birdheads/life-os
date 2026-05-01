-- user_profiles: サブスクリプション・機能フラグ管理テーブル
-- no_ads: true のアカウントは広告を非表示にする

CREATE TABLE IF NOT EXISTS public.user_profiles (
    user_id TEXT PRIMARY KEY,
    no_ads  BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: 自分自身のプロフィールのみ読み取り可
-- 書き込みはサービスロールキー（管理者・Supabase Dashboard）のみ
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_profiles_select_own" ON public.user_profiles;
CREATE POLICY "user_profiles_select_own" ON public.user_profiles
    FOR SELECT
    USING (user_id = auth.uid()::text);
