
-- Add fiscal fields to perfumes
ALTER TABLE public.perfumes 
ADD COLUMN IF NOT EXISTS ncm text NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS cfop text NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS cst_csosn text NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS unidade_fiscal text NOT NULL DEFAULT 'UN';

-- Create nfce_emissoes table for tracking fiscal documents
CREATE TABLE public.nfce_emissoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_grupo_venda uuid NOT NULL,
  numero_nfce integer,
  serie integer DEFAULT 1,
  chave_acesso text DEFAULT '',
  protocolo_autorizacao text DEFAULT '',
  xml_url text DEFAULT '',
  danfe_url text DEFAULT '',
  status text NOT NULL DEFAULT 'pendente',
  motivo_rejeicao text DEFAULT '',
  data_emissao timestamp with time zone DEFAULT now(),
  data_cancelamento timestamp with time zone,
  motivo_cancelamento text DEFAULT '',
  contingencia boolean DEFAULT false,
  xml_contingencia text DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.nfce_emissoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read nfce_emissoes" ON public.nfce_emissoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert nfce_emissoes" ON public.nfce_emissoes FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Masters can manage nfce_emissoes" ON public.nfce_emissoes FOR ALL TO authenticated USING (has_role(auth.uid(), 'master'::app_role)) WITH CHECK (has_role(auth.uid(), 'master'::app_role));

-- Create configuracoes_fiscais table for store fiscal data (CNPJ, IE, address, certificate etc)
CREATE TABLE public.configuracoes_fiscais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj text NOT NULL DEFAULT '',
  inscricao_estadual text NOT NULL DEFAULT '',
  razao_social text NOT NULL DEFAULT '',
  nome_fantasia text NOT NULL DEFAULT '',
  endereco text NOT NULL DEFAULT '',
  numero text NOT NULL DEFAULT '',
  bairro text NOT NULL DEFAULT '',
  cidade text NOT NULL DEFAULT '',
  uf text NOT NULL DEFAULT '',
  cep text NOT NULL DEFAULT '',
  telefone text NOT NULL DEFAULT '',
  regime_tributario text NOT NULL DEFAULT 'simples_nacional',
  ambiente text NOT NULL DEFAULT 'homologacao',
  serie_nfce integer NOT NULL DEFAULT 1,
  proximo_numero_nfce integer NOT NULL DEFAULT 1,
  csc_id text NOT NULL DEFAULT '',
  csc_token text NOT NULL DEFAULT '',
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.configuracoes_fiscais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read configuracoes_fiscais" ON public.configuracoes_fiscais FOR SELECT TO authenticated USING (true);
CREATE POLICY "Masters can manage configuracoes_fiscais" ON public.configuracoes_fiscais FOR ALL TO authenticated USING (has_role(auth.uid(), 'master'::app_role)) WITH CHECK (has_role(auth.uid(), 'master'::app_role));

-- Storage bucket for fiscal XMLs
INSERT INTO storage.buckets (id, name, public) VALUES ('fiscal-xml', 'fiscal-xml', false);

CREATE POLICY "Authenticated can read fiscal-xml" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'fiscal-xml');
CREATE POLICY "Authenticated can insert fiscal-xml" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'fiscal-xml');
CREATE POLICY "Masters can manage fiscal-xml" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'fiscal-xml' AND has_role(auth.uid(), 'master'::app_role));
