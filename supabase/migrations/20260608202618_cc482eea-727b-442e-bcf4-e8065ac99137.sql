ALTER TABLE public.team_shared_board
ADD COLUMN IF NOT EXISTS closed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_team_shared_board_closed_by
ON public.team_shared_board(closed_by) WHERE archived = false;