
-- Add shared fields to daily_influencer_records
ALTER TABLE public.daily_influencer_records ADD COLUMN is_shared boolean NOT NULL DEFAULT false;
ALTER TABLE public.daily_influencer_records ADD COLUMN shared_note text;

-- Create shared partners table
CREATE TABLE public.daily_record_shared_partners (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  record_id uuid NOT NULL REFERENCES public.daily_influencer_records(id) ON DELETE CASCADE,
  partner_user_id uuid NOT NULL,
  partner_nome text,
  share_type text CHECK (share_type IN ('percent', 'value')),
  share_amount numeric,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.daily_record_shared_partners ENABLE ROW LEVEL SECURITY;

-- RLS: closers can manage their own record partners
CREATE POLICY "Approved closers can view own record partners"
ON public.daily_record_shared_partners
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.daily_influencer_records r
    WHERE r.id = record_id
    AND ((r.closer_id = auth.uid() AND is_approved(auth.uid())) OR has_role(auth.uid(), 'ADMIN'::app_role))
  )
);

CREATE POLICY "Approved closers can insert own record partners"
ON public.daily_record_shared_partners
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.daily_influencer_records r
    WHERE r.id = record_id
    AND r.closer_id = auth.uid()
    AND is_approved(auth.uid())
  )
);

CREATE POLICY "Approved closers can update own record partners"
ON public.daily_record_shared_partners
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.daily_influencer_records r
    WHERE r.id = record_id
    AND ((r.closer_id = auth.uid() AND is_approved(auth.uid())) OR has_role(auth.uid(), 'ADMIN'::app_role))
  )
);

CREATE POLICY "Approved closers can delete own record partners"
ON public.daily_record_shared_partners
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.daily_influencer_records r
    WHERE r.id = record_id
    AND ((r.closer_id = auth.uid() AND is_approved(auth.uid())) OR has_role(auth.uid(), 'ADMIN'::app_role))
  )
);

-- Admins can manage all
CREATE POLICY "Admins can manage all record partners"
ON public.daily_record_shared_partners
FOR ALL
USING (has_role(auth.uid(), 'ADMIN'::app_role));
