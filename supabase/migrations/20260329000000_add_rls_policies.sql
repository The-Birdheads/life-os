-- RLS (Row Level Security) ポリシー設定
-- 各テーブルで認証済みユーザーが自分自身のデータのみ読み書きできるようにする
-- user_id は TEXT 型 (UUID 文字列) で保存されているため auth.uid()::text でキャスト

-- ===== tasks =====
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tasks_owner" ON public.tasks;
CREATE POLICY "tasks_owner" ON public.tasks
  FOR ALL
  USING  (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- ===== actions =====
ALTER TABLE public.actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "actions_owner" ON public.actions;
CREATE POLICY "actions_owner" ON public.actions
  FOR ALL
  USING  (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- ===== task_entries =====
ALTER TABLE public.task_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "task_entries_owner" ON public.task_entries;
CREATE POLICY "task_entries_owner" ON public.task_entries
  FOR ALL
  USING  (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- ===== action_entries =====
ALTER TABLE public.action_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "action_entries_owner" ON public.action_entries;
CREATE POLICY "action_entries_owner" ON public.action_entries
  FOR ALL
  USING  (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- ===== daily_logs =====
ALTER TABLE public.daily_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "daily_logs_owner" ON public.daily_logs;
CREATE POLICY "daily_logs_owner" ON public.daily_logs
  FOR ALL
  USING  (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- ===== notification_settings =====
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notification_settings_owner" ON public.notification_settings;
CREATE POLICY "notification_settings_owner" ON public.notification_settings
  FOR ALL
  USING  (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);
