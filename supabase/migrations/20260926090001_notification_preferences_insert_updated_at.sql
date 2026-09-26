-- Fix for 20260923090001_notifications.sql.
--
-- savePreferences() in src/services/notifications.js saves with an upsert that
-- sends updated_at. PostgREST runs an upsert as INSERT ... ON CONFLICT DO UPDATE,
-- and Postgres checks INSERT privilege on every column sent, also when the row
-- already exists. The INSERT grant left updated_at out, so every save in Settings
-- failed with a 403. This adds the one column that the INSERT grant was missing.

grant insert (updated_at) on public.notification_preferences to authenticated;
