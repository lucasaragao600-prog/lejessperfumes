-- Testes transacionais: não emitem documentos nem persistem alterações.
BEGIN;
DO $$
DECLARE
  master_id uuid; vv record; r jsonb; fiscal jsonb; nota_id uuid; erro text;
  base text; chave text; cnpj text; soma int:=0; peso int:=2; dv int; i int;
BEGIN
  SELECT user_id INTO master_id FROM public.user_roles WHERE role='master' LIMIT 1;
  IF master_id IS NULL THEN RAISE EXCEPTION 'Teste exige master'; END IF;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',master_id,'role','authenticated')::text,true);
  SELECT v.id,v.grupo_venda,v.unidade_id INTO vv FROM public.vendas v
    JOIN public.unidades u ON u.id=v.unidade_id
    WHERE NOT v.cancelada AND NOT v.is_teste AND v.quantidade>=1 AND u.status='OPERACIONAL'
      AND NOT EXISTS(SELECT 1 FROM public.devolucao_itens di WHERE di.venda_id=v.id)
      AND NOT EXISTS(SELECT 1 FROM public.nfce_emissoes n WHERE n.venda_grupo_venda=v.grupo_venda)
    ORDER BY v.created_at DESC LIMIT 1;
  IF vv.id IS NULL THEN RAISE EXCEPTION 'Teste exige venda elegível'; END IF;
  -- Documento simulado apenas dentro desta transação. Nenhuma chamada SEFAZ.
  INSERT INTO public.nfce_emissoes(venda_grupo_venda,unidade_id,status,numero_nfce,serie)
    VALUES(vv.grupo_venda,vv.unidade_id,'emitida',999999,1) RETURNING id INTO nota_id;
  r:=public.fn_devolucao_registrar(vv.grupo_venda,
    jsonb_build_array(jsonb_build_object('venda_id',vv.id,'quantidade',1,'destino','avaria','condicao','avariado')),
    'Teste fiscal transacional sem emissão','pix');
  IF (SELECT status FROM public.nfce_emissoes WHERE id=nota_id)<>'emitida' THEN RAISE EXCEPTION 'FALHOU: NFC-e original alterada'; END IF;
  fiscal:=public.fn_devolucao_fiscal_detalhe((r->>'id')::uuid);
  IF fiscal->>'status'<>'pendente' OR jsonb_array_length(fiscal->'notas_origem')<>1 THEN RAISE EXCEPTION 'FALHOU: pendência/vínculo original'; END IF;
  fiscal:=public.fn_devolucao_fiscal_tratar((r->>'id')::uuid,'rejeitada','Rejeição relatada pela contabilidade');
  IF fiscal->>'status'<>'rejeitada' THEN RAISE EXCEPTION 'FALHOU: rejeição não registrada'; END IF;
  BEGIN
    PERFORM public.fn_devolucao_fiscal_tratar((r->>'id')::uuid,'autorizada','Tentativa de autorização manual');
    RAISE EXCEPTION 'FALHOU: autorização manual permitida';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS erro=MESSAGE_TEXT;
    IF erro NOT LIKE '%Situação fiscal inválida%' THEN RAISE; END IF;
  END;
  SELECT regexp_replace(cnpj,'\D','','g') INTO cnpj FROM public.unidades WHERE id=vv.unidade_id;
  IF length(cnpj)<>14 THEN RAISE EXCEPTION 'Teste exige CNPJ da unidade'; END IF;
  base:='132610'||cnpj||'55001000000123110000001';
  FOR i IN REVERSE 43..1 LOOP soma:=soma+substring(base,i,1)::int*peso; peso:=CASE WHEN peso=9 THEN 2 ELSE peso+1 END; END LOOP;
  dv:=11-soma%11; IF dv>=10 THEN dv:=0; END IF;
  chave:=base||dv::text;
  fiscal:=public.fn_devolucao_fiscal_tratar((r->>'id')::uuid,'documento_informado','Documento informado pela contabilidade',chave);
  IF fiscal->>'chave_entrada'<>chave OR fiscal->>'status'<>'documento_informado' THEN RAISE EXCEPTION 'FALHOU: chave não vinculada'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.audit_logs WHERE entidade_id=(r->>'id')::uuid AND acao='DEVOLUCAO_FISCAL_TRATADA') THEN RAISE EXCEPTION 'FALHOU: falta auditoria'; END IF;
  PERFORM set_config('request.jwt.claims','{}',true);
  BEGIN
    PERFORM public.fn_devolucao_fiscal_detalhe((r->>'id')::uuid);
    RAISE EXCEPTION 'FALHOU: leitura anônima permitida';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS erro=MESSAGE_TEXT;
    IF erro NOT LIKE '%Sem acesso%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'PASS: NFC-e preservada, vínculo, pendência, rejeição, chave modelo 55, auditoria e acesso';
END $$;
ROLLBACK;