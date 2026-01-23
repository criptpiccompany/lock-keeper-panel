-- Create a general audit log table for all admin actions
CREATE TABLE public.audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID NOT NULL,
  user_nome TEXT NOT NULL,
  acao TEXT NOT NULL,
  descricao TEXT NOT NULL,
  detalhes JSONB
);

-- Enable RLS
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view all audit logs"
  ON public.audit_log FOR SELECT
  USING (public.has_role(auth.uid(), 'ADMIN'));

-- Authenticated users can insert (for logging their own actions)
CREATE POLICY "Authenticated users can insert audit logs"
  ON public.audit_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);