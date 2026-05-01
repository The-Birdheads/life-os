-- Add volume_unit column to notification_settings table
ALTER TABLE notification_settings
  ADD COLUMN IF NOT EXISTS volume_unit TEXT DEFAULT '30';
