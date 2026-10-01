-- Reversão da Fase 2 de Decants. SÓ rodar com autorização escrita e backup confirmado.
-- Remove apenas objetos criados na 0023; restaura fn_decant_registrar_saida da 0022 (rodar o trecho dela depois).
BEGIN;
ALTER TABLE public.decant_lote_eventos DISABLE TRIGGER trg_decant_le_imutavel;
ALTER TABLE public.decant_lotes DISABLE TRIGGER trg_decant_lote_sem_delete;
ALTER TABLE public.decant_lote_itens DISABLE TRIGGER trg_decant_li_sem_delete;
ALTER TABLE public.decant_lote_frascos DISABLE TRIGGER trg_decant_lf_sem_delete;
DROP FUNCTION IF EXISTS public.fn_decant_frascos_disponiveis(uuid,uuid);
DROP FUNCTION IF EXISTS public.fn_decant_lotes_listar(uuid,text,integer,integer);
DROP FUNCTION IF EXISTS public.fn_decant_lote_editar(uuid,text,text,text);
DROP FUNCTION IF EXISTS public.fn_decant_lote_cancelar(uuid,text);
DROP FUNCTION IF EXISTS public.fn_decant_lote_finalizar(uuid,jsonb);
DROP FUNCTION IF EXISTS public.fn_decant_lote_conferir(uuid,jsonb,text);
DROP FUNCTION IF EXISTS public.fn_decant_lote_iniciar(uuid);
DROP FUNCTION IF EXISTS public.fn_decant_lote_criar(uuid,uuid,jsonb,jsonb,text,text,text);
DROP FUNCTION IF EXISTS public.fn_decant_fichas_listar(uuid);
DROP FUNCTION IF EXISTS public.fn_decant_sku_salvar(uuid,uuid,text,numeric,boolean);
DROP TABLE IF EXISTS public.decant_lote_eventos, public.decant_lote_frascos, public.decant_lote_itens, public.decant_lotes, public.decant_skus;
DROP FUNCTION IF EXISTS public.fn__decant_lote_evento(uuid,text,jsonb);
DROP FUNCTION IF EXISTS public.fn_decant_disponivel_frasco(uuid);
DROP FUNCTION IF EXISTS public.fn_decant_reservado_frasco(uuid,uuid);
DROP FUNCTION IF EXISTS public.fn__decant_bloquear_exclusao();
DROP FUNCTION IF EXISTS public.fn_decant_sku_codigo(text,numeric);
DROP SEQUENCE IF EXISTS public.decant_lote_seq;
-- Antes do COMMIT: recriar fn_decant_registrar_saida copiando o bloco da migração 0022 (versão sem reservas).
-- fn__fmt_ml é mantida (inofensiva) porque a versão atual de fn_decant_registrar_saida depende dela até ser recriada.
COMMIT;
