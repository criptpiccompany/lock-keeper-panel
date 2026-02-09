
-- Add status column for the workflow status (Gravando, Postou, Apagou)
ALTER TABLE public.daily_influencer_records
ADD COLUMN status TEXT DEFAULT NULL;
