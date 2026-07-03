
-- 1) Afiliados
CREATE TABLE public.megaarena_afiliados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text UNIQUE NOT NULL,
  handle text NOT NULL,
  email text,
  closer_name text,
  cadastro_at timestamptz,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.megaarena_afiliados TO authenticated;
GRANT ALL ON public.megaarena_afiliados TO service_role;
ALTER TABLE public.megaarena_afiliados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view megaarena affiliates"
  ON public.megaarena_afiliados FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'ADMIN'::app_role));

-- 2) Snapshots (série temporal)
CREATE TABLE public.megaarena_snapshots (
  id bigserial PRIMARY KEY,
  afiliado_external_id text NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  depositado_hoje_cents bigint NOT NULL DEFAULT 0,
  comissao_hoje_cents bigint NOT NULL DEFAULT 0,
  sacado_cents bigint NOT NULL DEFAULT 0,
  indicados int NOT NULL DEFAULT 0,
  ativos int NOT NULL DEFAULT 0,
  status text
);
CREATE INDEX idx_megaarena_snapshots_afiliado_time
  ON public.megaarena_snapshots (afiliado_external_id, captured_at DESC);
CREATE INDEX idx_megaarena_snapshots_captured_at
  ON public.megaarena_snapshots (captured_at DESC);
GRANT SELECT ON public.megaarena_snapshots TO authenticated;
GRANT ALL ON public.megaarena_snapshots TO service_role;
ALTER TABLE public.megaarena_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view megaarena snapshots"
  ON public.megaarena_snapshots FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'ADMIN'::app_role));

-- 3) Janela 09h→09h consolidada
CREATE TABLE public.megaarena_janela_9h (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  afiliado_external_id text NOT NULL,
  janela_date date NOT NULL,
  depositado_janela_cents bigint NOT NULL DEFAULT 0,
  comissao_janela_cents bigint NOT NULL DEFAULT 0,
  handle_snapshot text,
  closer_snapshot text,
  computed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (afiliado_external_id, janela_date)
);
CREATE INDEX idx_megaarena_janela_date ON public.megaarena_janela_9h (janela_date DESC);
GRANT SELECT ON public.megaarena_janela_9h TO authenticated;
GRANT ALL ON public.megaarena_janela_9h TO service_role;
ALTER TABLE public.megaarena_janela_9h ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view megaarena janela"
  ON public.megaarena_janela_9h FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'ADMIN'::app_role));

-- 4) Meta do sync
CREATE TABLE public.megaarena_sync_meta (
  id int PRIMARY KEY DEFAULT 1,
  last_run_at timestamptz,
  last_status text,
  last_error text,
  last_count int,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);
GRANT SELECT ON public.megaarena_sync_meta TO authenticated;
GRANT ALL ON public.megaarena_sync_meta TO service_role;
ALTER TABLE public.megaarena_sync_meta ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view megaarena meta"
  ON public.megaarena_sync_meta FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'ADMIN'::app_role));

-- Trigger updated_at
CREATE TRIGGER megaarena_afiliados_updated_at
  BEFORE UPDATE ON public.megaarena_afiliados
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER megaarena_sync_meta_updated_at
  BEFORE UPDATE ON public.megaarena_sync_meta
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
