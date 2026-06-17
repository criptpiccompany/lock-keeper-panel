
-- Histórico persistente de travamentos por influenciador (Influboard scraping)
CREATE TABLE public.influboard_lock_history (
  handle_normalized TEXT PRIMARY KEY,
  handle TEXT NOT NULL,
  first_locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_expires_at TIMESTAMPTZ,
  lock_count INTEGER NOT NULL DEFAULT 1,
  last_closer_name TEXT,
  last_team_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.influboard_lock_history TO authenticated;
GRANT ALL ON public.influboard_lock_history TO service_role;

ALTER TABLE public.influboard_lock_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved users can read influboard lock history"
ON public.influboard_lock_history
FOR SELECT
TO authenticated
USING (is_approved(auth.uid()));

CREATE TRIGGER influboard_lock_history_set_updated_at
BEFORE UPDATE ON public.influboard_lock_history
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_influboard_lock_history_count ON public.influboard_lock_history (lock_count DESC);
