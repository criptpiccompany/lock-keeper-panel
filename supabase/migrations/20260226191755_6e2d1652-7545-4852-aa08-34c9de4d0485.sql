
-- Helper: checks if two users share the same team
CREATE OR REPLACE FUNCTION public.is_same_team(_user_id_a uuid, _user_id_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _user_id_a IS NULL OR _user_id_b IS NULL THEN false
    ELSE (
      SELECT p1.team_id IS NOT NULL AND p1.team_id = p2.team_id
      FROM public.profiles p1, public.profiles p2
      WHERE p1.id = _user_id_a AND p2.id = _user_id_b
    )
  END
$$;

-- Helper: checks if user is SUBADMIN and target is same team
CREATE OR REPLACE FUNCTION public.is_team_admin(_admin_id uuid, _target_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _admin_id IS NULL OR _target_id IS NULL THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = _admin_id AND ur.role = 'SUBADMIN'
    ) AND (
      SELECT p1.team_id IS NOT NULL AND p1.team_id = p2.team_id
      FROM public.profiles p1, public.profiles p2
      WHERE p1.id = _admin_id AND p2.id = _target_id
    )
  END
$$;

-- Helper: get team_id for a user
CREATE OR REPLACE FUNCTION public.get_user_team_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT team_id FROM public.profiles WHERE id = _user_id
$$;
