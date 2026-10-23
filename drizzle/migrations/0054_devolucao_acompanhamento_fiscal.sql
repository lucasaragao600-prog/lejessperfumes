ALTER TABLE public.devolucoes ADD COLUMN IF NOT EXISTS fiscal_status text NOT NULL DEFAULT 'pendente', ADD COLUMN IF NOT EXISTS fiscal_observacao text, ADD COLUMN IF NOT EXISTS fiscal_chave_entrada text, ADD COLUMN IF NOT EXISTS fiscal_atualizado_por text, ADD COLUMN IF NOT EXISTS fiscal_atualizado_em timestamptz;
COMMENT ON COLUMN public.devolucoes.fiscal_status IS 'Acompanhamento administrativo. documento_informado não significa autorização SEFAZ; emissão NF-e de entrada depende de integração modelo 55 e validação contábil.';
CREATE INDEX IF NOT EXISTS devolucoes_fiscal_status_idx ON public.devolucoes(unidade_id,fiscal_status,created_at DESC);

CREATE OR REPLACE FUNCTION public.fn__nfce_preservar_devolucao() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.status = 'PENDENTE_DEVOLUCAO_FISCAL' AND lower(OLD.status) IN ('autorizada','emitida') THEN
    NEW.status := OLD.status;
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER nfce_preservar_devolucao BEFORE UPDATE OF status ON public.nfce_emissoes FOR EACH ROW EXECUTE FUNCTION public.fn__nfce_preservar_devolucao();

CREATE OR REPLACE FUNCTION public.fn_devolucao_fiscal_detalhe(p_devolucao_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.devolucoes; origem uuid; co text; cd text; notas jsonb; saidas jsonb;
BEGIN
  SELECT * INTO d FROM public.devolucoes WHERE id=p_devolucao_id;
  IF auth.uid() IS NULL OR d.id IS NULL OR NOT public.usuario_tem_acesso_unidade(d.unidade_id) THEN RAISE EXCEPTION 'Sem acesso à devolução'; END IF;
  origem:=d.unidade_origem_id;
  IF origem IS NULL THEN SELECT unidade_id INTO origem FROM public.vendas WHERE grupo_venda=d.grupo_venda_origem ORDER BY created_at LIMIT 1; END IF;
  SELECT cnpj INTO co FROM public.unidades WHERE id=origem;
  SELECT cnpj INTO cd FROM public.unidades WHERE id=d.unidade_id;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'numero',numero_nfce,'serie',serie,'chave',chave_acesso,'status',status,'motivo',motivo_rejeicao) ORDER BY created_at DESC),'[]'::jsonb) INTO notas FROM public.nfce_emissoes WHERE venda_grupo_venda=d.grupo_venda_origem;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'numero',numero_nfce,'serie',serie,'chave',chave_acesso,'status',status,'motivo',motivo_rejeicao) ORDER BY created_at DESC),'[]'::jsonb) INTO saidas FROM public.nfce_emissoes WHERE venda_grupo_venda=d.grupo_venda_troca;
  RETURN jsonb_build_object('status',d.fiscal_status,'observacao',d.fiscal_observacao,'chave_entrada',d.fiscal_chave_entrada,'atualizado_por',d.fiscal_atualizado_por,'atualizado_em',d.fiscal_atualizado_em,'grupo_origem',d.grupo_venda_origem,'grupo_saida',d.grupo_venda_troca,'notas_origem',notas,'notas_saida',saidas,'cnpjs_distintos',CASE WHEN nullif(regexp_replace(co,'\D','','g'),'') IS NULL OR nullif(regexp_replace(cd,'\D','','g'),'') IS NULL THEN NULL ELSE regexp_replace(co,'\D','','g') <> regexp_replace(cd,'\D','','g') END,'pode_tratar',public.fn__pode(d.unidade_id,'fiscal.configurar'));
END $$;
REVOKE ALL ON FUNCTION public.fn_devolucao_fiscal_detalhe(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_devolucao_fiscal_detalhe(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_devolucao_fiscal_tratar(p_devolucao_id uuid,p_status text,p_observacao text,p_chave_entrada text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.devolucoes; chave text; soma int:=0; peso int:=2; i int; dv int; cnpj text;
BEGIN
  SELECT * INTO d FROM public.devolucoes WHERE id=p_devolucao_id FOR UPDATE;
  IF auth.uid() IS NULL OR d.id IS NULL OR NOT public.fn__pode(d.unidade_id,'fiscal.configurar') THEN RAISE EXCEPTION 'Sem permissão para tratar o fiscal nesta unidade'; END IF;
  IF p_status IS NULL OR p_status NOT IN ('pendente','em_analise','rejeitada','documento_informado') THEN RAISE EXCEPTION 'Situação fiscal inválida'; END IF;
  IF p_observacao IS NULL OR length(btrim(p_observacao)) < 15 OR length(p_observacao)>2000 THEN RAISE EXCEPTION 'Informe uma observação de 15 a 2000 caracteres'; END IF;
  chave:=nullif(btrim(p_chave_entrada),'');
  IF p_status='documento_informado' AND chave IS NULL THEN RAISE EXCEPTION 'Informe a chave da NF-e de entrada'; END IF;
  IF chave IS NOT NULL THEN
    IF chave !~ '^[0-9]{44}$' OR substring(chave,21,2)<>'55' THEN RAISE EXCEPTION 'Informe uma chave de NF-e modelo 55 com 44 dígitos'; END IF;
    FOR i IN REVERSE 43..1 LOOP soma:=soma+substring(chave,i,1)::int*peso; peso:=CASE WHEN peso=9 THEN 2 ELSE peso+1 END; END LOOP;
    dv:=11-(soma%11); IF dv>=10 THEN dv:=0; END IF;
    IF dv<>substring(chave,44,1)::int THEN RAISE EXCEPTION 'Dígito verificador da chave inválido'; END IF;
    SELECT regexp_replace(u.cnpj,'\D','','g') INTO cnpj FROM public.unidades u WHERE u.id=d.unidade_id;
    IF cnpj IS NULL OR length(cnpj)<>14 OR substring(chave,7,14)<>cnpj THEN RAISE EXCEPTION 'A chave deve pertencer ao CNPJ da unidade que recebeu a devolução'; END IF;
  END IF;
  UPDATE public.devolucoes SET fiscal_status=p_status,fiscal_observacao=btrim(p_observacao),fiscal_chave_entrada=chave,fiscal_atualizado_por=public.fn__nome_usuario(),fiscal_atualizado_em=now(),updated_at=now() WHERE id=d.id;
  PERFORM public.fn_audit('DEVOLUCAO_FISCAL_TRATADA','devolucoes',d.id,d.unidade_id,jsonb_build_object('status',d.fiscal_status,'chave',d.fiscal_chave_entrada),jsonb_build_object('status',p_status,'chave',chave,'observacao',btrim(p_observacao)));
  RETURN public.fn_devolucao_fiscal_detalhe(d.id);
END $$;
REVOKE ALL ON FUNCTION public.fn_devolucao_fiscal_tratar(uuid,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_devolucao_fiscal_tratar(uuid,text,text,text) TO authenticated;