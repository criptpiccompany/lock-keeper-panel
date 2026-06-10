CREATE OR REPLACE FUNCTION public.block_closer_receipt_soft_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only ADMIN or FINANCEIRO may soft-delete (set deleted_at) a receipt.
  IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at AND NEW.deleted_at IS NOT NULL THEN
    IF NOT is_global_viewer(auth.uid()) THEN
      RAISE EXCEPTION 'Apenas ADMIN ou FINANCEIRO podem excluir comprovantes';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_closer_receipt_soft_delete ON public.daily_receipt_uploads;
CREATE TRIGGER trg_block_closer_receipt_soft_delete
  BEFORE UPDATE ON public.daily_receipt_uploads
  FOR EACH ROW EXECUTE FUNCTION public.block_closer_receipt_soft_delete();