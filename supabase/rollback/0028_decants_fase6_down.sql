-- Reverte Fase 6 Decants
DROP FUNCTION IF EXISTS public.fn_decant_scan(text);
DROP FUNCTION IF EXISTS public.fn_decant_scan_publico(text);
DROP FUNCTION IF EXISTS public.fn_decant_etiquetas_imprimir(uuid,jsonb,uuid);
DROP TABLE IF EXISTS public.decant_etiqueta_modelos;
