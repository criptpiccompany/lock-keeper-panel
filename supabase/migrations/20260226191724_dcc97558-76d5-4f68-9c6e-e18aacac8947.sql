
-- Step 1: Only add the enum value (already added by failed migration, so use IF NOT EXISTS)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'SUBADMIN';
