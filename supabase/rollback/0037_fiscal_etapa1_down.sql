-- Rollback da Etapa 1 fiscal (executar só com autorização escrita; apaga perfis e histórico fiscal).
DROP FUNCTION IF EXISTS public.fn_produto_fiscal_salvar(uuid,jsonb);
DROP FUNCTION IF EXISTS public.fn_perfil_aplicar(uuid,uuid[],text,text,boolean);
DROP FUNCTION IF EXISTS public.fn_perfil_tributario_salvar(uuid,jsonb);
DROP FUNCTION IF EXISTS public.fn__fiscal_pode();
DROP FUNCTION IF EXISTS public.fn_produtos_fiscal_listar(text,text,uuid,text,int,int);
DROP FUNCTION IF EXISTS public.fn_fiscal_status(jsonb);
DROP FUNCTION IF EXISTS public.fn_produto_fiscal_resolver(uuid);
DROP TABLE IF EXISTS public.nfce_tentativas;
DROP TABLE IF EXISTS public.historico_fiscal;
DROP TABLE IF EXISTS public.produto_fiscal;
DROP TABLE IF EXISTS public.perfil_tributario;
DELETE FROM public.permissoes_catalogo WHERE chave = 'fiscal.configurar';
