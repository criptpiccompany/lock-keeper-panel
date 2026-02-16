
ALTER TABLE public.kanban_influencers
  ADD COLUMN archived boolean NOT NULL DEFAULT false,
  ADD COLUMN archived_at timestamptz DEFAULT NULL,
  ADD COLUMN archived_from_status text DEFAULT NULL;
