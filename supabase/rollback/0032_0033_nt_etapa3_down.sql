DROP FUNCTION IF EXISTS public.fn_nt_registrar_impressao(uuid,text,text);
DROP FUNCTION IF EXISTS public.fn_nt_detalhe_por_codigo(text);
-- fn_nt_detalhe: reaplicar a versão de 0030 (sem transportador/observacao); o app continua funcionando sem esses campos.
