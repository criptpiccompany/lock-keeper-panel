
CREATE TABLE public.influboard_locked_cache (
  id bigint primary key generated always as identity,
  external_id bigint,
  handle text not null,
  handle_normalized text not null,
  instagram_url text,
  lock_expires_at timestamptz,
  closer_name text,
  team_name text,
  fetched_at timestamptz not null default now()
);
CREATE UNIQUE INDEX influboard_locked_cache_handle_norm_uidx
  ON public.influboard_locked_cache (handle_normalized);

CREATE TABLE public.influboard_sync_meta (
  id int primary key default 1,
  last_run_at timestamptz,
  last_count int,
  last_status text,
  last_error text,
  CONSTRAINT only_one_row CHECK (id = 1)
);
INSERT INTO public.influboard_sync_meta (id) VALUES (1) ON CONFLICT DO NOTHING;

GRANT SELECT ON public.influboard_locked_cache TO authenticated;
GRANT ALL ON public.influboard_locked_cache TO service_role;
GRANT SELECT ON public.influboard_sync_meta TO authenticated;
GRANT ALL ON public.influboard_sync_meta TO service_role;

ALTER TABLE public.influboard_locked_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.influboard_sync_meta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved users can read locked cache"
  ON public.influboard_locked_cache FOR SELECT TO authenticated
  USING (is_approved(auth.uid()));

CREATE POLICY "Approved users can read sync meta"
  ON public.influboard_sync_meta FOR SELECT TO authenticated
  USING (is_approved(auth.uid()));
