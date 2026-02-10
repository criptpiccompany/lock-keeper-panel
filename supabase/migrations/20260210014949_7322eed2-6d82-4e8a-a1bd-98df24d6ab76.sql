
-- Add approval fields to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Set all existing users as approved
UPDATE public.profiles SET status = 'approved' WHERE status = 'pending';

-- Create invites table
CREATE TABLE public.invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '7 days'),
  used_by uuid,
  used_at timestamp with time zone,
  max_uses int NOT NULL DEFAULT 1,
  use_count int NOT NULL DEFAULT 0
);

ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage invites"
  ON public.invites FOR ALL
  USING (has_role(auth.uid(), 'ADMIN'::app_role));

-- Create a security definer function to check if user is approved
CREATE OR REPLACE FUNCTION public.is_approved(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND status = 'approved'
  )
$$;

-- Create function to validate invite token
CREATE OR REPLACE FUNCTION public.validate_invite_token(_token text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.invites
    WHERE token = _token
      AND expires_at > now()
      AND use_count < max_uses
  )
$$;

-- Create function to consume invite token (called after signup)
CREATE OR REPLACE FUNCTION public.consume_invite_token(_token text, _user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.invites
  SET use_count = use_count + 1, used_by = _user_id, used_at = now()
  WHERE token = _token AND expires_at > now() AND use_count < max_uses;
END;
$$;

-- Update RLS on key tables to require approved status for closers
-- influencers: update SELECT policy for non-admins
DROP POLICY IF EXISTS "Authenticated users can view non-deleted influencers" ON public.influencers;
CREATE POLICY "Approved users can view non-deleted influencers"
  ON public.influencers FOR SELECT
  USING (
    (is_approved(auth.uid()) AND deleted_at IS NULL)
    OR has_role(auth.uid(), 'ADMIN'::app_role)
  );

-- influencers: update INSERT policy
DROP POLICY IF EXISTS "Authenticated users can insert influencers" ON public.influencers;
CREATE POLICY "Approved users can insert influencers"
  ON public.influencers FOR INSERT
  WITH CHECK (is_approved(auth.uid()));

-- influencers: update UPDATE policy
DROP POLICY IF EXISTS "Users can update their own or released influencers" ON public.influencers;
CREATE POLICY "Approved users can update influencers"
  ON public.influencers FOR UPDATE
  USING (
    is_approved(auth.uid()) AND (
      owner_id = auth.uid() OR owner_id IS NULL OR last_closed_at IS NULL
      OR (last_closed_at + '10 days'::interval) <= now()
      OR has_role(auth.uid(), 'ADMIN'::app_role)
    )
  );

-- daily_influencer_records: update policies
DROP POLICY IF EXISTS "Closers can view own records" ON public.daily_influencer_records;
CREATE POLICY "Approved closers can view own records"
  ON public.daily_influencer_records FOR SELECT
  USING (
    ((closer_id = auth.uid() AND deleted_at IS NULL AND is_approved(auth.uid()))
    OR has_role(auth.uid(), 'ADMIN'::app_role))
  );

DROP POLICY IF EXISTS "Closers can insert own records" ON public.daily_influencer_records;
CREATE POLICY "Approved closers can insert own records"
  ON public.daily_influencer_records FOR INSERT
  WITH CHECK (closer_id = auth.uid() AND is_approved(auth.uid()));

DROP POLICY IF EXISTS "Closers can update own records" ON public.daily_influencer_records;
CREATE POLICY "Approved closers can update own records"
  ON public.daily_influencer_records FOR UPDATE
  USING (
    (closer_id = auth.uid() AND is_approved(auth.uid()))
    OR has_role(auth.uid(), 'ADMIN'::app_role)
  );

-- monthly_influencer_list: update policies
DROP POLICY IF EXISTS "Closers can view own monthly list" ON public.monthly_influencer_list;
CREATE POLICY "Approved closers can view own monthly list"
  ON public.monthly_influencer_list FOR SELECT
  USING (
    (closer_id = auth.uid() AND is_approved(auth.uid()))
    OR has_role(auth.uid(), 'ADMIN'::app_role)
  );

DROP POLICY IF EXISTS "Closers can insert own monthly list" ON public.monthly_influencer_list;
CREATE POLICY "Approved closers can insert own monthly list"
  ON public.monthly_influencer_list FOR INSERT
  WITH CHECK (closer_id = auth.uid() AND is_approved(auth.uid()));

DROP POLICY IF EXISTS "Closers can update own monthly list" ON public.monthly_influencer_list;
CREATE POLICY "Approved closers can update own monthly list"
  ON public.monthly_influencer_list FOR UPDATE
  USING (
    (closer_id = auth.uid() AND is_approved(auth.uid()))
    OR has_role(auth.uid(), 'ADMIN'::app_role)
  );

-- daily_sheets: update policies
DROP POLICY IF EXISTS "Closers can view own days" ON public.daily_sheets;
CREATE POLICY "Approved closers can view own days"
  ON public.daily_sheets FOR SELECT
  USING (
    ((closer_id = auth.uid() AND deleted_at IS NULL AND is_approved(auth.uid()))
    OR has_role(auth.uid(), 'ADMIN'::app_role))
  );

DROP POLICY IF EXISTS "Closers can insert own days" ON public.daily_sheets;
CREATE POLICY "Approved closers can insert own days"
  ON public.daily_sheets FOR INSERT
  WITH CHECK (closer_id = auth.uid() AND is_approved(auth.uid()));

-- close_events: update INSERT policy
DROP POLICY IF EXISTS "Authenticated users can insert events" ON public.close_events;
CREATE POLICY "Approved users can insert events"
  ON public.close_events FOR INSERT
  WITH CHECK (auth.uid() = feito_por_id AND is_approved(auth.uid()));

-- monthly_platform_names: update policies
DROP POLICY IF EXISTS "Closers can view own platform names" ON public.monthly_platform_names;
CREATE POLICY "Approved closers can view own platform names"
  ON public.monthly_platform_names FOR SELECT
  USING (
    (closer_id = auth.uid() AND is_approved(auth.uid()))
    OR has_role(auth.uid(), 'ADMIN'::app_role)
  );

DROP POLICY IF EXISTS "Closers can insert own platform names" ON public.monthly_platform_names;
CREATE POLICY "Approved closers can insert own platform names"
  ON public.monthly_platform_names FOR INSERT
  WITH CHECK (closer_id = auth.uid() AND is_approved(auth.uid()));

DROP POLICY IF EXISTS "Closers can update own platform names" ON public.monthly_platform_names;
CREATE POLICY "Approved closers can update own platform names"
  ON public.monthly_platform_names FOR UPDATE
  USING (
    (closer_id = auth.uid() AND is_approved(auth.uid()))
    OR has_role(auth.uid(), 'ADMIN'::app_role)
  );
