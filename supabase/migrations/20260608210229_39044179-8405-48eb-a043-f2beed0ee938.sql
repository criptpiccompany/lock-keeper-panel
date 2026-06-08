CREATE OR REPLACE FUNCTION public.sync_influencer_to_closer(_handle text, _closer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _normalized text;
  _closer_team uuid;
  _closer_nome text;
  _existing_id uuid;
  _existing_owner uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT is_approved(auth.uid()) THEN
    RETURN;
  END IF;
  IF _handle IS NULL OR _closer_id IS NULL THEN
    RETURN;
  END IF;

  _normalized := '@' || lower(regexp_replace(_handle, '^@', ''));

  SELECT team_id, nome INTO _closer_team, _closer_nome
  FROM public.profiles WHERE id = _closer_id;

  IF _closer_team IS NULL THEN
    RETURN;
  END IF;

  SELECT id, owner_id INTO _existing_id, _existing_owner
  FROM public.influencers
  WHERE lower(handle) = _normalized
  LIMIT 1;

  IF _existing_id IS NULL THEN
    INSERT INTO public.influencers (handle, owner_id, owner_nome, ativo, team_id, last_closed_at)
    VALUES (_normalized, _closer_id, _closer_nome, true, _closer_team, now());
  ELSE
    IF _existing_owner IS DISTINCT FROM _closer_id THEN
      UPDATE public.influencers
      SET owner_id = _closer_id,
          owner_nome = _closer_nome,
          team_id = _closer_team,
          ativo = true,
          last_closed_at = now(),
          deleted_at = NULL
      WHERE id = _existing_id;
    END IF;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_influencer_to_closer(text, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.sync_influencer_to_closer(text, uuid) TO authenticated;