-- Reversão da Fase 4 de Decants. SÓ rodar com autorização escrita e backup confirmado.
-- Remove apenas o registro de perdas e as funções de leitura; ledgers, frascos, lotes e vendas não são tocados.
BEGIN;
DROP FUNCTION IF EXISTS public.fn_decant_relatorio(text,uuid,date,date), public.fn_decant_perfume_360(uuid,uuid),
  public.fn_decant_rentabilidade(text,uuid,date,date), public.fn_decant_dashboard(uuid,date,date), public.fn_decant_perdas_painel(uuid,date,date),
  public.fn_decant_registrar_perda(uuid,text,numeric,text,text), public.fn__decant_vendas_liq(uuid,date,date), public.fn__decant_rotulo(uuid);
DROP TRIGGER IF EXISTS trg_decant_perda_ml ON public.decant_ml_ledger;
DROP TRIGGER IF EXISTS trg_decant_perda_lote ON public.decant_lotes;
DROP TRIGGER IF EXISTS trg_decant_perda_un ON public.decant_un_ledger;
DROP FUNCTION IF EXISTS public.fn__decant_perda_ml(), public.fn__decant_perda_lote_trg(), public.fn__decant_perda_lote(uuid), public.fn__decant_perda_un(),
  public.fn__decant_perda_tipo_ml(text,text), public.fn__decant_exigir_leitura(text), public.fn__decant_ver_custos(), public.fn__decant_ver_margem();
DROP TABLE IF EXISTS public.decant_perdas;
DROP FUNCTION IF EXISTS public.fn__decant_dia(timestamptz);
COMMIT;
