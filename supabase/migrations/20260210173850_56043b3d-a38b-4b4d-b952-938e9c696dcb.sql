
CREATE OR REPLACE FUNCTION public.get_approved_closers()
RETURNS TABLE(id uuid, nome text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Returns all approved profiles for partner selection.
  -- SECURITY DEFINER: bypasses RLS so any authenticated user can see the list.
  SELECT p.id, p.nome
  FROM public.profiles p
  WHERE p.status = 'approved'
    AND auth.uid() IS NOT NULL
  ORDER BY p.nome;
$$;
