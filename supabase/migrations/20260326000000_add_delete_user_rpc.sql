-- アカウント削除 RPC 関数
-- 呼び出し元ユーザーの全データを削除し、auth.users からも削除する。
-- SECURITY DEFINER により、anon key から呼び出しても必要な権限で実行される。

CREATE OR REPLACE FUNCTION delete_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- 各テーブルのユーザーデータを削除
  DELETE FROM tasks               WHERE user_id = auth.uid()::text;
  DELETE FROM actions             WHERE user_id = auth.uid()::text;
  DELETE FROM task_entries        WHERE user_id = auth.uid()::text;
  DELETE FROM action_entries      WHERE user_id = auth.uid()::text;
  DELETE FROM daily_logs          WHERE user_id = auth.uid()::text;
  DELETE FROM notification_settings WHERE user_id = auth.uid()::text;
  -- 認証ユーザー自体を削除
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;
