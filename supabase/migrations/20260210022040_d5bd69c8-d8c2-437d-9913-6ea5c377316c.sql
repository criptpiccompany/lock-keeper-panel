
-- ============================================================
-- HARDENING: SECURITY DEFINER functions
-- All functions already have search_path = 'public' (prevents hijack).
-- Adding: input validation, documentation, explicit NULL guards.
-- ============================================================

-- 1. has_role: Foundation role-check. Cannot add role check (circular).
--    Adding: NULL guard on inputs.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- SECURITY DEFINER: Required because RLS policies call this function.
  -- Adding a role check here would be circular.
  -- Input validation: returns false for NULL inputs (safe default).
  SELECT CASE
    WHEN _user_id IS NULL OR _role IS NULL THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id AND role = _role
    )
  END
$$;

-- 2. get_user_role: Returns role for a given user. Used by auth flow.
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  -- SECURITY DEFINER: Required so RLS policies can resolve roles.
  -- Input validation: returns NULL for NULL user_id.
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id AND _user_id IS NOT NULL
  LIMIT 1
$$;

-- 3. is_approved: Checks if user profile status = 'approved'.
CREATE OR REPLACE FUNCTION public.is_approved(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  -- SECURITY DEFINER: Required because RLS policies depend on this.
  -- Input validation: returns false for NULL user_id (safe default).
  SELECT CASE
    WHEN _user_id IS NULL THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = _user_id AND status = 'approved'
    )
  END
$$;

-- 4. validate_invite_token: Reads invites table to check token validity.
CREATE OR REPLACE FUNCTION public.validate_invite_token(_token text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  -- SECURITY DEFINER: Required so unauthenticated signup flow can validate tokens
  -- without needing SELECT on invites table (restricted to ADMIN by RLS).
  -- Input validation: returns false for NULL/empty token.
  SELECT CASE
    WHEN _token IS NULL OR length(trim(_token)) = 0 THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.invites
      WHERE token = _token
        AND expires_at > now()
        AND use_count < max_uses
    )
  END
$$;

-- 5. consume_invite_token: Marks token as used. Writes to invites table.
CREATE OR REPLACE FUNCTION public.consume_invite_token(_token text, _user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- SECURITY DEFINER: Required so signup flow can update invites table
  -- without needing UPDATE on invites (restricted to ADMIN by RLS).
  -- Input validation: reject NULL/empty inputs silently.
  IF _token IS NULL OR length(trim(_token)) = 0 OR _user_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.invites
  SET use_count = use_count + 1, used_by = _user_id, used_at = now()
  WHERE token = _token AND expires_at > now() AND use_count < max_uses;
END;
$$;

-- 6. get_public_influencers: Returns filtered influencer list.
--    Already checks auth.uid() IS NOT NULL. No changes needed beyond documentation.
CREATE OR REPLACE FUNCTION public.get_public_influencers()
RETURNS TABLE(id uuid, handle text, last_closed_at timestamp with time zone, ativo boolean, created_at timestamp with time zone, is_locked boolean, locked_until timestamp with time zone, owner_nome text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  -- SECURITY DEFINER: Required to bypass per-row RLS and apply business-logic filtering.
  -- Auth check: requires authenticated user (auth.uid() IS NOT NULL).
  -- Filters: only active, non-deleted influencers are returned.
  SELECT 
    i.id,
    i.handle,
    i.last_closed_at,
    i.ativo,
    i.created_at,
    CASE 
      WHEN i.owner_id IS NOT NULL 
           AND i.last_closed_at IS NOT NULL 
           AND (i.last_closed_at + INTERVAL '10 days') > now() 
      THEN true 
      ELSE false 
    END as is_locked,
    CASE 
      WHEN i.owner_id IS NOT NULL 
           AND i.last_closed_at IS NOT NULL 
           AND (i.last_closed_at + INTERVAL '10 days') > now() 
      THEN i.last_closed_at + INTERVAL '10 days'
      ELSE NULL 
    END as locked_until,
    i.owner_nome
  FROM public.influencers i
  WHERE i.ativo = true
    AND i.deleted_at IS NULL
    AND auth.uid() IS NOT NULL;
$$;

-- 7. update_updated_at_column: Trigger function, no user input. Already safe.
-- No changes needed. Documenting only via this comment.
-- SECURITY DEFINER not strictly needed here but does no harm on a trigger.

-- 8. fn_audit_trigger: Trigger function. Uses auth.uid() internally.
-- Already has search_path = 'public'. No user-controllable inputs.
-- No changes needed beyond existing implementation.

-- 9. handle_new_user: Trigger on auth.users INSERT. Uses NEW.id.
-- Already has search_path = 'public'. Triggered by Supabase Auth only.
-- No changes needed.
