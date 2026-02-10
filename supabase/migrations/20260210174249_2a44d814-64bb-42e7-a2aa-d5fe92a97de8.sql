
-- Make partner_user_id nullable since partners are now free-text names
ALTER TABLE public.daily_record_shared_partners 
  ALTER COLUMN partner_user_id DROP NOT NULL;
