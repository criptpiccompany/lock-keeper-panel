
-- Kanban influencers table
CREATE TABLE public.kanban_influencers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  closer_id UUID NOT NULL,
  instagram_url TEXT,
  instagram_username TEXT NOT NULL,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Fechar',
  valor_negociado NUMERIC NULL,
  last_moved_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.kanban_influencers ENABLE ROW LEVEL SECURITY;

-- Policies: approved closers manage own cards, admins manage all
CREATE POLICY "Approved closers can view own kanban cards"
ON public.kanban_influencers FOR SELECT
USING (
  ((closer_id = auth.uid()) AND is_approved(auth.uid()))
  OR has_role(auth.uid(), 'ADMIN'::app_role)
);

CREATE POLICY "Approved closers can insert own kanban cards"
ON public.kanban_influencers FOR INSERT
WITH CHECK (
  (closer_id = auth.uid()) AND is_approved(auth.uid())
);

CREATE POLICY "Approved closers can update own kanban cards"
ON public.kanban_influencers FOR UPDATE
USING (
  ((closer_id = auth.uid()) AND is_approved(auth.uid()))
  OR has_role(auth.uid(), 'ADMIN'::app_role)
);

CREATE POLICY "Approved closers can delete own kanban cards"
ON public.kanban_influencers FOR DELETE
USING (
  ((closer_id = auth.uid()) AND is_approved(auth.uid()))
  OR has_role(auth.uid(), 'ADMIN'::app_role)
);

-- Index for faster lookups
CREATE INDEX idx_kanban_influencers_closer_status ON public.kanban_influencers (closer_id, status);
