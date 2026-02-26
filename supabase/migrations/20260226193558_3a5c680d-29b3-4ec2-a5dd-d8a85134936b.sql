
-- Secure function: only ADMIN can move users between teams
CREATE OR REPLACE FUNCTION public.admin_move_user_team(_target_user_id uuid, _new_team_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate caller is ADMIN
  IF NOT has_role(auth.uid(), 'ADMIN'::app_role) THEN
    RAISE EXCEPTION 'Only ADMIN can move users between teams';
  END IF;

  -- Validate target user exists
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _target_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Validate team exists
  IF NOT EXISTS (SELECT 1 FROM public.teams WHERE id = _new_team_id) THEN
    RAISE EXCEPTION 'Team not found';
  END IF;

  -- Update profile team_id
  UPDATE public.profiles
  SET team_id = _new_team_id, updated_at = now()
  WHERE id = _target_user_id;
END;
$$;
