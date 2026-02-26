
-- ====================================================================
-- TEAM-LOCKED INVITES
-- ====================================================================

-- STEP 1: Add team_id and role_to_assign to invites
ALTER TABLE public.invites
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id),
  ADD COLUMN IF NOT EXISTS role_to_assign app_role DEFAULT 'CLOSER';

-- Backfill existing invites
UPDATE public.invites
SET team_id = (SELECT id FROM public.teams WHERE name = 'Ciphera (Principal)')
WHERE team_id IS NULL;

-- STEP 2: Update RLS policies
DROP POLICY IF EXISTS "Admins can delete invites" ON public.invites;
DROP POLICY IF EXISTS "Admins can insert invites" ON public.invites;
DROP POLICY IF EXISTS "Admins can select invites" ON public.invites;
DROP POLICY IF EXISTS "Admins can update invites" ON public.invites;

CREATE POLICY "Admins view all invites" ON public.invites
  FOR SELECT USING (has_role(auth.uid(), 'ADMIN'::app_role));

CREATE POLICY "SubAdmins view own team invites" ON public.invites
  FOR SELECT USING (
    has_role(auth.uid(), 'SUBADMIN'::app_role)
    AND team_id = get_user_team_id(auth.uid())
  );

CREATE POLICY "Admins insert invites" ON public.invites
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'ADMIN'::app_role)
    AND created_by = auth.uid()
  );

CREATE POLICY "SubAdmins insert own team invites" ON public.invites
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'SUBADMIN'::app_role)
    AND created_by = auth.uid()
    AND team_id = get_user_team_id(auth.uid())
  );

CREATE POLICY "Admins update invites" ON public.invites
  FOR UPDATE USING (has_role(auth.uid(), 'ADMIN'::app_role));

CREATE POLICY "Admins delete invites" ON public.invites
  FOR DELETE USING (has_role(auth.uid(), 'ADMIN'::app_role));

CREATE POLICY "SubAdmins delete own team invites" ON public.invites
  FOR DELETE USING (
    has_role(auth.uid(), 'SUBADMIN'::app_role)
    AND team_id = get_user_team_id(auth.uid())
  );

-- STEP 3: Update handle_new_user to consume invite and apply team/role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invite_token text;
  _invite_team_id uuid;
  _invite_role app_role;
  _default_team_id uuid;
BEGIN
  _invite_token := NEW.raw_user_meta_data->>'invite_token';
  _default_team_id := (SELECT id FROM public.teams WHERE name = 'Ciphera (Principal)' LIMIT 1);

  IF _invite_token IS NOT NULL AND length(trim(_invite_token)) > 0 THEN
    -- Look up valid invite
    SELECT i.team_id, i.role_to_assign
    INTO _invite_team_id, _invite_role
    FROM public.invites i
    WHERE i.token = _invite_token
      AND i.expires_at > now()
      AND i.use_count < i.max_uses;

    IF FOUND THEN
      -- Consume the invite
      UPDATE public.invites
      SET use_count = use_count + 1, used_by = NEW.id, used_at = now()
      WHERE token = _invite_token;
    ELSE
      _invite_team_id := _default_team_id;
      _invite_role := 'CLOSER';
    END IF;
  ELSE
    _invite_team_id := _default_team_id;
    _invite_role := 'CLOSER';
  END IF;

  INSERT INTO public.profiles (id, nome, team_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    COALESCE(_invite_team_id, _default_team_id)
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE(_invite_role, 'CLOSER'));

  RETURN NEW;
END;
$$;

-- STEP 4: Update validate_invite_token to return team info (keep backward compat)
-- No changes needed - it just returns boolean

-- STEP 5: consume_invite_token kept for backward compatibility but handle_new_user now handles it
