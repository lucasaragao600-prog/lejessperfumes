import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface NfceEmissao {
  id: string;
  vendaGrupoVenda: string;
  numeroNfce: number | null;
  serie: number;
  chaveAcesso: string;
  protocoloAutorizacao: string;
  xmlUrl: string;
  danfeUrl: string;
  status: "pendente" | "emitida" | "rejeitada" | "cancelada";
  motivoRejeicao: string;
  dataEmissao: string;
  dataCancelamento: string | null;
  motivoCancelamento: string;
  contingencia: boolean;
  xmlContingencia: string;
}

export interface ConfiguracaoFiscal {
  id: string;
  cnpj: string;
  inscricaoEstadual: string;
  razaoSocial: string;
  nomeFantasia: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  telefone: string;
  regimeTributario: string;
  ambiente: "homologacao" | "producao";
  serieNfce: number;
  proximoNumeroNfce: number;
  cscId: string;
  cscToken: string;
  logoUrl: string;
}

function rowToNfce(row: any): NfceEmissao {
  return {
    id: row.id,
    vendaGrupoVenda: row.venda_grupo_venda,
    numeroNfce: row.numero_nfce,
    serie: row.serie,
    chaveAcesso: row.chave_acesso,
    protocoloAutorizacao: row.protocolo_autorizacao,
    xmlUrl: row.xml_url,
    danfeUrl: row.danfe_url,
    status: row.status,
    motivoRejeicao: row.motivo_rejeicao,
    dataEmissao: row.data_emissao,
    dataCancelamento: row.data_cancelamento,
    motivoCancelamento: row.motivo_cancelamento,
    contingencia: row.contingencia,
    xmlContingencia: row.xml_contingencia,
  };
}

function rowToConfig(row: any): ConfiguracaoFiscal {
  return {
    id: row.id,
    cnpj: row.cnpj,
    inscricaoEstadual: row.inscricao_estadual,
    razaoSocial: row.razao_social,
    nomeFantasia: row.nome_fantasia,
    endereco: row.endereco,
    numero: row.numero,
    complemento: row.complemento || "",
    bairro: row.bairro,
    cidade: row.cidade,
    uf: row.uf,
    cep: row.cep,
    telefone: row.telefone,
    regimeTributario: row.regime_tributario,
    ambiente: row.ambiente,
    serieNfce: row.serie_nfce,
    proximoNumeroNfce: row.proximo_numero_nfce,
    cscId: row.csc_id,
    cscToken: row.csc_token,
    logoUrl: row.logo_url || "",
  };
}

