-- REVERSÃO da Fase 1 de Decants. NÃO rodar sem autorização escrita e backup.
-- Remove apenas objetos decant_*; nenhuma tabela pré-existente é tocada.
-- Antes: desligue o módulo e confirme que os frascos fechados destinados foram devolvidos ao estoque normal.
BEGIN;
DROP FUNCTION IF EXISTS public.fn_decant_frascos_listar(uuid);
DROP FUNCTION IF EXISTS public.fn_decant_decidir_conferencia(uuid,boolean,text,text);
DROP FUNCTION IF EXISTS public.fn_decant_conferir(uuid,numeric,text,text);
DROP FUNCTION IF EXISTS public.fn_decant_registrar_saida(uuid,text,numeric,text,text);
DROP FUNCTION IF EXISTS public.fn_decant_abrir_frasco(uuid,uuid,text,date,numeric,text,text,text);
DROP FUNCTION IF EXISTS public.fn_decant_destinar(uuid,uuid,integer,text,date,text,text);
DROP FUNCTION IF EXISTS public.fn_decant_saldo_frasco(uuid);
DROP FUNCTION IF EXISTS public.fn__decant_exigir(uuid,text);
DROP FUNCTION IF EXISTS public.fn__decant_cfg();
DROP TABLE IF EXISTS public.decant_conferencias;
DROP TABLE IF EXISTS public.decant_ml_ledger;
DROP TABLE IF EXISTS public.decant_frascos;
DROP TABLE IF EXISTS public.decant_fechados_mov;
DROP TABLE IF EXISTS public.decant_fechados_saldo;
DROP TABLE IF EXISTS public.decant_tamanhos;
DROP TABLE IF EXISTS public.decant_perfume_config;
DROP FUNCTION IF EXISTS public.fn__decant_bloquear_alteracao();
DROP FUNCTION IF EXISTS public.fn_decant_custo_ml(numeric,numeric,numeric);
DROP SEQUENCE IF EXISTS public.decant_frasco_seq;
DELETE FROM public.usuario_unidade_permissoes WHERE permissao LIKE 'decant.%';
DELETE FROM public.role_permissions WHERE permission LIKE 'decant.%';
DELETE FROM public.permissoes_catalogo WHERE chave LIKE 'decant.%';
DELETE FROM public.configuracoes WHERE chave = 'decants';
COMMIT;
