
CREATE TABLE public.planilha_beta (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  closer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  year int NOT NULL,
  month int NOT NULL CHECK (month BETWEEN 1 AND 12),
  day int NOT NULL CHECK (day BETWEEN 1 AND 31),
  row_index int NOT NULL DEFAULT 0,
  influenciador text,
  diaria_cents bigint NOT NULL DEFAULT 0,
  faturamento_cents bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (closer_id, year, month, day, row_index)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.planilha_beta TO authenticated;
GRANT ALL ON public.planilha_beta TO service_role;

ALTER TABLE public.planilha_beta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Closer sees own rows"
  ON public.planilha_beta FOR SELECT
  TO authenticated
  USING (
    closer_id = auth.uid()
    OR public.is_global_viewer(auth.uid())
  );

CREATE POLICY "Closer inserts own rows"
  ON public.planilha_beta FOR INSERT
  TO authenticated
  WITH CHECK (closer_id = auth.uid());

CREATE POLICY "Closer updates own rows"
  ON public.planilha_beta FOR UPDATE
  TO authenticated
  USING (closer_id = auth.uid() OR public.is_global_viewer(auth.uid()))
  WITH CHECK (closer_id = auth.uid() OR public.is_global_viewer(auth.uid()));

CREATE POLICY "Closer deletes own rows"
  ON public.planilha_beta FOR DELETE
  TO authenticated
  USING (closer_id = auth.uid() OR public.is_global_viewer(auth.uid()));

CREATE TRIGGER planilha_beta_set_team_id
  BEFORE INSERT ON public.planilha_beta
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_team_id();

CREATE TRIGGER planilha_beta_updated_at
  BEFORE UPDATE ON public.planilha_beta
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX planilha_beta_lookup ON public.planilha_beta (closer_id, year, month, day, row_index);
