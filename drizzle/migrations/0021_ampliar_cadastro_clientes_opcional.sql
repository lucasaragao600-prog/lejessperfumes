ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS nome_social text;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS genero text;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS whatsapp text;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS cep text;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS logradouro text;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS numero text;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS complemento text;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS bairro text;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS cidade text;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS uf text;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS observacoes text;

ALTER TABLE public.clientes DROP CONSTRAINT IF EXISTS clientes_nome_social_tamanho;
ALTER TABLE public.clientes ADD CONSTRAINT clientes_nome_social_tamanho CHECK (char_length(nome_social) <= 120);
ALTER TABLE public.clientes DROP CONSTRAINT IF EXISTS clientes_genero_tamanho;
ALTER TABLE public.clientes ADD CONSTRAINT clientes_genero_tamanho CHECK (char_length(genero) <= 40);
ALTER TABLE public.clientes DROP CONSTRAINT IF EXISTS clientes_whatsapp_tamanho;
ALTER TABLE public.clientes ADD CONSTRAINT clientes_whatsapp_tamanho CHECK (char_length(whatsapp) <= 30);
ALTER TABLE public.clientes DROP CONSTRAINT IF EXISTS clientes_endereco_tamanho;
ALTER TABLE public.clientes ADD CONSTRAINT clientes_endereco_tamanho CHECK (
  char_length(cep) <= 10 AND char_length(logradouro) <= 160 AND char_length(numero) <= 20
  AND char_length(complemento) <= 80 AND char_length(bairro) <= 80
  AND char_length(cidade) <= 80 AND char_length(uf) <= 2
);
ALTER TABLE public.clientes DROP CONSTRAINT IF EXISTS clientes_observacoes_tamanho;
ALTER TABLE public.clientes ADD CONSTRAINT clientes_observacoes_tamanho CHECK (char_length(observacoes) <= 1000);