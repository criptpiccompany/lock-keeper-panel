CREATE OR REPLACE FUNCTION public.get_global_daily_revenue(_start date, _end date)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(faturamento), 0)::numeric
  FROM public.daily_influencer_records
  WHERE date >= _start
    AND date <= _end
    AND deleted_at IS NULL
    AND auth.uid() IS NOT NULL
    AND is_approved(auth.uid());
$$;

GRANT EXECUTE ON FUNCTION public.get_global_daily_revenue(date, date) TO authenticated;