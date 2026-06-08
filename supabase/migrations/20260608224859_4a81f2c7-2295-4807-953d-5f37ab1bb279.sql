
-- 1. Add FINANCEIRO role to enum (must be its own statement; works inside tx for ALTER TYPE ADD VALUE in PG14+)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'FINANCEIRO';

-- 2. Helper function: ADMIN or FINANCEIRO (uses text comparison to avoid needing committed enum value)
CREATE OR REPLACE FUNCTION public.is_global_viewer(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _user_id IS NULL THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id
        AND role::text IN ('ADMIN','FINANCEIRO')
    )
  END
$$;

-- 3. Mirror ADMIN policies for FINANCEIRO across all tables (using is_global_viewer is simpler)
-- We add NEW policies (OR'd with existing). Drop & recreate where it makes the union cleaner.

-- admin_conflicts
CREATE POLICY "Finance can read conflicts" ON public.admin_conflicts FOR SELECT USING (is_global_viewer(auth.uid()));
CREATE POLICY "Finance can insert conflicts" ON public.admin_conflicts FOR INSERT WITH CHECK (is_global_viewer(auth.uid()));
CREATE POLICY "Finance can update conflicts" ON public.admin_conflicts FOR UPDATE USING (is_global_viewer(auth.uid()));
CREATE POLICY "Finance can delete conflicts" ON public.admin_conflicts FOR DELETE USING (is_global_viewer(auth.uid()));

-- admin_notifications
CREATE POLICY "Finance can read notifications" ON public.admin_notifications FOR SELECT USING (is_global_viewer(auth.uid()));
CREATE POLICY "Finance can update notifications" ON public.admin_notifications FOR UPDATE USING (is_global_viewer(auth.uid()));

-- audit_log / audit_logs
CREATE POLICY "Finance can read audit_log" ON public.audit_log FOR SELECT USING (is_global_viewer(auth.uid()));
CREATE POLICY "Finance can read audit_logs" ON public.audit_logs FOR SELECT USING (is_global_viewer(auth.uid()));

-- close_events
CREATE POLICY "Finance can view all events" ON public.close_events FOR SELECT USING (is_global_viewer(auth.uid()));

-- commission_tiers
CREATE POLICY "Finance can manage tiers" ON public.commission_tiers FOR ALL USING (is_global_viewer(auth.uid()));

-- daily_influencer_records
CREATE POLICY "Finance view all records" ON public.daily_influencer_records FOR SELECT USING (is_global_viewer(auth.uid()));
CREATE POLICY "Finance insert records" ON public.daily_influencer_records FOR INSERT WITH CHECK (is_global_viewer(auth.uid()));
CREATE POLICY "Finance update records" ON public.daily_influencer_records FOR UPDATE USING (is_global_viewer(auth.uid()));
CREATE POLICY "Finance delete records" ON public.daily_influencer_records FOR DELETE USING (is_global_viewer(auth.uid()));

-- daily_record_shared_partners
CREATE POLICY "Finance can manage all record partners" ON public.daily_record_shared_partners FOR ALL USING (is_global_viewer(auth.uid()));

-- daily_sheets
CREATE POLICY "Finance view all sheets" ON public.daily_sheets FOR SELECT USING (is_global_viewer(auth.uid()));
CREATE POLICY "Finance insert sheets" ON public.daily_sheets FOR INSERT WITH CHECK (is_global_viewer(auth.uid()));
CREATE POLICY "Finance update sheets" ON public.daily_sheets FOR UPDATE USING (is_global_viewer(auth.uid()));
CREATE POLICY "Finance delete sheets" ON public.daily_sheets FOR DELETE USING (is_global_viewer(auth.uid()));

-- influencer_locks
CREATE POLICY "Finance can view all locks" ON public.influencer_locks FOR SELECT USING (is_global_viewer(auth.uid()));
CREATE POLICY "Finance can delete locks" ON public.influencer_locks FOR DELETE USING (is_global_viewer(auth.uid()));

-- influencers
CREATE POLICY "Finance view all influencers" ON public.influencers FOR SELECT USING (is_global_viewer(auth.uid()));
CREATE POLICY "Finance update influencers" ON public.influencers FOR UPDATE USING (is_global_viewer(auth.uid()));

-- invites
CREATE POLICY "Finance view all invites" ON public.invites FOR SELECT USING (is_global_viewer(auth.uid()));

-- kanban_influencers
CREATE POLICY "Finance view all kanban" ON public.kanban_influencers FOR SELECT USING (is_global_viewer(auth.uid()));
CREATE POLICY "Finance update kanban" ON public.kanban_influencers FOR UPDATE USING (is_global_viewer(auth.uid()));

-- monthly_influencer_list
CREATE POLICY "Finance view all monthly list" ON public.monthly_influencer_list FOR SELECT USING (is_global_viewer(auth.uid()));
CREATE POLICY "Finance update monthly list" ON public.monthly_influencer_list FOR UPDATE USING (is_global_viewer(auth.uid()));
CREATE POLICY "Finance insert monthly list" ON public.monthly_influencer_list FOR INSERT WITH CHECK (is_global_viewer(auth.uid()));
CREATE POLICY "Finance delete monthly list" ON public.monthly_influencer_list FOR DELETE USING (is_global_viewer(auth.uid()));

-- monthly_platform_names
CREATE POLICY "Finance view all platform names" ON public.monthly_platform_names FOR SELECT USING (is_global_viewer(auth.uid()));
CREATE POLICY "Finance update platform names" ON public.monthly_platform_names FOR UPDATE USING (is_global_viewer(auth.uid()));
CREATE POLICY "Finance insert platform names" ON public.monthly_platform_names FOR INSERT WITH CHECK (is_global_viewer(auth.uid()));
CREATE POLICY "Finance delete platform names" ON public.monthly_platform_names FOR DELETE USING (is_global_viewer(auth.uid()));

-- profiles
CREATE POLICY "Finance can view all profiles" ON public.profiles FOR SELECT USING (is_global_viewer(auth.uid()));
CREATE POLICY "Finance can update any profile" ON public.profiles FOR UPDATE USING (is_global_viewer(auth.uid()));

-- team_shared_board
CREATE POLICY "Finance can view all shared board" ON public.team_shared_board FOR SELECT USING (is_global_viewer(auth.uid()));
CREATE POLICY "Finance can update shared board" ON public.team_shared_board FOR UPDATE USING (is_global_viewer(auth.uid()));
CREATE POLICY "Finance can insert shared board" ON public.team_shared_board FOR INSERT WITH CHECK (is_global_viewer(auth.uid()));
CREATE POLICY "Finance can delete shared board" ON public.team_shared_board FOR DELETE USING (is_global_viewer(auth.uid()));

-- teams
CREATE POLICY "Finance can view teams" ON public.teams FOR SELECT USING (is_global_viewer(auth.uid()));

-- user_roles
CREATE POLICY "Finance can view all roles" ON public.user_roles FOR SELECT USING (is_global_viewer(auth.uid()));

-- 4. Update helper RPC functions to include FINANCEIRO
CREATE OR REPLACE FUNCTION public.get_public_influencers()
 RETURNS TABLE(id uuid, handle text, last_closed_at timestamp with time zone, ativo boolean, created_at timestamp with time zone, is_locked boolean, locked_until timestamp with time zone, owner_nome text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      is_global_viewer(auth.uid())
      OR i.team_id = get_user_team_id(auth.uid())
    );
$function$;

CREATE OR REPLACE FUNCTION public.get_approved_closers()
 RETURNS TABLE(id uuid, nome text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.id, p.nome
  FROM public.profiles p
  WHERE p.status = 'approved'
    AND auth.uid() IS NOT NULL
    AND (
      is_global_viewer(auth.uid())
      OR p.team_id = get_user_team_id(auth.uid())
    )
  ORDER BY p.nome;
$function$;

-- 5. Create daily_receipt_uploads table
CREATE TABLE public.daily_receipt_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  closer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  daily_record_id uuid REFERENCES public.daily_influencer_records(id) ON DELETE SET NULL,
  file_url text NOT NULL,
  file_type text,
  uploaded_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  deleted_at timestamptz,
  deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_daily_receipts_date_closer ON public.daily_receipt_uploads(date, closer_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_daily_receipts_team ON public.daily_receipt_uploads(team_id, date) WHERE deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_receipt_uploads TO authenticated;
GRANT ALL ON public.daily_receipt_uploads TO service_role;

ALTER TABLE public.daily_receipt_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Closer can view own receipts" ON public.daily_receipt_uploads
  FOR SELECT USING (
    deleted_at IS NULL AND (
      closer_id = auth.uid()
      OR is_global_viewer(auth.uid())
      OR (has_role(auth.uid(), 'SUBADMIN'::app_role) AND team_id = get_user_team_id(auth.uid()))
    )
  );

CREATE POLICY "Closer or admin/finance can insert receipts" ON public.daily_receipt_uploads
  FOR INSERT WITH CHECK (
    is_approved(auth.uid()) AND (
      closer_id = auth.uid()
      OR is_global_viewer(auth.uid())
    )
  );

CREATE POLICY "Closer or admin/finance can update receipts" ON public.daily_receipt_uploads
  FOR UPDATE USING (
    closer_id = auth.uid() OR is_global_viewer(auth.uid())
  );

CREATE POLICY "Admin/Finance can hard delete receipts" ON public.daily_receipt_uploads
  FOR DELETE USING (is_global_viewer(auth.uid()));

-- Auto-set team_id on insert
CREATE OR REPLACE FUNCTION public.auto_set_receipt_team_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.team_id IS NULL THEN
    SELECT team_id INTO NEW.team_id FROM public.profiles WHERE id = NEW.closer_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_daily_receipts_set_team
BEFORE INSERT ON public.daily_receipt_uploads
FOR EACH ROW EXECUTE FUNCTION public.auto_set_receipt_team_id();

CREATE TRIGGER trg_daily_receipts_updated_at
BEFORE UPDATE ON public.daily_receipt_uploads
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Audit
CREATE TRIGGER trg_daily_receipts_audit
AFTER INSERT OR UPDATE OR DELETE ON public.daily_receipt_uploads
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

-- 6. Realtime
ALTER TABLE public.daily_receipt_uploads REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_receipt_uploads;

DO $$ BEGIN
  ALTER TABLE public.daily_influencer_records REPLICA IDENTITY FULL;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_influencer_records;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
