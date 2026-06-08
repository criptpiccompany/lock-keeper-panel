DROP POLICY IF EXISTS "Closer can view own receipts" ON public.daily_receipt_uploads;
CREATE POLICY "Closer can view own receipts"
ON public.daily_receipt_uploads
FOR SELECT
USING (
  (closer_id = auth.uid())
  OR is_global_viewer(auth.uid())
  OR (has_role(auth.uid(), 'SUBADMIN'::app_role) AND team_id = get_user_team_id(auth.uid()))
);

-- Make the UPDATE policy explicit (WITH CHECK = USING)
DROP POLICY IF EXISTS "Closer or admin/finance can update receipts" ON public.daily_receipt_uploads;
CREATE POLICY "Closer or admin/finance can update receipts"
ON public.daily_receipt_uploads
FOR UPDATE
USING ((closer_id = auth.uid()) OR is_global_viewer(auth.uid()))
WITH CHECK ((closer_id = auth.uid()) OR is_global_viewer(auth.uid()));