-- Evolui o fechamento da MegaArena para a janela operacional 12h BRT -> 12h BRT.
ALTER TABLE public.megaarena_janela_9h
  ADD COLUMN IF NOT EXISTS window_start timestamptz,
  ADD COLUMN IF NOT EXISTS window_end timestamptz,
  ADD COLUMN IF NOT EXISTS indicados_inicio integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS indicados_fim integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS indicados_delta integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ativos_inicio integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ativos_fim integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ativos_delta integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS email_snapshot text,
  ADD COLUMN IF NOT EXISTS cadastro_snapshot timestamptz;

CREATE INDEX IF NOT EXISTS idx_megaarena_janela_window_start
  ON public.megaarena_janela_9h (window_start DESC);

GRANT SELECT ON public.megaarena_janela_9h TO authenticated;
GRANT ALL ON public.megaarena_janela_9h TO service_role;

CREATE POLICY "Closers can view megaarena window history"
  ON public.megaarena_janela_9h FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'CLOSER'::public.app_role));

COMMENT ON TABLE public.megaarena_janela_9h IS
  'Historico consolidado das janelas operacionais MegaArena, atualmente 12h BRT ate 12h BRT do dia seguinte.';
