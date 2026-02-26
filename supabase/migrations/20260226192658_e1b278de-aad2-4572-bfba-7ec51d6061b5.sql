
-- ====================================================================
-- TEAM ISOLATION: columns, backfill, triggers, functions, RLS
-- ====================================================================

-- STEP 1: Add team_id columns
ALTER TABLE public.influencers
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id);
ALTER TABLE public.daily_influencer_records
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id);
ALTER TABLE public.daily_sheets
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id);
ALTER TABLE public.monthly_influencer_list
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id);
ALTER TABLE public.kanban_influencers
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id);
ALTER TABLE public.monthly_platform_names
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id);

-- Indexes for RLS performance
CREATE INDEX IF NOT EXISTS idx_influencers_team ON public.influencers(team_id);
CREATE INDEX IF NOT EXISTS idx_daily_records_team ON public.daily_influencer_records(team_id);
CREATE INDEX IF NOT EXISTS idx_daily_sheets_team ON public.daily_sheets(team_id);
CREATE INDEX IF NOT EXISTS idx_monthly_list_team ON public.monthly_influencer_list(team_id);
CREATE INDEX IF NOT EXISTS idx_kanban_team ON public.kanban_influencers(team_id);
CREATE INDEX IF NOT EXISTS idx_platform_names_team ON public.monthly_platform_names(team_id);
CREATE INDEX IF NOT EXISTS idx_profiles_team ON public.profiles(team_id);

-- STEP 2: Backfill all to Ciphera (Principal)
UPDATE public.influencers SET team_id = (SELECT id FROM public.teams WHERE name = 'Ciphera (Principal)') WHERE team_id IS NULL;
UPDATE public.daily_influencer_records SET team_id = (SELECT id FROM public.teams WHERE name = 'Ciphera (Principal)') WHERE team_id IS NULL;
UPDATE public.daily_sheets SET team_id = (SELECT id FROM public.teams WHERE name = 'Ciphera (Principal)') WHERE team_id IS NULL;
UPDATE public.monthly_influencer_list SET team_id = (SELECT id FROM public.teams WHERE name = 'Ciphera (Principal)') WHERE team_id IS NULL;
UPDATE public.kanban_influencers SET team_id = (SELECT id FROM public.teams WHERE name = 'Ciphera (Principal)') WHERE team_id IS NULL;
UPDATE public.monthly_platform_names SET team_id = (SELECT id FROM public.teams WHERE name = 'Ciphera (Principal)') WHERE team_id IS NULL;

-- Braz's records -> Franquia Braz
UPDATE public.daily_influencer_records SET team_id = (SELECT id FROM public.teams WHERE name = 'Franquia Braz') WHERE closer_id = '3272a316-41e7-4940-bfeb-0c749ddd840c';
UPDATE public.daily_sheets SET team_id = (SELECT id FROM public.teams WHERE name = 'Franquia Braz') WHERE closer_id = '3272a316-41e7-4940-bfeb-0c749ddd840c';
UPDATE public.monthly_influencer_list SET team_id = (SELECT id FROM public.teams WHERE name = 'Franquia Braz') WHERE closer_id = '3272a316-41e7-4940-bfeb-0c749ddd840c';
UPDATE public.kanban_influencers SET team_id = (SELECT id FROM public.teams WHERE name = 'Franquia Braz') WHERE closer_id = '3272a316-41e7-4940-bfeb-0c749ddd840c';
UPDATE public.monthly_platform_names SET team_id = (SELECT id FROM public.teams WHERE name = 'Franquia Braz') WHERE closer_id = '3272a316-41e7-4940-bfeb-0c749ddd840c';

-- STEP 3: Auto-set team_id trigger
CREATE OR REPLACE FUNCTION public.auto_set_team_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.team_id IS NULL THEN
    IF TG_TABLE_NAME = 'influencers' THEN
      SELECT team_id INTO NEW.team_id FROM public.profiles WHERE id = auth.uid();
    ELSE
      SELECT team_id INTO NEW.team_id FROM public.profiles WHERE id = NEW.closer_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_team_influencers BEFORE INSERT ON public.influencers
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_team_id();
CREATE TRIGGER trg_auto_team_daily_records BEFORE INSERT ON public.daily_influencer_records
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_team_id();
CREATE TRIGGER trg_auto_team_daily_sheets BEFORE INSERT ON public.daily_sheets
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_team_id();
CREATE TRIGGER trg_auto_team_monthly_list BEFORE INSERT ON public.monthly_influencer_list
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_team_id();
CREATE TRIGGER trg_auto_team_kanban BEFORE INSERT ON public.kanban_influencers
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_team_id();
CREATE TRIGGER trg_auto_team_platform_names BEFORE INSERT ON public.monthly_platform_names
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_team_id();

