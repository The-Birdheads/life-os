-- daily_logs に明日の目標・達成度フィールドを追加
ALTER TABLE public.daily_logs
    ADD COLUMN IF NOT EXISTS tomorrow_note TEXT,
    ADD COLUMN IF NOT EXISTS yesterday_achievement TEXT;
