-- Allow comprovante_url to be nullable so records can be created without a receipt
ALTER TABLE public.daily_influencer_records ALTER COLUMN comprovante_url DROP NOT NULL;
ALTER TABLE public.daily_influencer_records ALTER COLUMN comprovante_url SET DEFAULT NULL;