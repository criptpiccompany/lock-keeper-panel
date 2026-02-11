
-- Ensure unique constraint on (closer_id, date) for daily_sheets
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_sheets_closer_date ON public.daily_sheets (closer_id, date) WHERE deleted_at IS NULL;
