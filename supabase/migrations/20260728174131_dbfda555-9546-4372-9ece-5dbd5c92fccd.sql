CREATE TABLE public.ajuste_auditoria (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  produto_id UUID NOT NULL,
  produto_nome TEXT NOT NULL,
  deposito TEXT NOT NULL,
  quantidade_anterior INTEGER NOT NULL,
  quantidade_nova INTEGER NOT NULL,
  diferenca INTEGER NOT NULL,
  motivo TEXT NOT NULL,
  registrado_por TEXT NOT NULL,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.ajuste_auditoria TO authenticated;
GRANT ALL ON public.ajuste_auditoria TO service_role;

ALTER TABLE public.ajuste_auditoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read ajuste_auditoria"
ON public.ajuste_auditoria FOR SELECT
TO authenticated USING (true);

CREATE POLICY "auth insert ajuste_auditoria"
ON public.ajuste_auditoria FOR INSERT
TO authenticated WITH CHECK (true);

CREATE POLICY "master delete ajuste_auditoria"
ON public.ajuste_auditoria FOR DELETE
TO authenticated USING (public.has_role(auth.uid(), 'master'));

CREATE INDEX idx_ajuste_auditoria_produto ON public.ajuste_auditoria(produto_id);
CREATE INDEX idx_ajuste_auditoria_created ON public.ajuste_auditoria(created_at DESC);