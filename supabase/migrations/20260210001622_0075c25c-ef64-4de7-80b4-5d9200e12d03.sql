
-- Add commission_rate to profiles (admin-controlled, per closer)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS commission_rate NUMERIC NOT NULL DEFAULT 0.10;

-- Only admins can update commission_rate (existing update policy limits to own profile)
-- Create a specific policy for admins to update any profile
CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE
  USING (public.has_role(auth.uid(), 'ADMIN'::app_role));
