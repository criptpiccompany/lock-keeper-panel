
-- 1) Create teams table
CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view teams"
  ON public.teams FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage teams"
  ON public.teams FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'ADMIN'::app_role));

-- 2) Insert two teams
INSERT INTO public.teams (name) VALUES ('Ciphera (Principal)'), ('Franquia Braz');

-- 3) Add team_id column to profiles
ALTER TABLE public.profiles
  ADD COLUMN team_id uuid REFERENCES public.teams(id);

-- 4) Assign all existing users to "Ciphera (Principal)"
UPDATE public.profiles
SET team_id = (SELECT id FROM public.teams WHERE name = 'Ciphera (Principal)');
