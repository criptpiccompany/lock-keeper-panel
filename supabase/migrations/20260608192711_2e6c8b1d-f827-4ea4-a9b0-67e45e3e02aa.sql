ALTER TABLE public.team_shared_board REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_shared_board;