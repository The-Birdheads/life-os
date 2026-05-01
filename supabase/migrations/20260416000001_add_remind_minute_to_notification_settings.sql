ALTER TABLE notification_settings ADD COLUMN IF NOT EXISTS habit_remind_minute INTEGER DEFAULT 0;
ALTER TABLE notification_settings ADD COLUMN IF NOT EXISTS task_remind_minute INTEGER DEFAULT 0;
ALTER TABLE notification_settings ADD COLUMN IF NOT EXISTS review_remind_minute INTEGER DEFAULT 0;
