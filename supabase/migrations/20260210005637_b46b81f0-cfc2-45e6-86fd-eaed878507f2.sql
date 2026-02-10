
-- Add new casa/plataforma columns to monthly_influencer_list
ALTER TABLE public.monthly_influencer_list
  ADD COLUMN IF NOT EXISTS casa_1_valor numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS casa_1_email text,
  ADD COLUMN IF NOT EXISTS casa_2_valor numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS casa_2_email text,
  ADD COLUMN IF NOT EXISTS casa_3_valor numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS casa_3_email text;

-- Drop old link/email columns
ALTER TABLE public.monthly_influencer_list
  DROP COLUMN IF EXISTS link_1,
  DROP COLUMN IF EXISTS link_2,
  DROP COLUMN IF EXISTS link_3,
  DROP COLUMN IF EXISTS email_afiliado;

-- Create table for editable platform names (global per month+closer)
CREATE TABLE public.monthly_platform_names (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  closer_id uuid NOT NULL,
  month text NOT NULL,
  platform_1_name text DEFAULT 'Casa / Plataforma 1',
  platform_2_name text DEFAULT 'Casa / Plataforma 2',
  platform_3_name text DEFAULT 'Casa / Plataforma 3',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(closer_id, month)
);

ALTER TABLE public.monthly_platform_names ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Closers can view own platform names"
ON public.monthly_platform_names FOR SELECT
USING (closer_id = auth.uid() OR has_role(auth.uid(), 'ADMIN'::app_role));

CREATE POLICY "Closers can insert own platform names"
ON public.monthly_platform_names FOR INSERT
WITH CHECK (closer_id = auth.uid());

CREATE POLICY "Closers can update own platform names"
ON public.monthly_platform_names FOR UPDATE
USING (closer_id = auth.uid() OR has_role(auth.uid(), 'ADMIN'::app_role));

CREATE POLICY "Admins can delete platform names"
ON public.monthly_platform_names FOR DELETE
USING (has_role(auth.uid(), 'ADMIN'::app_role));

-- Add updated_at trigger
CREATE TRIGGER update_monthly_platform_names_updated_at
BEFORE UPDATE ON public.monthly_platform_names
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
