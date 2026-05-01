-- Add sort_rule and prioritize_due columns to notification_settings
ALTER TABLE notification_settings
  ADD COLUMN IF NOT EXISTS sort_rule TEXT NOT NULL DEFAULT 'priority',
  ADD COLUMN IF NOT EXISTS prioritize_due BOOLEAN NOT NULL DEFAULT FALSE;
