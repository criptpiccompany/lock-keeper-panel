DROP POLICY IF EXISTS "Team members view team board" ON public.team_shared_board;
DROP POLICY IF EXISTS "Team members insert team board" ON public.team_shared_board;
DROP POLICY IF EXISTS "Team members update team board" ON public.team_shared_board;
DROP POLICY IF EXISTS "Team members delete team board" ON public.team_shared_board;

CREATE POLICY "Approved users view shared board"
  ON public.team_shared_board FOR SELECT
  TO authenticated
  USING (is_approved(auth.uid()));

CREATE POLICY "Approved users insert shared board"
  ON public.team_shared_board FOR INSERT
  TO authenticated
  WITH CHECK (is_approved(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Approved users update shared board"
  ON public.team_shared_board FOR UPDATE
  TO authenticated
  USING (is_approved(auth.uid()))
  WITH CHECK (is_approved(auth.uid()));

CREATE POLICY "Approved users delete shared board"
  ON public.team_shared_board FOR DELETE
  TO authenticated
  USING (is_approved(auth.uid()) OR has_role(auth.uid(), 'ADMIN'::app_role));

CREATE OR REPLACE FUNCTION public.get_shared_board_users()
RETURNS TABLE(id uuid, nome text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.id, p.nome
  FROM public.profiles p
  WHERE p.status = 'approved'
    AND auth.uid() IS NOT NULL
    AND is_approved(auth.uid())
  ORDER BY p.nome;
$$;

GRANT EXECUTE ON FUNCTION public.get_shared_board_users() TO authenticated;