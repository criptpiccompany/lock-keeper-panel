CREATE TABLE public.planilha_beta_observation_styles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  closer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  year integer NOT NULL,
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  day integer NOT NULL CHECK (day BETWEEN 1 AND 31),
  row_index integer NOT NULL CHECK (row_index BETWEEN 0 AND 99),
  background text NOT NULL DEFAULT 'neutral' CHECK (background IN ('neutral', 'green', 'yellow', 'red', 'blue')),
  text text NOT NULL DEFAULT 'default' CHECK (text IN ('default', 'green', 'yellow', 'red', 'blue')),
  bold boolean NOT NULL DEFAULT false,
  italic boolean NOT NULL DEFAULT false,
  checkbox boolean NOT NULL DEFAULT false,
  checked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (closer_id, year, month, day, row_index)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.planilha_beta_observation_styles TO authenticated;
GRANT ALL ON public.planilha_beta_observation_styles TO service_role;

ALTER TABLE public.planilha_beta_observation_styles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see allowed observation styles"
  ON public.planilha_beta_observation_styles FOR SELECT
  TO authenticated
  USING (
    closer_id = auth.uid()
    OR public.has_role(auth.uid(), 'ADMIN'::public.app_role)
    OR public.has_role(auth.uid(), 'FINANCEIRO'::public.app_role)
  );

CREATE POLICY "Closers insert own observation styles"
  ON public.planilha_beta_observation_styles FOR INSERT
  TO authenticated
  WITH CHECK (closer_id = auth.uid());

CREATE POLICY "Users update allowed observation styles"
  ON public.planilha_beta_observation_styles FOR UPDATE
  TO authenticated
  USING (
    closer_id = auth.uid()
    OR public.has_role(auth.uid(), 'ADMIN'::public.app_role)
    OR public.has_role(auth.uid(), 'FINANCEIRO'::public.app_role)
  )
  WITH CHECK (
    closer_id = auth.uid()
    OR public.has_role(auth.uid(), 'ADMIN'::public.app_role)
    OR public.has_role(auth.uid(), 'FINANCEIRO'::public.app_role)
  );

CREATE POLICY "Users delete allowed observation styles"
  ON public.planilha_beta_observation_styles FOR DELETE
  TO authenticated
  USING (
    closer_id = auth.uid()
    OR public.has_role(auth.uid(), 'ADMIN'::public.app_role)
    OR public.has_role(auth.uid(), 'FINANCEIRO'::public.app_role)
  );

CREATE TRIGGER planilha_beta_observation_styles_set_team_id
  BEFORE INSERT ON public.planilha_beta_observation_styles
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_team_id();

CREATE TRIGGER planilha_beta_observation_styles_updated_at
  BEFORE UPDATE ON public.planilha_beta_observation_styles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX planilha_beta_observation_styles_lookup
  ON public.planilha_beta_observation_styles (closer_id, year, month, day, row_index);
