
-- Add explicit default DENY policies for non-admin users on invites table
-- This ensures tokens are never exposed even if other policies are misconfigured

-- Drop the existing ALL policy and replace with explicit per-operation policies
DROP POLICY IF EXISTS "Admins can manage invites" ON public.invites;

-- Admin SELECT
CREATE POLICY "Admins can select invites"
  ON public.invites FOR SELECT
  USING (has_role(auth.uid(), 'ADMIN'::app_role));

-- Admin INSERT
CREATE POLICY "Admins can insert invites"
  ON public.invites FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'ADMIN'::app_role));

-- Admin UPDATE
CREATE POLICY "Admins can update invites"
  ON public.invites FOR UPDATE
  USING (has_role(auth.uid(), 'ADMIN'::app_role));

-- Admin DELETE
CREATE POLICY "Admins can delete invites"
  ON public.invites FOR DELETE
  USING (has_role(auth.uid(), 'ADMIN'::app_role));
