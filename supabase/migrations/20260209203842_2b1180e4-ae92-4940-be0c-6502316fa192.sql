
-- Temporarily drop FK constraints to allow data import
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;
ALTER TABLE public.influencers DROP CONSTRAINT IF EXISTS influencers_owner_id_fkey;
ALTER TABLE public.close_events DROP CONSTRAINT IF EXISTS close_events_feito_por_id_fkey;
