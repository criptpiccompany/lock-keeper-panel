
-- Table for monthly influencer list (Lista do Mês)
CREATE TABLE public.monthly_influencer_list (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  month TEXT NOT NULL,  -- e.g. '2026-02'
  closer_id UUID NOT NULL,
  influencer_id UUID NOT NULL,
  influencer_handle TEXT NOT NULL,
  email_afiliado TEXT,
  link_1 TEXT,
  link_2 TEXT,
  link_3 TEXT,
  valor_total NUMERIC DEFAULT 0,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (month, closer_id, influencer_id)
);

-- Enable RLS
ALTER TABLE public.monthly_influencer_list ENABLE ROW LEVEL SECURITY;

-- Closers can view their own rows
CREATE POLICY "Closers can view own monthly list"
  ON public.monthly_influencer_list
  FOR SELECT
  USING ((closer_id = auth.uid()) OR has_role(auth.uid(), 'ADMIN'::app_role));

-- Closers can insert their own rows
CREATE POLICY "Closers can insert own monthly list"
  ON public.monthly_influencer_list
  FOR INSERT
  WITH CHECK (closer_id = auth.uid());

-- Closers can update their own rows, admins can update any
CREATE POLICY "Closers can update own monthly list"
  ON public.monthly_influencer_list
  FOR UPDATE
  USING ((closer_id = auth.uid()) OR has_role(auth.uid(), 'ADMIN'::app_role));

-- Only admins can delete
CREATE POLICY "Admins can delete monthly list"
  ON public.monthly_influencer_list
  FOR DELETE
  USING (has_role(auth.uid(), 'ADMIN'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_monthly_influencer_list_updated_at
  BEFORE UPDATE ON public.monthly_influencer_list
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Audit trigger
CREATE TRIGGER audit_monthly_influencer_list
  AFTER INSERT OR UPDATE OR DELETE ON public.monthly_influencer_list
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_audit_trigger();
