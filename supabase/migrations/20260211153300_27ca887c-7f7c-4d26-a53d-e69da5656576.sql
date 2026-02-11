
-- Table for automatic influencer locks derived from daily records
CREATE TABLE public.influencer_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handle_normalized text NOT NULL UNIQUE,
  locked_by_user_id uuid NOT NULL,
  locked_by_nome text,
  locked_until timestamp with time zone NOT NULL,
  last_activity_at timestamp with time zone NOT NULL DEFAULT now(),
  influencer_id uuid REFERENCES public.influencers(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.influencer_locks ENABLE ROW LEVEL SECURITY;

-- All approved users can read locks (Painel Geral is public to closers)
CREATE POLICY "Approved users can view locks"
  ON public.influencer_locks
  FOR SELECT
  USING (is_approved(auth.uid()));

-- Approved users can insert locks (auto from daily record)
CREATE POLICY "Approved users can insert locks"
  ON public.influencer_locks
  FOR INSERT
  WITH CHECK (is_approved(auth.uid()) AND locked_by_user_id = auth.uid());

-- Approved users can update locks (upsert renew)
CREATE POLICY "Approved users can update locks"
  ON public.influencer_locks
  FOR UPDATE
  USING (is_approved(auth.uid()));

-- Admins can delete locks
CREATE POLICY "Admins can delete locks"
  ON public.influencer_locks
  FOR DELETE
  USING (has_role(auth.uid(), 'ADMIN'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_influencer_locks_updated_at
  BEFORE UPDATE ON public.influencer_locks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for queries on locked_until
CREATE INDEX idx_influencer_locks_locked_until ON public.influencer_locks (locked_until);
