-- Rollback da Etapa 1 das Notas de Transferência (rodar só com autorização escrita; remove NTs emitidas).
DROP FUNCTION IF EXISTS public.fn_nt_scan_publico(text);
DROP FUNCTION IF EXISTS public.fn_nt_reimprimir(uuid);
DROP FUNCTION IF EXISTS public.fn_nt_detalhe(uuid);
DROP FUNCTION IF EXISTS public.fn_nt_listar(text,uuid,text,integer,integer);
DROP FUNCTION IF EXISTS public.fn__nt_cancelar(text,uuid,text);
DROP FUNCTION IF EXISTS public.fn__nt_receber(text,uuid,jsonb);
DROP FUNCTION IF EXISTS public.fn__nt_emitir(text,uuid,text,uuid,uuid,jsonb,text,integer,uuid,text,text);
DROP FUNCTION IF EXISTS public.fn__nt_snapshot(uuid);
DROP FUNCTION IF EXISTS public.fn__nt_proximo_numero();
DROP TABLE IF EXISTS public.notas_transferencia_custos;
DROP TABLE IF EXISTS public.notas_transferencia_itens;
DROP TABLE IF EXISTS public.notas_transferencia;
DROP FUNCTION IF EXISTS public.fn__nt_bloquear();
DROP FUNCTION IF EXISTS public.fn__nt_cfg();
DROP TABLE IF EXISTS public.nt_sequencias;
DELETE FROM public.permissoes_catalogo WHERE chave LIKE 'nt.%';
DELETE FROM public.configuracoes WHERE chave = 'notas_transferencia';
