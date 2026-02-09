
-- ============================================================
-- 1. Create comprehensive audit_logs table
-- ============================================================
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid,
  actor_nome text,
  actor_role text,
  entity_type text NOT NULL,
  entity_id text,
  action text NOT NULL,
  field_changes jsonb,
  description text
);

-- ============================================================
-- 2. RLS: append-only, admin-read, server-insert only
-- ============================================================
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Admins can read all
CREATE POLICY "Admins can read audit_logs"
  ON public.audit_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'ADMIN'::app_role));

-- No insert/update/delete for regular users
-- Triggers run as SECURITY DEFINER so they bypass RLS

-- ============================================================
-- 3. Indexes for filtering
-- ============================================================
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs (created_at DESC);
CREATE INDEX idx_audit_logs_entity_type ON public.audit_logs (entity_type);
CREATE INDEX idx_audit_logs_actor ON public.audit_logs (actor_user_id);
CREATE INDEX idx_audit_logs_action ON public.audit_logs (action);

-- ============================================================
-- 4. Generic audit trigger function
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor_id uuid;
  _actor_nome text;
  _actor_role text;
  _entity_id text;
  _changes jsonb;
  _old_row jsonb;
  _new_row jsonb;
  _key text;
BEGIN
  -- Get actor info from session (set by Supabase auth)
  _actor_id := auth.uid();
  
  -- Try to get actor name
  SELECT nome INTO _actor_nome FROM public.profiles WHERE id = _actor_id;
  
  -- Try to get actor role
  SELECT role::text INTO _actor_role FROM public.user_roles WHERE user_id = _actor_id LIMIT 1;

  IF TG_OP = 'DELETE' THEN
    _entity_id := OLD.id::text;
    _old_row := to_jsonb(OLD);
    -- Remove noise fields
    _old_row := _old_row - 'updated_at' - 'created_at';
    
    INSERT INTO public.audit_logs (actor_user_id, actor_nome, actor_role, entity_type, entity_id, action, field_changes, description)
    VALUES (_actor_id, _actor_nome, _actor_role, TG_TABLE_NAME, _entity_id, 'DELETE', jsonb_build_object('before', _old_row), 'Registro removido');
    RETURN OLD;
    
  ELSIF TG_OP = 'INSERT' THEN
    _entity_id := NEW.id::text;
    _new_row := to_jsonb(NEW);
    _new_row := _new_row - 'updated_at' - 'created_at';
    
    INSERT INTO public.audit_logs (actor_user_id, actor_nome, actor_role, entity_type, entity_id, action, field_changes, description)
    VALUES (_actor_id, _actor_nome, _actor_role, TG_TABLE_NAME, _entity_id, 'INSERT', jsonb_build_object('after', _new_row), 'Registro criado');
    RETURN NEW;
    
  ELSIF TG_OP = 'UPDATE' THEN
    _entity_id := NEW.id::text;
    _old_row := to_jsonb(OLD);
    _new_row := to_jsonb(NEW);
    
    -- Build field_changes with before/after only for changed fields
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
    
    -- Only log if something actually changed
    IF _changes != '{}'::jsonb THEN
      INSERT INTO public.audit_logs (actor_user_id, actor_nome, actor_role, entity_type, entity_id, action, field_changes, description)
      VALUES (_actor_id, _actor_nome, _actor_role, TG_TABLE_NAME, _entity_id, 'UPDATE', _changes, 'Registro atualizado');
    END IF;
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$;

-- ============================================================
-- 5. Attach triggers to key tables
-- ============================================================

-- daily_influencer_records
CREATE TRIGGER audit_daily_influencer_records
  AFTER INSERT OR UPDATE OR DELETE ON public.daily_influencer_records
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

-- influencers
CREATE TRIGGER audit_influencers
  AFTER INSERT OR UPDATE OR DELETE ON public.influencers
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

-- daily_sheets
CREATE TRIGGER audit_daily_sheets
  AFTER INSERT OR UPDATE OR DELETE ON public.daily_sheets
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

-- close_events
CREATE TRIGGER audit_close_events
  AFTER INSERT OR UPDATE OR DELETE ON public.close_events
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();
