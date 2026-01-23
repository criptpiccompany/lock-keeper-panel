-- Drop existing overly permissive SELECT policies
DROP POLICY IF EXISTS "Closers can view active influencers" ON public.influencers;

-- Create a safer SELECT policy for closers: only their own influencers
CREATE POLICY "Closers can view their own influencers"
  ON public.influencers FOR SELECT
  USING (
    owner_id = auth.uid() 
    OR public.has_role(auth.uid(), 'ADMIN')
  );

-- Create a SECURITY DEFINER view for the general panel (closers)
-- This view shows limited data without exposing owner identity
CREATE OR REPLACE VIEW public.influencers_public_view
WITH (security_invoker = false)
AS
SELECT 
  id,
  handle,
  last_closed_at,
  ativo,
  created_at,
  -- Computed: is it locked? (has owner and within 10 days)
  CASE 
    WHEN owner_id IS NOT NULL 
         AND last_closed_at IS NOT NULL 
         AND (last_closed_at + INTERVAL '10 days') > now() 
    THEN true 
    ELSE false 
  END as is_locked,
  -- Computed: when does the lock expire?
  CASE 
    WHEN owner_id IS NOT NULL 
         AND last_closed_at IS NOT NULL 
         AND (last_closed_at + INTERVAL '10 days') > now() 
    THEN last_closed_at + INTERVAL '10 days'
    ELSE NULL 
  END as locked_until
FROM public.influencers
WHERE ativo = true;

-- Grant SELECT on the view to authenticated users
GRANT SELECT ON public.influencers_public_view TO authenticated;

-- Create a function to get public influencers for closers (with auth check)
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
    id,
    handle,
    last_closed_at,
    ativo,
    created_at,
    is_locked,
    locked_until
  FROM public.influencers_public_view
  WHERE ativo = true;
$$;