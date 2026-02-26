
-- 1. Add team_id to audit_logs
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS team_id uuid;

-- Backfill team_id from actor's profile
UPDATE public.audit_logs al
SET team_id = p.team_id
FROM public.profiles p
WHERE al.actor_user_id = p.id AND al.team_id IS NULL;

-- Add SUBADMIN RLS policy for audit_logs
CREATE POLICY "SubAdmins can view team audit_logs"
ON public.audit_logs
FOR SELECT
USING (
  has_role(auth.uid(), 'SUBADMIN'::app_role) 
  AND team_id = get_user_team_id(auth.uid())
);

-- 2. Add team_id to admin_notifications
ALTER TABLE public.admin_notifications ADD COLUMN IF NOT EXISTS team_id uuid;

-- Backfill
UPDATE public.admin_notifications an
SET team_id = p.team_id
FROM public.profiles p
WHERE an.actor_user_id = p.id AND an.team_id IS NULL;

-- Add SUBADMIN RLS policies for admin_notifications
CREATE POLICY "SubAdmins can view team notifications"
ON public.admin_notifications
FOR SELECT
USING (
  has_role(auth.uid(), 'SUBADMIN'::app_role)
  AND team_id = get_user_team_id(auth.uid())
);

CREATE POLICY "SubAdmins can update team notifications"
ON public.admin_notifications
FOR UPDATE
USING (
  has_role(auth.uid(), 'SUBADMIN'::app_role)
  AND team_id = get_user_team_id(auth.uid())
);

-- 3. Update fn_audit_trigger to populate team_id
CREATE OR REPLACE FUNCTION public.fn_audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _actor_id uuid;
  _actor_nome text;
  _actor_role text;
  _actor_team_id uuid;
  _entity_id text;
  _changes jsonb;
  _old_row jsonb;
  _new_row jsonb;
  _key text;
  _edit_reason text;
BEGIN
  _actor_id := auth.uid();
  SELECT nome, team_id INTO _actor_nome, _actor_team_id FROM public.profiles WHERE id = _actor_id;
  SELECT role::text INTO _actor_role FROM public.user_roles WHERE user_id = _actor_id LIMIT 1;
  
  BEGIN
    _edit_reason := current_setting('app.edit_reason', true);
  EXCEPTION WHEN OTHERS THEN
    _edit_reason := NULL;
  END;

  IF TG_OP = 'DELETE' THEN
    _entity_id := OLD.id::text;
    _old_row := to_jsonb(OLD);
    _old_row := _old_row - 'updated_at' - 'created_at';
    INSERT INTO public.audit_logs (actor_user_id, actor_nome, actor_role, entity_type, entity_id, action, field_changes, description, edit_reason, team_id)
    VALUES (_actor_id, _actor_nome, _actor_role, TG_TABLE_NAME, _entity_id, 'DELETE', jsonb_build_object('before', _old_row), 'Registro removido', _edit_reason, _actor_team_id);
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    _entity_id := NEW.id::text;
    _new_row := to_jsonb(NEW);
    _new_row := _new_row - 'updated_at' - 'created_at';
    INSERT INTO public.audit_logs (actor_user_id, actor_nome, actor_role, entity_type, entity_id, action, field_changes, description, edit_reason, team_id)
    VALUES (_actor_id, _actor_nome, _actor_role, TG_TABLE_NAME, _entity_id, 'INSERT', jsonb_build_object('after', _new_row), 'Registro criado', _edit_reason, _actor_team_id);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    _entity_id := NEW.id::text;
    _old_row := to_jsonb(OLD);
    _new_row := to_jsonb(NEW);
    _changes := '{}'::jsonb;
    FOR _key IN SELECT jsonb_object_keys(_new_row)
    LOOP
      IF _key NOT IN ('updated_at', 'created_at') THEN
        IF (_old_row ->> _key) IS DISTINCT FROM (_new_row ->> _key) THEN
          _changes := _changes || jsonb_build_object(
            _key, jsonb_build_object('before', _old_row -> _key, 'after', _new_row -> _key)
          );
        END IF;
      END IF;
    END LOOP;
    IF _changes != '{}'::jsonb THEN
      INSERT INTO public.audit_logs (actor_user_id, actor_nome, actor_role, entity_type, entity_id, action, field_changes, description, edit_reason, team_id)
      VALUES (_actor_id, _actor_nome, _actor_role, TG_TABLE_NAME, _entity_id, 'UPDATE', _changes, 'Registro atualizado', _edit_reason, _actor_team_id);
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$function$;
