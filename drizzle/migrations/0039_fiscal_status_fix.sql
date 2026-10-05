CREATE OR REPLACE FUNCTION public.fn_fiscal_status(r jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE erros text[] := '{}'; faltam text[] := '{}';
BEGIN
  IF NOT coalesce((r->>'emite_nota')::boolean, true) THEN RETURN jsonb_build_object('status','nao_emite','erros','[]'::jsonb,'faltam','[]'::jsonb); END IF;
  IF r->>'ncm' IS NULL THEN faltam := array_append(faltam, 'ncm'); ELSIF r->>'ncm' !~ '^\d{8}$' THEN erros := array_append(erros, 'NCM deve ter 8 dígitos'); END IF;
  IF r->>'cfop' IS NULL THEN faltam := array_append(faltam, 'cfop'); ELSIF r->>'cfop' !~ '^[5]\d{3}$' THEN erros := array_append(erros, 'CFOP de venda interna deve começar com 5'); END IF;
  IF r->>'csosn' IS NULL AND r->>'cst_icms' IS NULL THEN faltam := array_append(faltam, 'csosn');
  ELSIF r->>'csosn' IS NOT NULL AND r->>'csosn' NOT IN ('101','102','103','300','400','500','900') THEN erros := array_append(erros, 'CSOSN inválido'); END IF;
  IF r->>'csosn' = '500' AND r->>'cfop' IS NOT NULL AND r->>'cfop' NOT IN ('5405','5656','5667') THEN erros := array_append(erros, 'CSOSN 500 exige CFOP de ST (5405)'); END IF;
  IF r->>'csosn' IN ('101','102','103','300','400') AND r->>'cfop' IN ('5405','5656','5667') THEN erros := array_append(erros, 'CFOP de ST exige CSOSN 500'); END IF;
  IF r->>'origem' IS NOT NULL AND r->>'origem' !~ '^[0-8]$' THEN erros := array_append(erros, 'Origem deve ser de 0 a 8'); END IF;
  IF r->>'cest' IS NOT NULL AND r->>'cest' !~ '^\d{7}$' THEN erros := array_append(erros, 'CEST deve ter 7 dígitos'); END IF;
  RETURN jsonb_build_object('status', CASE WHEN cardinality(erros) > 0 THEN 'erro' WHEN cardinality(faltam) > 0 THEN 'incompleto' ELSE 'completo' END,
    'erros', to_jsonb(erros), 'faltam', to_jsonb(faltam));
END $$;