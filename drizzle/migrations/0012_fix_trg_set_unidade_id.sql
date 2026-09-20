CREATE OR REPLACE FUNCTION public.trg_set_unidade_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_txt TEXT;
  v_unidade public.unidades;
BEGIN
  IF NEW.unidade_id IS NULL THEN
    IF TG_TABLE_NAME = 'vendas' THEN
      v_txt := NEW.deposito;
    ELSIF TG_TABLE_NAME = 'testers' THEN
      v_txt := NEW.deposito;
    ELSIF TG_TABLE_NAME = 'caixa_sessoes' THEN
      v_txt := NEW.loja;
    ELSIF TG_TABLE_NAME = 'movimentacoes' THEN
      v_txt := COALESCE(NEW.deposito, NEW.deposito_destino, NEW.deposito_origem);
    END IF;

    IF v_txt IS NOT NULL THEN
      v_unidade := public.fn_unidade_por_texto(v_txt);
      IF v_unidade.id IS NOT NULL THEN
        NEW.unidade_id := v_unidade.id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;