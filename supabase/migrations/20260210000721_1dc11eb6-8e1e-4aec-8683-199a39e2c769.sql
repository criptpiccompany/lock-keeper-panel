
-- Create review status type
CREATE TYPE public.notification_review_status AS ENUM ('PENDENTE', 'REVISADO', 'SUSPEITO');

-- Create admin notifications table
CREATE TABLE public.admin_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  -- who edited
  actor_user_id UUID,
  actor_nome TEXT,
  actor_email TEXT,
  -- what
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  influencer_handle TEXT,
  action TEXT NOT NULL DEFAULT 'UPDATE',
  field_changes JSONB,
  edit_reason TEXT NOT NULL,
  -- link to audit log
  audit_log_id UUID,
  -- review
  review_status notification_review_status NOT NULL DEFAULT 'PENDENTE',
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

-- Only admins can read
CREATE POLICY "Admins can read notifications"
  ON public.admin_notifications FOR SELECT
  USING (public.has_role(auth.uid(), 'ADMIN'::app_role));

-- Only admins can update (review status)
CREATE POLICY "Admins can update notifications"
  ON public.admin_notifications FOR UPDATE
  USING (public.has_role(auth.uid(), 'ADMIN'::app_role));

-- Service role inserts (from edge function), no user INSERT policy needed
-- But we add one for the edge function's service role which bypasses RLS anyway
