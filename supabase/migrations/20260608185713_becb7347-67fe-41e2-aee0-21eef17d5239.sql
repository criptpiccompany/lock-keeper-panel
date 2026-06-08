
ALTER TABLE public.team_shared_board
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_team_shared_board_assigned_to
  ON public.team_shared_board (assigned_to)
  WHERE archived = false;
