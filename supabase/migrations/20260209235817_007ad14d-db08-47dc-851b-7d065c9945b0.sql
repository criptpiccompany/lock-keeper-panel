
-- ============================================================
-- 1. Add soft-delete columns to key tables
-- ============================================================
ALTER TABLE public.daily_influencer_records
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by uuid DEFAULT NULL;

ALTER TABLE public.influencers
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by uuid DEFAULT NULL;

ALTER TABLE public.daily_sheets
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by uuid DEFAULT NULL;

-- ============================================================
-- 2. Remove closer DELETE policy on daily_sheets
-- ============================================================
DROP POLICY IF EXISTS "Closers can delete own days" ON public.daily_sheets;

-- Only admins can hard-delete (for exceptional cases)
CREATE POLICY "Admins can delete daily_sheets"
  ON public.daily_sheets FOR DELETE
  USING (public.has_role(auth.uid(), 'ADMIN'::app_role));

-- ============================================================
-- 3. Update SELECT policies to hide soft-deleted from closers
-- ============================================================

-- daily_influencer_records: closers only see non-deleted
DROP POLICY IF EXISTS "Closers can view own records" ON public.daily_influencer_records;
CREATE POLICY "Closers can view own records"
  ON public.daily_influencer_records FOR SELECT
  USING (
    (closer_id = auth.uid() AND deleted_at IS NULL)
    OR has_role(auth.uid(), 'ADMIN'::app_role)
  );

-- daily_sheets: closers only see non-deleted
DROP POLICY IF EXISTS "Closers can view own days" ON public.daily_sheets;
CREATE POLICY "Closers can view own days"
  ON public.daily_sheets FOR SELECT
  USING (
    (closer_id = auth.uid() AND deleted_at IS NULL)
    OR has_role(auth.uid(), 'ADMIN'::app_role)
  );

-- influencers: non-admin users only see non-deleted
DROP POLICY IF EXISTS "Authenticated users can view all influencers" ON public.influencers;
CREATE POLICY "Authenticated users can view non-deleted influencers"
  ON public.influencers FOR SELECT
  USING (
    (auth.uid() IS NOT NULL AND deleted_at IS NULL)
    OR has_role(auth.uid(), 'ADMIN'::app_role)
  );

-- ============================================================
-- 4. Ensure no DELETE for closers on records and influencers
-- ============================================================
-- daily_influencer_records already has no DELETE policy — good
-- influencers already has no DELETE policy — good
-- We ensure only admins can hard-delete if needed:

CREATE POLICY "Admins can delete daily_records"
  ON public.daily_influencer_records FOR DELETE
  USING (public.has_role(auth.uid(), 'ADMIN'::app_role));

CREATE POLICY "Admins can delete influencers"
  ON public.influencers FOR DELETE
  USING (public.has_role(auth.uid(), 'ADMIN'::app_role));

-- ============================================================
-- 5. Indexes for soft-delete filtering
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_dir_deleted_at ON public.daily_influencer_records (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inf_deleted_at ON public.influencers (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ds_deleted_at ON public.daily_sheets (deleted_at) WHERE deleted_at IS NOT NULL;
