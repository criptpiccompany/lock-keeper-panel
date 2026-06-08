CREATE TRIGGER trg_audit_team_shared_board
AFTER INSERT OR UPDATE OR DELETE ON public.team_shared_board
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

CREATE POLICY "Team can view shared board audit_logs"
ON public.audit_logs
FOR SELECT
USING (entity_type = 'team_shared_board' AND team_id = get_user_team_id(auth.uid()));