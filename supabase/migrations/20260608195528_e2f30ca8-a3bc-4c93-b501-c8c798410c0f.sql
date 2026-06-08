CREATE POLICY "Team can view kanban audit_logs"
ON public.audit_logs FOR SELECT
TO authenticated
USING (
  entity_type = 'kanban_influencers'
  AND team_id = public.get_user_team_id(auth.uid())
);