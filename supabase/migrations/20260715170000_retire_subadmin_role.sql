-- SUBADMIN foi descontinuado. Mantemos o valor histórico no enum porque o
-- PostgreSQL não remove valores de enum sem recriar todas as dependências.
-- A partir desta migration, ele não pode mais existir nos dados nem ser usado.

UPDATE public.user_roles
SET role = 'CLOSER'::public.app_role
WHERE role = 'SUBADMIN'::public.app_role;

UPDATE public.invites
SET role_to_assign = 'CLOSER'::public.app_role
WHERE role_to_assign = 'SUBADMIN'::public.app_role;

DROP POLICY IF EXISTS "SubAdmins view own team invites" ON public.invites;
DROP POLICY IF EXISTS "SubAdmins insert own team invites" ON public.invites;
DROP POLICY IF EXISTS "SubAdmins delete own team invites" ON public.invites;
DROP POLICY IF EXISTS "SUBADMIN can view team profiles" ON public.profiles;
DROP POLICY IF EXISTS "SUBADMIN can update team profiles" ON public.profiles;
DROP POLICY IF EXISTS "SubAdmins can view team audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "SubAdmins can view team notifications" ON public.admin_notifications;
DROP POLICY IF EXISTS "SubAdmins can update team notifications" ON public.admin_notifications;

DROP FUNCTION IF EXISTS public.is_team_admin(uuid, uuid);

DROP POLICY IF EXISTS "Team members view own team records" ON public.daily_influencer_records;
CREATE POLICY "Closers view own records" ON public.daily_influencer_records
  FOR SELECT USING (
    (closer_id = auth.uid() AND is_approved(auth.uid()) AND deleted_at IS NULL)
    OR has_role(auth.uid(), 'ADMIN'::public.app_role)
    OR has_role(auth.uid(), 'FINANCEIRO'::public.app_role)
  );

DROP POLICY IF EXISTS "Team members update records" ON public.daily_influencer_records;
CREATE POLICY "Closers update own records" ON public.daily_influencer_records
  FOR UPDATE
  USING (
    (closer_id = auth.uid() AND is_approved(auth.uid()))
    OR has_role(auth.uid(), 'ADMIN'::public.app_role)
    OR has_role(auth.uid(), 'FINANCEIRO'::public.app_role)
  )
  WITH CHECK (
    (closer_id = auth.uid() AND is_approved(auth.uid()))
    OR has_role(auth.uid(), 'ADMIN'::public.app_role)
    OR has_role(auth.uid(), 'FINANCEIRO'::public.app_role)
  );

DROP POLICY IF EXISTS "Team members view own team sheets" ON public.daily_sheets;
CREATE POLICY "Closers view own sheets" ON public.daily_sheets
  FOR SELECT USING (
    (closer_id = auth.uid() AND is_approved(auth.uid()) AND deleted_at IS NULL)
    OR has_role(auth.uid(), 'ADMIN'::public.app_role)
    OR has_role(auth.uid(), 'FINANCEIRO'::public.app_role)
  );

DROP POLICY IF EXISTS "Team members view own team monthly list" ON public.monthly_influencer_list;
CREATE POLICY "Closers view own monthly list" ON public.monthly_influencer_list
  FOR SELECT USING (
    (closer_id = auth.uid() AND is_approved(auth.uid()))
    OR has_role(auth.uid(), 'ADMIN'::public.app_role)
    OR has_role(auth.uid(), 'FINANCEIRO'::public.app_role)
  );

DROP POLICY IF EXISTS "Team members update own team monthly list" ON public.monthly_influencer_list;
CREATE POLICY "Closers update own monthly list" ON public.monthly_influencer_list
  FOR UPDATE
  USING (
    (closer_id = auth.uid() AND is_approved(auth.uid()))
    OR has_role(auth.uid(), 'ADMIN'::public.app_role)
    OR has_role(auth.uid(), 'FINANCEIRO'::public.app_role)
  )
  WITH CHECK (
    (closer_id = auth.uid() AND is_approved(auth.uid()))
    OR has_role(auth.uid(), 'ADMIN'::public.app_role)
    OR has_role(auth.uid(), 'FINANCEIRO'::public.app_role)
  );

DROP POLICY IF EXISTS "Team members view own team kanban" ON public.kanban_influencers;
CREATE POLICY "Closers view own kanban" ON public.kanban_influencers
  FOR SELECT USING (
    (closer_id = auth.uid() AND is_approved(auth.uid()))
    OR has_role(auth.uid(), 'ADMIN'::public.app_role)
  );

DROP POLICY IF EXISTS "Team members view own team platform names" ON public.monthly_platform_names;
CREATE POLICY "Closers view own platform names" ON public.monthly_platform_names
  FOR SELECT USING (
    (closer_id = auth.uid() AND is_approved(auth.uid()))
    OR has_role(auth.uid(), 'ADMIN'::public.app_role)
    OR has_role(auth.uid(), 'FINANCEIRO'::public.app_role)
  );

DROP POLICY IF EXISTS "Team members update own team platform names" ON public.monthly_platform_names;
CREATE POLICY "Closers update own platform names" ON public.monthly_platform_names
  FOR UPDATE
  USING (
    (closer_id = auth.uid() AND is_approved(auth.uid()))
    OR has_role(auth.uid(), 'ADMIN'::public.app_role)
    OR has_role(auth.uid(), 'FINANCEIRO'::public.app_role)
  )
  WITH CHECK (
    (closer_id = auth.uid() AND is_approved(auth.uid()))
    OR has_role(auth.uid(), 'ADMIN'::public.app_role)
    OR has_role(auth.uid(), 'FINANCEIRO'::public.app_role)
  );

DROP POLICY IF EXISTS "Closer can view own receipts" ON public.daily_receipt_uploads;
CREATE POLICY "Closer can view own receipts" ON public.daily_receipt_uploads
  FOR SELECT USING (
    deleted_at IS NULL AND (
      closer_id = auth.uid()
      OR has_role(auth.uid(), 'ADMIN'::public.app_role)
      OR has_role(auth.uid(), 'FINANCEIRO'::public.app_role)
    )
  );

ALTER TABLE public.user_roles
  DROP CONSTRAINT IF EXISTS user_roles_disallow_retired_subadmin,
  ADD CONSTRAINT user_roles_disallow_retired_subadmin
    CHECK (role <> 'SUBADMIN'::public.app_role);

ALTER TABLE public.invites
  DROP CONSTRAINT IF EXISTS invites_disallow_retired_subadmin,
  ADD CONSTRAINT invites_disallow_retired_subadmin
    CHECK (role_to_assign IS NULL OR role_to_assign <> 'SUBADMIN'::public.app_role);