-- STEP 4: Update handle_new_user to default team
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, team_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    (SELECT id FROM public.teams WHERE name = 'Ciphera (Principal)' LIMIT 1)
  );
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'CLOSER');
  RETURN NEW;
END;
$$;

-- STEP 5: Update security definer functions for team filtering
CREATE OR REPLACE FUNCTION public.get_approved_closers()
RETURNS TABLE(id uuid, nome text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.nome
  FROM public.profiles p
  WHERE p.status = 'approved'
    AND auth.uid() IS NOT NULL
    AND (
      has_role(auth.uid(), 'ADMIN'::app_role)
      OR p.team_id = get_user_team_id(auth.uid())
    )
  ORDER BY p.nome;
$$;

CREATE OR REPLACE FUNCTION public.get_public_influencers()
RETURNS TABLE(id uuid, handle text, last_closed_at timestamp with time zone, ativo boolean, created_at timestamp with time zone, is_locked boolean, locked_until timestamp with time zone, owner_nome text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    i.id, i.handle, i.last_closed_at, i.ativo, i.created_at,
    CASE
      WHEN i.owner_id IS NOT NULL AND i.last_closed_at IS NOT NULL
           AND (i.last_closed_at + INTERVAL '10 days') > now() THEN true
      ELSE false
    END,
    CASE
      WHEN i.owner_id IS NOT NULL AND i.last_closed_at IS NOT NULL
           AND (i.last_closed_at + INTERVAL '10 days') > now()
      THEN i.last_closed_at + INTERVAL '10 days'
      ELSE NULL
    END,
    i.owner_nome
  FROM public.influencers i
  WHERE i.ativo = true
    AND i.deleted_at IS NULL
    AND auth.uid() IS NOT NULL
    AND (
      has_role(auth.uid(), 'ADMIN'::app_role)
      OR i.team_id = get_user_team_id(auth.uid())
    );
$$;

-- ====================================================================
-- STEP 6: RLS POLICY UPDATES
-- ====================================================================

-- ----- INFLUENCERS -----
DROP POLICY IF EXISTS "Admins can view all influencers" ON public.influencers;
DROP POLICY IF EXISTS "Approved users can view non-deleted influencers" ON public.influencers;
DROP POLICY IF EXISTS "Approved users can insert influencers" ON public.influencers;
DROP POLICY IF EXISTS "Approved users can update influencers" ON public.influencers;
DROP POLICY IF EXISTS "Admins can delete influencers" ON public.influencers;

CREATE POLICY "Admins view all influencers" ON public.influencers
  FOR SELECT USING (has_role(auth.uid(), 'ADMIN'::app_role));

CREATE POLICY "Team members view own team influencers" ON public.influencers
  FOR SELECT USING (
    is_approved(auth.uid()) AND deleted_at IS NULL
    AND team_id = get_user_team_id(auth.uid())
  );

CREATE POLICY "Team members insert own team influencers" ON public.influencers
  FOR INSERT WITH CHECK (
    is_approved(auth.uid())
    AND (team_id IS NULL OR team_id = get_user_team_id(auth.uid()))
  );

CREATE POLICY "Team members update own team influencers" ON public.influencers
  FOR UPDATE USING (
    (is_approved(auth.uid())
      AND team_id = get_user_team_id(auth.uid())
      AND ((owner_id = auth.uid()) OR (owner_id IS NULL) OR (last_closed_at IS NULL)
           OR ((last_closed_at + '10 days'::interval) <= now())))
    OR has_role(auth.uid(), 'ADMIN'::app_role)
  );

CREATE POLICY "Admins delete influencers" ON public.influencers
  FOR DELETE USING (has_role(auth.uid(), 'ADMIN'::app_role));

-- ----- DAILY_INFLUENCER_RECORDS -----
DROP POLICY IF EXISTS "Approved closers can view own records" ON public.daily_influencer_records;
DROP POLICY IF EXISTS "Approved closers can insert own records" ON public.daily_influencer_records;
DROP POLICY IF EXISTS "Approved closers can update own records" ON public.daily_influencer_records;
DROP POLICY IF EXISTS "Admins can delete daily_records" ON public.daily_influencer_records;

CREATE POLICY "Admins view all records" ON public.daily_influencer_records
  FOR SELECT USING (has_role(auth.uid(), 'ADMIN'::app_role));

CREATE POLICY "Team members view own team records" ON public.daily_influencer_records
  FOR SELECT USING (
    is_approved(auth.uid()) AND deleted_at IS NULL
    AND team_id = get_user_team_id(auth.uid())
    AND (closer_id = auth.uid() OR has_role(auth.uid(), 'SUBADMIN'::app_role))
  );

CREATE POLICY "Closers insert own records" ON public.daily_influencer_records
  FOR INSERT WITH CHECK (
    closer_id = auth.uid() AND is_approved(auth.uid())
    AND (team_id IS NULL OR team_id = get_user_team_id(auth.uid()))
  );

CREATE POLICY "Team members update records" ON public.daily_influencer_records
  FOR UPDATE USING (
    (closer_id = auth.uid() AND is_approved(auth.uid()) AND team_id = get_user_team_id(auth.uid()))
    OR (has_role(auth.uid(), 'SUBADMIN'::app_role) AND team_id = get_user_team_id(auth.uid()))
    OR has_role(auth.uid(), 'ADMIN'::app_role)
  );

CREATE POLICY "Admins delete records" ON public.daily_influencer_records
  FOR DELETE USING (has_role(auth.uid(), 'ADMIN'::app_role));

-- ----- DAILY_SHEETS -----
DROP POLICY IF EXISTS "Approved closers can view own days" ON public.daily_sheets;
DROP POLICY IF EXISTS "Approved closers can insert own days" ON public.daily_sheets;
DROP POLICY IF EXISTS "Admins can delete daily_sheets" ON public.daily_sheets;

CREATE POLICY "Admins view all sheets" ON public.daily_sheets
  FOR SELECT USING (has_role(auth.uid(), 'ADMIN'::app_role));

CREATE POLICY "Team members view own team sheets" ON public.daily_sheets
  FOR SELECT USING (
    is_approved(auth.uid()) AND deleted_at IS NULL
    AND team_id = get_user_team_id(auth.uid())
    AND (closer_id = auth.uid() OR has_role(auth.uid(), 'SUBADMIN'::app_role))
  );

CREATE POLICY "Closers insert own sheets" ON public.daily_sheets
  FOR INSERT WITH CHECK (
    closer_id = auth.uid() AND is_approved(auth.uid())
    AND (team_id IS NULL OR team_id = get_user_team_id(auth.uid()))
  );

CREATE POLICY "Admins delete sheets" ON public.daily_sheets
  FOR DELETE USING (has_role(auth.uid(), 'ADMIN'::app_role));

-- ----- MONTHLY_INFLUENCER_LIST -----
DROP POLICY IF EXISTS "Approved closers can view own monthly list" ON public.monthly_influencer_list;
DROP POLICY IF EXISTS "Approved closers can insert own monthly list" ON public.monthly_influencer_list;
DROP POLICY IF EXISTS "Approved closers can update own monthly list" ON public.monthly_influencer_list;
DROP POLICY IF EXISTS "Admins can delete monthly list" ON public.monthly_influencer_list;

CREATE POLICY "Admins view all monthly list" ON public.monthly_influencer_list
  FOR SELECT USING (has_role(auth.uid(), 'ADMIN'::app_role));

CREATE POLICY "Team members view own team monthly list" ON public.monthly_influencer_list
  FOR SELECT USING (
    is_approved(auth.uid())
    AND team_id = get_user_team_id(auth.uid())
    AND (closer_id = auth.uid() OR has_role(auth.uid(), 'SUBADMIN'::app_role))
  );

CREATE POLICY "Closers insert own monthly list" ON public.monthly_influencer_list
  FOR INSERT WITH CHECK (
    closer_id = auth.uid() AND is_approved(auth.uid())
    AND (team_id IS NULL OR team_id = get_user_team_id(auth.uid()))
  );

CREATE POLICY "Team members update own team monthly list" ON public.monthly_influencer_list
  FOR UPDATE USING (
    (closer_id = auth.uid() AND is_approved(auth.uid()) AND team_id = get_user_team_id(auth.uid()))
    OR (has_role(auth.uid(), 'SUBADMIN'::app_role) AND team_id = get_user_team_id(auth.uid()))
    OR has_role(auth.uid(), 'ADMIN'::app_role)
  );

CREATE POLICY "Admins delete monthly list" ON public.monthly_influencer_list
  FOR DELETE USING (has_role(auth.uid(), 'ADMIN'::app_role));

-- ----- KANBAN_INFLUENCERS -----
DROP POLICY IF EXISTS "Approved closers can view own kanban cards" ON public.kanban_influencers;
DROP POLICY IF EXISTS "Approved closers can insert own kanban cards" ON public.kanban_influencers;
DROP POLICY IF EXISTS "Approved closers can update own kanban cards" ON public.kanban_influencers;
DROP POLICY IF EXISTS "Approved closers can delete own kanban cards" ON public.kanban_influencers;

CREATE POLICY "Admins view all kanban" ON public.kanban_influencers
  FOR SELECT USING (has_role(auth.uid(), 'ADMIN'::app_role));

CREATE POLICY "Team members view own team kanban" ON public.kanban_influencers
  FOR SELECT USING (
    is_approved(auth.uid())
    AND team_id = get_user_team_id(auth.uid())
    AND (closer_id = auth.uid() OR has_role(auth.uid(), 'SUBADMIN'::app_role))
  );

CREATE POLICY "Closers insert own kanban" ON public.kanban_influencers
  FOR INSERT WITH CHECK (
    closer_id = auth.uid() AND is_approved(auth.uid())
    AND (team_id IS NULL OR team_id = get_user_team_id(auth.uid()))
  );

CREATE POLICY "Team members update own team kanban" ON public.kanban_influencers
  FOR UPDATE USING (
    (closer_id = auth.uid() AND is_approved(auth.uid()) AND team_id = get_user_team_id(auth.uid()))
    OR has_role(auth.uid(), 'ADMIN'::app_role)
  );

CREATE POLICY "Team members delete own kanban" ON public.kanban_influencers
  FOR DELETE USING (
    (closer_id = auth.uid() AND is_approved(auth.uid()) AND team_id = get_user_team_id(auth.uid()))
    OR has_role(auth.uid(), 'ADMIN'::app_role)
  );

-- ----- MONTHLY_PLATFORM_NAMES -----
DROP POLICY IF EXISTS "Approved closers can view own platform names" ON public.monthly_platform_names;
DROP POLICY IF EXISTS "Approved closers can insert own platform names" ON public.monthly_platform_names;
DROP POLICY IF EXISTS "Approved closers can update own platform names" ON public.monthly_platform_names;
DROP POLICY IF EXISTS "Admins can delete platform names" ON public.monthly_platform_names;

CREATE POLICY "Admins view all platform names" ON public.monthly_platform_names
  FOR SELECT USING (has_role(auth.uid(), 'ADMIN'::app_role));

CREATE POLICY "Team members view own team platform names" ON public.monthly_platform_names
  FOR SELECT USING (
    is_approved(auth.uid())
    AND team_id = get_user_team_id(auth.uid())
    AND (closer_id = auth.uid() OR has_role(auth.uid(), 'SUBADMIN'::app_role))
  );

CREATE POLICY "Closers insert own platform names" ON public.monthly_platform_names
  FOR INSERT WITH CHECK (
    closer_id = auth.uid() AND is_approved(auth.uid())
    AND (team_id IS NULL OR team_id = get_user_team_id(auth.uid()))
  );

CREATE POLICY "Team members update own team platform names" ON public.monthly_platform_names
  FOR UPDATE USING (
    (closer_id = auth.uid() AND is_approved(auth.uid()) AND team_id = get_user_team_id(auth.uid()))
    OR (has_role(auth.uid(), 'SUBADMIN'::app_role) AND team_id = get_user_team_id(auth.uid()))
    OR has_role(auth.uid(), 'ADMIN'::app_role)
  );

CREATE POLICY "Admins delete platform names" ON public.monthly_platform_names
  FOR DELETE USING (has_role(auth.uid(), 'ADMIN'::app_role));

-- ----- PROFILES (add SUBADMIN team access) -----
CREATE POLICY "SUBADMIN can view team profiles" ON public.profiles
  FOR SELECT USING (
    has_role(auth.uid(), 'SUBADMIN'::app_role)
    AND team_id = get_user_team_id(auth.uid())
  );

CREATE POLICY "SUBADMIN can update team profiles" ON public.profiles
  FOR UPDATE USING (
    has_role(auth.uid(), 'SUBADMIN'::app_role)
    AND team_id = get_user_team_id(auth.uid())
  );
