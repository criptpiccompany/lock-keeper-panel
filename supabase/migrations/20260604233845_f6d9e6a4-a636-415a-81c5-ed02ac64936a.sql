-- Reinstall handle_new_user trigger on auth.users (it was missing)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Backfill profiles + roles for existing auth users that have no profile yet
DO $$
DECLARE
  u RECORD;
  _default_team_id uuid;
  _invite_token text;
  _invite_team_id uuid;
  _invite_role public.app_role;
BEGIN
  SELECT id INTO _default_team_id FROM public.teams WHERE name = 'Ciphera (Principal)' LIMIT 1;

  FOR u IN
    SELECT au.id, au.email, au.raw_user_meta_data, au.created_at
    FROM auth.users au
    LEFT JOIN public.profiles p ON p.id = au.id
    WHERE p.id IS NULL
  LOOP
    _invite_token := u.raw_user_meta_data->>'invite_token';
    _invite_team_id := NULL;
    _invite_role := NULL;

    IF _invite_token IS NOT NULL AND length(trim(_invite_token)) > 0 THEN
      SELECT i.team_id, i.role_to_assign
      INTO _invite_team_id, _invite_role
      FROM public.invites i
      WHERE i.token = _invite_token
      LIMIT 1;
    END IF;

    INSERT INTO public.profiles (id, nome, team_id, status)
    VALUES (
      u.id,
      COALESCE(u.raw_user_meta_data->>'nome', split_part(u.email, '@', 1)),
      COALESCE(_invite_team_id, _default_team_id),
      'pending'
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (u.id, COALESCE(_invite_role, 'CLOSER'))
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;