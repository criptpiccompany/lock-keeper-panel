-- Drop the existing restrictive policy for Closers
DROP POLICY IF EXISTS "Closers can view their own influencers" ON public.influencers;

-- Create a new policy that allows all authenticated users to view all influencers
CREATE POLICY "Authenticated users can view all influencers" 
ON public.influencers 
FOR SELECT 
USING (auth.uid() IS NOT NULL);