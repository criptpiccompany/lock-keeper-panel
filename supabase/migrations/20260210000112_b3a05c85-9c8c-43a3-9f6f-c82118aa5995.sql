
-- Add edit_reason column to audit_logs for storing mandatory edit justifications
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS edit_reason text DEFAULT NULL;
