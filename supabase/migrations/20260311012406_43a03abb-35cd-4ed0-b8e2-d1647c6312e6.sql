ALTER TABLE public.configuracoes_fiscais 
ADD COLUMN IF NOT EXISTS complemento text NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS logo_url text NOT NULL DEFAULT '';