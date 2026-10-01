// Emissão real de NFC-e a partir de uma venda (grupo_venda). Idempotente por grupo.
import { carregarPfx, montarNfce, type Item, type Pag } from "./nfce.ts";

const AUT = {
  homologacao: { url: "https://homnfce.sefaz.am.gov.br/nfce-services/services/NfeAutorizacao4", tpAmb: 2 as const },
  producao: { url: "https://nfce.sefaz.am.gov.br/nfce-services/services/NfeAutorizacao4", tpAmb: 1 as const },
};

const TPAG: Record<string, string> = {
  "Dinheiro": "01", "Crédito": "03", "Débito": "04", "Pix": "17",
  "Crédito Loja": "05", "Vale-Troca": "05", "Conta Assinada": "05",
};

function crtDe(regime: string): "1" | "2" | "3" {
  if (regime === "simples_nacional_excesso") return "2";
  if (regime === "simples_nacional") return "1";
  return "3";
}

export async function emitirVenda(
  admin: any, caller: any, grupo: string, relayUrl: string,
  carregarCertificado: (a: any) => Promise<{ pfx: string; senha: string }>,
) {
  const { data: vendas } = await admin.from("vendas").select("*").eq("grupo_venda", grupo);
  if (!vendas?.length) throw new Error("Venda não encontrada");
  if (vendas.some((v: any) => v.cancelada)) throw new Error("Venda cancelada não pode gerar NFC-e");

  let unidadeId: string | null = vendas[0].unidade_id;
  if (!unidadeId) {
    const { data: u } = await admin.rpc("fn_unidade_por_texto", { _txt: vendas[0].deposito });
    unidadeId = u?.id ?? null;
  }
  if (!unidadeId) throw new Error("Não foi possível identificar a loja da venda");

  const { data: acesso } = await caller.rpc("usuario_tem_acesso_unidade", { _unidade_id: unidadeId });
  if (!acesso) throw new Error("Sem acesso a esta loja");

  const { data: cfg } = await admin.from("configuracoes_fiscais").select("*").eq("unidade_id", unidadeId).maybeSingle();
  if (!cfg) throw new Error("Loja sem configuração fiscal");
  const emitente = { razao: cfg.razao_social, cnpj: cfg.cnpj, ie: cfg.inscricao_estadual, endereco: `${cfg.endereco}, ${cfg.numero} - ${cfg.bairro} - Manaus/AM` };

  // Idempotência: já autorizada → devolve a existente
  const { data: existentes } = await admin.from("nfce_emissoes").select("*").eq("venda_grupo_venda", grupo).order("created_at", { ascending: false });
  const autorizada = (existentes || []).find((e: any) => e.status === "emitida");
  if (autorizada) return { ok: true, jaEmitida: true, numero: autorizada.numero_nfce, serie: autorizada.serie, chave: autorizada.chave_acesso,
    protocolo: autorizada.protocolo_autorizacao, qr: autorizada.danfe_url, dhEmi: autorizada.data_emissao, ambiente: cfg.ambiente, emitente, avisos: [] };
  const emAndamento = (existentes || []).find((e: any) => e.status === "processando" && Date.now() - new Date(e.updated_at).getTime() < 90_000);
  if (emAndamento) throw new Error("Esta NFC-e já está sendo enviada. Aguarde alguns segundos.");
  // Nota recusada não fica registrada na SEFAZ: reaproveita o mesmo número
  const reaproveitar = (existentes || []).find((e: any) => e.status === "rejeitada" && e.numero_nfce)?.numero_nfce ?? 0;

  if (!cfg.inscricao_estadual || !cfg.csc_token || !cfg.csc_id) throw new Error("Inscrição Estadual ou CSC não cadastrados para esta loja");
  const amb = (cfg.ambiente === "producao" ? "producao" : "homologacao") as keyof typeof AUT;

  const ids = [...new Set(vendas.map((v: any) => v.perfume_id))];
  const { data: prods } = await admin.from("perfumes").select("id,codigo,nome,marca,concentracao,volume,ncm,cfop,cst_csosn,codigo_barras,unidade_fiscal").in("id", ids);
  const pm = new Map((prods || []).map((p: any) => [p.id, p]));
  const avisos: string[] = [];
  const itens: Item[] = vendas.map((v: any) => {
    const p: any = pm.get(v.perfume_id) || {};
    let ncm = String(p.ncm || "").replace(/\D/g, "");
    if (ncm.length !== 8) { ncm = "33030010"; avisos.push(`${p.codigo || v.perfume_nome}: sem NCM, usado 3303.00.10`); }
    const bruto = Number(v.preco_unitario) * Number(v.quantidade);
    return {
      codigo: p.codigo || String(v.perfume_id).slice(0, 8), gtin: String(p.codigo_barras || ""),
      descricao: [p.marca, p.nome, p.concentracao, p.volume ? `${p.volume}ML` : ""].filter(Boolean).join(" ") || v.perfume_nome,
      ncm, cfop: /^\d{4}$/.test(p.cfop || "") ? p.cfop : "5102", csosn: /^\d{3}$/.test(p.cst_csosn || "") ? p.cst_csosn : "102",
      un: p.unidade_fiscal || "UN", qtd: Number(v.quantidade), valor: Number(v.preco_unitario),
      desconto: Math.max(0, bruto - Number(v.total)),
    };
  });
  if (vendas.some((v: any) => v.tipo_ajuste === "acrescimo" && Number(v.total) > Number(v.preco_unitario) * Number(v.quantidade)))
    throw new Error("Vendas com acréscimo ainda não são suportadas na NFC-e");

  const { data: pgs } = await admin.from("venda_pagamentos").select("tipo_pagamento,valor").eq("grupo_venda", grupo);
  const pagamentos: Pag[] = (pgs || []).map((p: any) => ({ tPag: TPAG[p.tipo_pagamento] || "99", valor: Number(p.valor) }));

  // Reserva do número com trava otimista
  let numero = reaproveitar;
  for (let i = 0; i < 5 && !numero; i++) {
    const { data: atual } = await admin.from("configuracoes_fiscais").select("proximo_numero_nfce").eq("id", cfg.id).single();
    const n = atual.proximo_numero_nfce || 1;
    const { data: upd } = await admin.from("configuracoes_fiscais").update({ proximo_numero_nfce: n + 1 })
      .eq("id", cfg.id).eq("proximo_numero_nfce", n).select("id");
    if (upd?.length) numero = n;
  }
  if (!numero) throw new Error("Não foi possível reservar o número da nota. Tente novamente.");

  const { data: reg } = await admin.from("nfce_emissoes").insert({
    venda_grupo_venda: grupo, unidade_id: unidadeId, status: "processando", numero_nfce: numero, serie: cfg.serie_nfce || 1, contingencia: false,
  }).select().single();

  const marcar = async (campos: Record<string, unknown>, statusVenda: string, chave?: string) => {
    await admin.from("nfce_emissoes").update(campos).eq("id", reg.id);
    await admin.from("vendas").update({ nfce_status: statusVenda, ...(chave ? { nfce_chave: chave } : {}) }).eq("grupo_venda", grupo);
  };

  try {
    const cert = await carregarCertificado(admin);
    const { key, certB64 } = carregarPfx(cert.pfx, cert.senha);
    const { chave, nfe, total, qr, dhEmi } = montarNfce({
      cnpj: cfg.cnpj, ie: cfg.inscricao_estadual, razao: cfg.razao_social, fantasia: cfg.nome_fantasia,
      endereco: cfg.endereco, numero: cfg.numero, bairro: cfg.bairro, cep: cfg.cep, fone: cfg.telefone,
      crt: crtDe(cfg.regime_tributario), serie: cfg.serie_nfce || 1, numeroNota: numero,
      cscId: cfg.csc_id, csc: cfg.csc_token, tpAmb: AUT[amb].tpAmb,
    }, itens, pagamentos, key, certB64);

    const envelope = `<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4"><enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><idLote>${Date.now().toString().slice(-15)}</idLote><indSinc>1</indSinc>${nfe}</enviNFe></nfeDadosMsg></soap12:Body></soap12:Envelope>`;
    const r = await fetch(`${relayUrl}/soap`, {
      method: "POST",
      headers: { Authorization: `Bearer ${Deno.env.get("FISCAL_RELAY_SECRET")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url: AUT[amb].url, envelope, pfx: cert.pfx, senha: cert.senha,
        action: "http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4/nfeAutorizacaoLote" }),
    });
    const out = await r.json();
    const body: string = out.body || "";
    const all = (tag: string) => [...body.matchAll(new RegExp(`<(?:\\w+:)?${tag}>([^<]*)<`, "g"))].map((m) => m[1]);
    const cStats = all("cStat"), motivos = all("xMotivo");
    const prot = all("nProt")[0] ?? null;
    const cStatNota = cStats[1] ?? cStats[0] ?? null;
    const motivo = motivos[1] ?? motivos[0] ?? out.error ?? "Sem resposta da SEFAZ";

    if (!prot || (cStatNota !== "100" && cStatNota !== "150")) {
      await marcar({ status: "rejeitada", motivo_rejeicao: `${cStatNota ?? "-"} - ${motivo}`, chave_acesso: chave }, "rejeitada");
      return { ok: false, numero, cStat: cStatNota, motivo, avisos };
    }

    const proc = `<?xml version="1.0" encoding="UTF-8"?><nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">${nfe}${(body.match(/<protNFe[\s\S]*?<\/protNFe>/) || [""])[0]}</nfeProc>`;
    const path = `nfce/${unidadeId}/${chave}.xml`;
    await admin.storage.from("fiscal-xml").upload(path, new Blob([proc], { type: "application/xml" }), { upsert: true });
    await marcar({
      status: "emitida", chave_acesso: chave, protocolo_autorizacao: prot, xml_url: path, danfe_url: qr,
      data_emissao: new Date().toISOString(), motivo_rejeicao: null,
    }, "autorizada", chave);
    return {
      ok: true, numero, serie: cfg.serie_nfce || 1, chave, protocolo: prot, qr, dhEmi, total, ambiente: amb, avisos,
      emitente,
    };
  } catch (e) {
    await marcar({ status: "rejeitada", motivo_rejeicao: e instanceof Error ? e.message : "Erro no envio" }, "rejeitada");
    throw e;
  }
}
