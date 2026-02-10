
ALTER TABLE public.admin_notifications
  ADD COLUMN IF NOT EXISTS recipient_admin_id UUID,
  ADD COLUMN IF NOT EXISTS actor_role TEXT;
