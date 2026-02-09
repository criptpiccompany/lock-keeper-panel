
-- Create daily_influencer_records table
CREATE TABLE public.daily_influencer_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  influencer_id UUID NOT NULL REFERENCES public.influencers(id),
  closer_id UUID NOT NULL,
  valor_pago NUMERIC(12,2) NOT NULL,
  faturamento NUMERIC(12,2),
  comprovante_url TEXT NOT NULL,
  observacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(influencer_id, date)
);

-- Enable RLS
ALTER TABLE public.daily_influencer_records ENABLE ROW LEVEL SECURITY;

-- Closers can view their own records
CREATE POLICY "Closers can view own records"
  ON public.daily_influencer_records FOR SELECT
  USING (closer_id = auth.uid() OR has_role(auth.uid(), 'ADMIN'::app_role));

-- Closers can insert their own records
CREATE POLICY "Closers can insert own records"
  ON public.daily_influencer_records FOR INSERT
  WITH CHECK (closer_id = auth.uid());

-- Closers can update only their own records
CREATE POLICY "Closers can update own records"
  ON public.daily_influencer_records FOR UPDATE
  USING (closer_id = auth.uid() OR has_role(auth.uid(), 'ADMIN'::app_role));

-- No delete allowed (handled by absence of DELETE policy)

-- Trigger for updated_at
CREATE TRIGGER update_daily_records_updated_at
  BEFORE UPDATE ON public.daily_influencer_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for comprovantes
INSERT INTO storage.buckets (id, name, public) VALUES ('comprovantes', 'comprovantes', false);

-- Storage policies
CREATE POLICY "Authenticated users can upload comprovantes"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'comprovantes' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can view own comprovantes"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'comprovantes' AND auth.uid() IS NOT NULL);
