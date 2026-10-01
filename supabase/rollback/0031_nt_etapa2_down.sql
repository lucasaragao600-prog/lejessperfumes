-- Rollback Etapa 2 NT: remove gatilhos e RPCs novas. fn_transferir deve voltar à versão anterior (copiar de drizzle/migrations anteriores, sem o bloco "lejess.nt_suprimir").
DROP TRIGGER IF EXISTS trg_nt_transferencia ON public.transferencias;
DROP TRIGGER IF EXISTS trg_nt_decant ON public.decant_transferencias;
DROP FUNCTION IF EXISTS public.fn__nt_trg_transferencia();
DROP FUNCTION IF EXISTS public.fn__nt_trg_decant();
DROP FUNCTION IF EXISTS public.fn__nt_decant_itens(uuid, boolean);
DROP FUNCTION IF EXISTS public.fn_transferencia_manual(uuid,uuid,jsonb,text,text);
DROP FUNCTION IF EXISTS public.fn_reposicao_enviar(uuid,jsonb);
DROP FUNCTION IF EXISTS public.fn_reposicao_finalizar(uuid);
DROP FUNCTION IF EXISTS public.fn_reposicao_cancelar(uuid,text);
DROP FUNCTION IF EXISTS public.fn__reposicao_unidades(public.reposicoes);
-- Atenção: depois do rollback, o app volta a precisar da versão antiga de useReposicao.ts.
