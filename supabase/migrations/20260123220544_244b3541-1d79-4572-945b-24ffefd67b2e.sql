-- Drop the SECURITY DEFINER view that caused the warning
DROP VIEW IF EXISTS public.influencers_public_view;

-- The function get_public_influencers is already SECURITY DEFINER and safe
-- because it only returns non-sensitive columns and requires authentication
-- Update it to query the table directly

CREATE OR REPLACE FUNCTION public.get_public_influencers()
RETURNS TABLE (
  id uuid,
  handle text,
  last_closed_at timestamptz,
  ativo boolean,
  created_at timestamptz,
  is_locked boolean,
  locked_until timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    i.id,
    i.handle,
    i.last_closed_at,
    i.ativo,
    i.created_at,
    CASE 
      WHEN i.owner_id IS NOT NULL 
           AND i.last_closed_at IS NOT NULL 
           AND (i.last_closed_at + INTERVAL '10 days') > now() 
      THEN true 
      ELSE false 
    END as is_locked,
    CASE 
      WHEN i.owner_id IS NOT NULL 
           AND i.last_closed_at IS NOT NULL 
           AND (i.last_closed_at + INTERVAL '10 days') > now() 
      THEN i.last_closed_at + INTERVAL '10 days'
      ELSE NULL 
    END as locked_until
  FROM public.influencers i
  WHERE i.ativo = true
    AND auth.uid() IS NOT NULL;
$$;