
CREATE TABLE public.team_shared_board (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid,
  created_by uuid NOT NULL,
  display_name text NOT NULL,
  instagram_username text NOT NULL,
  instagram_url text,
  status text NOT NULL DEFAULT 'Fechar',
  classificacao text,
  valor_negociado numeric,
  observacao text,
  apoios text[] DEFAULT '{}'::text[],
  archived boolean NOT NULL DEFAULT false,
  archived_at timestamptz,
  archived_from_status text,
  last_moved_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_shared_board TO authenticated;
GRANT ALL ON public.team_shared_board TO service_role;

ALTER TABLE public.team_shared_board ENABLE ROW LEVEL SECURITY;

-- Auto-set team_id from creator profile if not provided
CREATE OR REPLACE FUNCTION public.team_shared_board_set_team_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.team_id IS NULL THEN
    SELECT team_id INTO NEW.team_id FROM public.profiles WHERE id = COALESCE(NEW.created_by, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_team_shared_board_set_team
  BEFORE INSERT ON public.team_shared_board
  FOR EACH ROW EXECUTE FUNCTION public.team_shared_board_set_team_id();

CREATE TRIGGER trg_team_shared_board_updated_at
  BEFORE UPDATE ON public.team_shared_board
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS: every approved member of the team can read/insert/update/delete cards in their team
CREATE POLICY "Team members view team board"
  ON public.team_shared_board FOR SELECT
  USING (
    is_approved(auth.uid())
    AND (
      has_role(auth.uid(), 'ADMIN'::app_role)
      OR team_id = get_user_team_id(auth.uid())
    )
  );

CREATE POLICY "Team members insert team board"
  ON public.team_shared_board FOR INSERT
  WITH CHECK (
    is_approved(auth.uid())
    AND created_by = auth.uid()
    AND (team_id IS NULL OR team_id = get_user_team_id(auth.uid()))
  );

CREATE POLICY "Team members update team board"
  ON public.team_shared_board FOR UPDATE
  USING (
    has_role(auth.uid(), 'ADMIN'::app_role)
    OR (is_approved(auth.uid()) AND team_id = get_user_team_id(auth.uid()))
  );

CREATE POLICY "Team members delete team board"
  ON public.team_shared_board FOR DELETE
  USING (
    has_role(auth.uid(), 'ADMIN'::app_role)
    OR (is_approved(auth.uid()) AND team_id = get_user_team_id(auth.uid()))
  );

CREATE INDEX idx_team_shared_board_team ON public.team_shared_board(team_id) WHERE archived = false;
