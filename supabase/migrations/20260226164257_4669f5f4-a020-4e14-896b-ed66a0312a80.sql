
-- Commission tiers table
CREATE TABLE public.commission_tiers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id text NOT NULL DEFAULT 'default',
  tier_order integer NOT NULL,
  percentage numeric NOT NULL,
  threshold_result numeric NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(team_id, tier_order)
);

ALTER TABLE public.commission_tiers ENABLE ROW LEVEL SECURITY;

-- All authenticated approved users can read tiers
CREATE POLICY "Approved users can view tiers"
  ON public.commission_tiers FOR SELECT
  USING (is_approved(auth.uid()));

-- Only admins can manage tiers
CREATE POLICY "Admins can manage tiers"
  ON public.commission_tiers FOR ALL
  USING (has_role(auth.uid(), 'ADMIN'::app_role));
