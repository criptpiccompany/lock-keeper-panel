ALTER TABLE public.daily_receipt_uploads
  ADD COLUMN IF NOT EXISTS parsed_data jsonb,
  ADD COLUMN IF NOT EXISTS parse_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS parsed_at timestamptz;