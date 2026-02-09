
-- Table to persist day sections in Planilhamento
CREATE TABLE public.daily_sheets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  month TEXT NOT NULL,
  closer_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(date, closer_id)
);

-- Enable RLS
ALTER TABLE public.daily_sheets ENABLE ROW LEVEL SECURITY;

-- Closers can view their own days
CREATE POLICY "Closers can view own days"
  ON public.daily_sheets FOR SELECT
  USING (closer_id = auth.uid() OR has_role(auth.uid(), 'ADMIN'::app_role));

-- Closers can insert their own days
CREATE POLICY "Closers can insert own days"
  ON public.daily_sheets FOR INSERT
  WITH CHECK (closer_id = auth.uid());

-- Closers can delete their own days
CREATE POLICY "Closers can delete own days"
  ON public.daily_sheets FOR DELETE
  USING (closer_id = auth.uid() OR has_role(auth.uid(), 'ADMIN'::app_role));
