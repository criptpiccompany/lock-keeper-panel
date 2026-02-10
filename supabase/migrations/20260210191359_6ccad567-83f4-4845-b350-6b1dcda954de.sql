
-- Table for storing conflict/radar alerts for admin
CREATE TABLE public.admin_conflicts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  month_key text NOT NULL,
  type text NOT NULL CHECK (type IN ('HANDLE_DUPLICATE_ACROSS_USERS', 'EMAIL_DUPLICATE_ACROSS_USERS', 'MULTIPLE_EMAILS_SAME_HANDLE_SAME_USER', 'SIMILAR_HANDLE_POSSIBLE_DUPLICATE')),
  severity text NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
  handle text,
  affiliate_email text,
  users_involved jsonb NOT NULL DEFAULT '[]'::jsonb,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  resolved_at timestamp with time zone,
  resolved_by uuid,
  note text
);

-- Enable RLS
ALTER TABLE public.admin_conflicts ENABLE ROW LEVEL SECURITY;

-- Only admins can access
CREATE POLICY "Admins can read conflicts"
  ON public.admin_conflicts FOR SELECT
  USING (has_role(auth.uid(), 'ADMIN'::app_role));

CREATE POLICY "Admins can insert conflicts"
  ON public.admin_conflicts FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'ADMIN'::app_role));

CREATE POLICY "Admins can update conflicts"
  ON public.admin_conflicts FOR UPDATE
  USING (has_role(auth.uid(), 'ADMIN'::app_role));

CREATE POLICY "Admins can delete conflicts"
  ON public.admin_conflicts FOR DELETE
  USING (has_role(auth.uid(), 'ADMIN'::app_role));

-- Index for fast lookups
CREATE INDEX idx_admin_conflicts_month ON public.admin_conflicts(month_key);
CREATE INDEX idx_admin_conflicts_type ON public.admin_conflicts(type);
