ALTER TABLE public.planilha_beta
  ADD COLUMN IF NOT EXISTS comprovante_url text,
  ADD COLUMN IF NOT EXISTS observacao text;

COMMENT ON COLUMN public.planilha_beta.comprovante_url IS
  'URL do comprovante anexado à linha do Planilhamento Diário.';

COMMENT ON COLUMN public.planilha_beta.observacao IS
  'Observação livre da linha do Planilhamento Diário.';