export function useNfce() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["nfce_emissoes"] });

  const { data: emissoes = [], isLoading } = useQuery({
    queryKey: ["nfce_emissoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nfce_emissoes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map(rowToNfce);
    },
  });

  const { data: configFiscal } = useQuery({
    queryKey: ["configuracoes_fiscais"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("configuracoes_fiscais")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data ? rowToConfig(data) : null;
    },
  });

  const criarEmissao = useMutation({
    mutationFn: async (params: { vendaGrupoVenda: string; contingencia?: boolean }) => {
      const { data, error } = await supabase
        .from("nfce_emissoes")
        .insert({
          venda_grupo_venda: params.vendaGrupoVenda,
          status: "pendente",
          contingencia: params.contingencia || false,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });

  const atualizarStatus = useMutation({
    mutationFn: async (params: {
      id: string;
      status: string;
      chaveAcesso?: string;
      protocoloAutorizacao?: string;
      numeroNfce?: number;
      motivoRejeicao?: string;
      xmlUrl?: string;
    }) => {
      const updates: any = { status: params.status };
      if (params.chaveAcesso) updates.chave_acesso = params.chaveAcesso;
      if (params.protocoloAutorizacao) updates.protocolo_autorizacao = params.protocoloAutorizacao;
      if (params.numeroNfce) updates.numero_nfce = params.numeroNfce;
      if (params.motivoRejeicao) updates.motivo_rejeicao = params.motivoRejeicao;
      if (params.xmlUrl) updates.xml_url = params.xmlUrl;

      const { error } = await supabase
        .from("nfce_emissoes")
        .update(updates)
        .eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const cancelarNfce = useMutation({
    mutationFn: async (params: { id: string; motivo: string }) => {
      const { error } = await supabase
        .from("nfce_emissoes")
        .update({
          status: "cancelada",
          data_cancelamento: new Date().toISOString(),
          motivo_cancelamento: params.motivo,
        })
        .eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const salvarConfigFiscal = useMutation({
    mutationFn: async (config: Omit<ConfiguracaoFiscal, "id">) => {
      // Upsert - if exists update, else insert
      const { data: existing } = await supabase
        .from("configuracoes_fiscais")
        .select("id")
        .limit(1)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("configuracoes_fiscais")
          .update({
            cnpj: config.cnpj,
            inscricao_estadual: config.inscricaoEstadual,
            razao_social: config.razaoSocial,
            nome_fantasia: config.nomeFantasia,
            endereco: config.endereco,
            numero: config.numero,
            complemento: config.complemento,
            bairro: config.bairro,
            cidade: config.cidade,
            uf: config.uf,
            cep: config.cep,
            telefone: config.telefone,
            regime_tributario: config.regimeTributario,
            ambiente: config.ambiente,
            serie_nfce: config.serieNfce,
            proximo_numero_nfce: config.proximoNumeroNfce,
            csc_id: config.cscId,
            csc_token: config.cscToken,
            logo_url: config.logoUrl,
          })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("configuracoes_fiscais")
          .insert({
            cnpj: config.cnpj,
            inscricao_estadual: config.inscricaoEstadual,
            razao_social: config.razaoSocial,
            nome_fantasia: config.nomeFantasia,
            endereco: config.endereco,
            numero: config.numero,
            complemento: config.complemento,
            bairro: config.bairro,
            cidade: config.cidade,
            uf: config.uf,
            cep: config.cep,
            telefone: config.telefone,
            regime_tributario: config.regimeTributario,
            ambiente: config.ambiente,
            serie_nfce: config.serieNfce,
            proximo_numero_nfce: config.proximoNumeroNfce,
            csc_id: config.cscId,
            csc_token: config.cscToken,
            logo_url: config.logoUrl,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["configuracoes_fiscais"] }),
  });

  // Generate NFC-e XML structure (template - real signing requires fiscal API)
  const gerarXmlNfce = (params: {
    emitente: ConfiguracaoFiscal;
    itens: { codigo: string; descricao: string; ncm: string; cfop: string; cstCsosn: string; unidade: string; quantidade: number; valor: number }[];
    pagamentos: { forma: string; valor: number; parcelas?: number }[];
    total: number;
    numero: number;
    serie: number;
  }): string => {
    const { emitente, itens, pagamentos, total, numero, serie } = params;
    
    // Map payment type to SEFAZ code
    const formaPagSefaz = (forma: string): string => {
      const map: Record<string, string> = {
        "Dinheiro": "01",
        "Débito": "04",
        "Crédito": "03",
        "Pix": "17",
        "Conta Assinada": "05",
      };
      return map[forma] || "99";
    };

    const itensXml = itens.map((item, idx) => `
      <det nItem="${idx + 1}">
        <prod>
          <cProd>${item.codigo}</cProd>
          <cEAN>SEM GTIN</cEAN>
          <xProd>${item.descricao}</xProd>
          <NCM>${item.ncm}</NCM>
          <CFOP>${item.cfop}</CFOP>
          <uCom>${item.unidade}</uCom>
          <qCom>${item.quantidade.toFixed(4)}</qCom>
          <vUnCom>${item.valor.toFixed(2)}</vUnCom>
          <vProd>${(item.quantidade * item.valor).toFixed(2)}</vProd>
          <cEANTrib>SEM GTIN</cEANTrib>
          <uTrib>${item.unidade}</uTrib>
          <qTrib>${item.quantidade.toFixed(4)}</qTrib>
          <vUnTrib>${item.valor.toFixed(2)}</vUnTrib>
          <indTot>1</indTot>
        </prod>
        <imposto>
          <ICMS>
            <ICMSSN102>
              <Orig>0</Orig>
              <CSOSN>${item.cstCsosn || "102"}</CSOSN>
            </ICMSSN102>
          </ICMS>
          <PIS><PISOutr><CST>99</CST><vBC>0.00</vBC><pPIS>0.00</pPIS><vPIS>0.00</vPIS></PISOutr></PIS>
          <COFINS><COFINSOutr><CST>99</CST><vBC>0.00</vBC><pCOFINS>0.00</pCOFINS><vCOFINS>0.00</vCOFINS></COFINSOutr></COFINS>
        </imposto>
      </det>`).join("");

    const pagamentosXml = pagamentos.map(p => `
      <detPag>
        <tPag>${formaPagSefaz(p.forma)}</tPag>
        <vPag>${p.valor.toFixed(2)}</vPag>
      </detPag>`).join("");

    return `<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe versao="4.00">
    <ide>
      <cUF>13</cUF>
      <natOp>VENDA</natOp>
      <mod>65</mod>
      <serie>${serie}</serie>
      <nNF>${numero}</nNF>
      <tpNF>1</tpNF>
      <idDest>1</idDest>
      <tpImp>4</tpImp>
      <tpEmis>1</tpEmis>
      <tpAmb>${emitente.ambiente === "producao" ? "1" : "2"}</tpAmb>
      <finNFe>1</finNFe>
      <indFinal>1</indFinal>
      <indPres>1</indPres>
      <procEmi>0</procEmi>
      <verProc>LeJess1.0</verProc>
    </ide>
    <emit>
      <CNPJ>${emitente.cnpj.replace(/\D/g, "")}</CNPJ>
      <xNome>${emitente.razaoSocial}</xNome>
      <xFant>${emitente.nomeFantasia}</xFant>
      <enderEmit>
        <xLgr>${emitente.endereco}</xLgr>
        <nro>${emitente.numero}</nro>
        <xBairro>${emitente.bairro}</xBairro>
        <xMun>${emitente.cidade}</xMun>
        <UF>${emitente.uf}</UF>
        <CEP>${emitente.cep.replace(/\D/g, "")}</CEP>
        <fone>${emitente.telefone.replace(/\D/g, "")}</fone>
      </enderEmit>
      <IE>${emitente.inscricaoEstadual}</IE>
      <CRT>${emitente.regimeTributario === "simples_nacional" ? "1" : "3"}</CRT>
    </emit>
    ${itensXml}
    <total>
      <ICMSTot>
        <vBC>0.00</vBC>
        <vICMS>0.00</vICMS>
        <vProd>${total.toFixed(2)}</vProd>
        <vNF>${total.toFixed(2)}</vNF>
      </ICMSTot>
    </total>
    <transp><modFrete>9</modFrete></transp>
    <pag>
      ${pagamentosXml}
    </pag>
  </infNFe>
</NFe>`;
  };

  return {
    emissoes,
    isLoading,
    configFiscal,
    criarEmissao: criarEmissao.mutateAsync,
    atualizarStatus: atualizarStatus.mutateAsync,
    cancelarNfce: cancelarNfce.mutateAsync,
    salvarConfigFiscal: salvarConfigFiscal.mutateAsync,
    gerarXmlNfce,
  };
}
