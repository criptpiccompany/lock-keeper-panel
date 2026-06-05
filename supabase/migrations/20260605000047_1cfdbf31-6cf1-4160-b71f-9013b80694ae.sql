CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _invite_token text;
  _invite_team_id uuid;
  _invite_role app_role;
  _default_team_id uuid;
BEGIN
  _invite_token := NEW.raw_user_meta_data->>'invite_token';
  _default_team_id := (SELECT id FROM public.teams WHERE name = 'CRIPTPIC' LIMIT 1);

  IF _invite_token IS NOT NULL AND length(trim(_invite_token)) > 0 THEN
    SELECT i.team_id, i.role_to_assign
    INTO _invite_team_id, _invite_role
    FROM public.invites i
    WHERE i.token = _invite_token
      AND i.expires_at > now()
      AND i.use_count < i.max_uses;

    IF FOUND THEN
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
$function$;