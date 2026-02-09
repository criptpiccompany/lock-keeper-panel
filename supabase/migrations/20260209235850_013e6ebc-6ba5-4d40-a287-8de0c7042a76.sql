
-- Update get_public_influencers to exclude soft-deleted
CREATE OR REPLACE FUNCTION public.get_public_influencers()
 RETURNS TABLE(id uuid, handle text, last_closed_at timestamp with time zone, ativo boolean, created_at timestamp with time zone, is_locked boolean, locked_until timestamp with time zone, owner_nome text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
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
    END as locked_until,
    i.owner_nome
  FROM public.influencers i
  WHERE i.ativo = true
    AND i.deleted_at IS NULL
    AND auth.uid() IS NOT NULL;
$$;
