-- Reversão da Fase 3 de Decants. SÓ rodar com autorização escrita e backup confirmado.
-- Atenção: apaga estoque e vendas de decants. Movimentos 'venda_decant'/'estorno_decant' em caixa_movimentacoes permanecem (histórico do caixa).
BEGIN;
DROP TRIGGER IF EXISTS trg_decant_lote_concluido ON public.decant_lotes;
DROP FUNCTION IF EXISTS public.fn__decant_lote_concluido();
DROP FUNCTION IF EXISTS public.fn_decant_transf_listar(uuid), public.fn_decant_pdv_catalogo(uuid), public.fn_decant_vendas_listar(jsonb,integer,integer),
  public.fn_decant_movimentacoes_listar(jsonb,integer,integer), public.fn_decant_estoque_listar(uuid), public.fn_decant_transf_cancelar(uuid,text),
  public.fn_decant_transf_resolver(uuid,text,text), public.fn_decant_transf_receber(uuid,jsonb), public.fn_decant_transf_enviar(uuid,text),
  public.fn_decant_transf_separar(uuid), public.fn_decant_transf_criar(uuid,uuid,jsonb,text,text), public.fn_decant_sku_unidade_salvar(uuid,uuid,integer,integer),
  public.fn_decant_inventario_decidir(uuid,boolean), public.fn_decant_inventario_contar(uuid,uuid,integer,text),
  public.fn_decant_quarentena_decidir(uuid,text,boolean,text), public.fn_decant_devolver(uuid,integer,text,boolean),
  public.fn_decant_venda_cancelar(uuid,text), public.fn_decant_vender(uuid,jsonb,jsonb,text,uuid,text,text),
  public.fn__decant_un_mov(uuid,uuid,uuid,text,integer,numeric,numeric,text,text,uuid,text,uuid,uuid), public.fn_decant_saldo_sku(uuid,uuid);
DROP TABLE IF EXISTS public.decant_transf_itens, public.decant_transferencias, public.decant_inventarios, public.decant_quarentena,
  public.decant_venda_pagamentos, public.decant_vendas, public.decant_un_ledger, public.decant_sku_unidade, public.decant_estoque;
DROP SEQUENCE IF EXISTS public.decant_transf_seq;
DELETE FROM public.usuario_unidade_permissoes WHERE permissao = 'decant.vender';
DELETE FROM public.role_permissions WHERE permissao = 'decant.vender';
DELETE FROM public.permissoes_catalogo WHERE chave = 'decant.vender';
COMMIT;
