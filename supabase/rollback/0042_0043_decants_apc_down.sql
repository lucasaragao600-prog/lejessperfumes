-- Reverte divisão de frasco Decants + APC (executar só com autorização; dados de APC seriam perdidos)
DROP FUNCTION IF EXISTS public.fn_decant_apc_listar(uuid);
DROP FUNCTION IF EXISTS public.fn_decant_apc_status(uuid,text,text);
DROP FUNCTION IF EXISTS public.fn_decant_dividir_frasco(uuid,numeric,numeric,numeric,numeric,numeric,numeric,text,boolean,boolean,text,text);
-- fn_decant_frascos_listar e fn__decant_perda_ml: restaurar versões anteriores (campos extras são inofensivos).
-- Tabelas decant_apc/decant_apc_eventos e colunas ml_decants/dividido_em ficam (proibido DROP sem autorização).
-- Etapa 2 (0044)
DROP FUNCTION IF EXISTS public.fn_decant_apc_venda_cancelar(uuid,text);
DROP FUNCTION IF EXISTS public.fn_decant_vender_apc(uuid,jsonb,text,uuid,text,text);
DROP FUNCTION IF EXISTS public.fn_decant_vender_frasco(uuid,jsonb,jsonb,text,uuid,text,text);
-- decant_apc_vendas e colunas frasco_id/ml_consumido ficam (proibido DROP sem autorização).
