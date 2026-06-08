ALTER TABLE public.daily_influencer_records REPLICA IDENTITY FULL;
ALTER TABLE public.monthly_influencer_list REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_influencer_records;
ALTER PUBLICATION supabase_realtime ADD TABLE public.monthly_influencer_list;