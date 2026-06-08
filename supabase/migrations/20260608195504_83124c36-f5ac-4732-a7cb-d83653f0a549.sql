CREATE TRIGGER trg_audit_kanban_influencers
AFTER INSERT OR UPDATE OR DELETE ON public.kanban_influencers
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();