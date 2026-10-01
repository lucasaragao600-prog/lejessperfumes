// Cancelamento de NFC-e (evento 110111) dentro do prazo legal.
import { carregarPfx, assinarXml, agora } from "./nfce.ts";

const EVT = {
  homologacao: { url: "https://homnfce.sefaz.am.gov.br/nfce-services/services/RecepcaoEvento4", tpAmb: 2 },
  producao: { url: "https://nfce.sefaz.am.gov.br/nfce-services/services/RecepcaoEvento4", tpAmb: 1 },
};
const PRAZO_MIN = 30;
const esc = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[<>&"]/g, "").replace(/\s+/g, " ").trim();

export async function cancelarNfce(
  admin: any, caller: any, grupo: string, justificativa: string, relayUrl: string,
  carregarCertificado: (a: any) => Promise<{ pfx: string; senha: string }>,
) {
  const just = esc(justificativa);
  if (just.length < 15 || just.length > 255) throw new Error("A justificativa precisa ter entre 15 e 255 caracteres");
  const { data: em } = await admin.from("nfce_emissoes").select("*").eq("venda_grupo_venda", grupo).eq("status", "emitida").maybeSingle();
  if (!em) throw new Error("Não há NFC-e autorizada para esta venda");
  const { data: pode } = await caller.rpc("usuario_tem_permissao", { _unidade_id: em.unidade_id, _permissao: "fiscal.cancelar" });
  if (!pode) throw new Error("Você não tem permissão para cancelar notas nesta loja");
  const minutos = (Date.now() - new Date(em.data_emissao).getTime()) / 60000;
  if (minutos > PRAZO_MIN) throw new Error(`Prazo de cancelamento (${PRAZO_MIN} minutos) já passou`);

  const { data: cfg } = await admin.from("configuracoes_fiscais").select("*").eq("unidade_id", em.unidade_id).single();
  const amb = (em.chave_acesso.length === 44 && cfg.ambiente === "producao") ? "producao" : "homologacao";
  // ambiente da nota: está no XML guardado (tpAmb) — usa o do arquivo se houver
  let tpAmb = EVT[amb].tpAmb, url = EVT[amb].url;
  if (em.xml_url) {
    const { data: f } = await admin.storage.from("fiscal-xml").download(em.xml_url);
    const x = f ? await f.text() : "";
    const t = x.match(/<tpAmb>(\d)<\/tpAmb>/)?.[1];
    if (t === "1") { tpAmb = 1; url = EVT.producao.url; } else if (t === "2") { tpAmb = 2; url = EVT.homologacao.url; }
  }

  const cert = await carregarCertificado(admin);
  const { key, certB64 } = carregarPfx(cert.pfx, cert.senha);
  const cnpj = String(cfg.cnpj).replace(/\D/g, "");
  const id = `ID110111${em.chave_acesso}01`;
  const inner = `<cOrgao>13</cOrgao><tpAmb>${tpAmb}</tpAmb><CNPJ>${cnpj}</CNPJ><chNFe>${em.chave_acesso}</chNFe><dhEvento>${agora()}</dhEvento><tpEvento>110111</tpEvento><nSeqEvento>1</nSeqEvento><verEvento>1.00</verEvento><detEvento versao="1.00"><descEvento>Cancelamento</descEvento><nProt>${em.protocolo_autorizacao}</nProt><xJust>${just}</xJust></detEvento>`;
  const sig = assinarXml(`<infEvento xmlns="http://www.portalfiscal.inf.br/nfe" Id="${id}">${inner}</infEvento>`, id, key, certB64);
  const evento = `<evento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00"><infEvento Id="${id}">${inner}</infEvento>${sig}</evento>`;
  const envelope = `<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4"><envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00"><idLote>${Date.now().toString().slice(-15)}</idLote>${evento}</envEvento></nfeDadosMsg></soap12:Body></soap12:Envelope>`;
  const r = await fetch(`${relayUrl}/soap`, {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("FISCAL_RELAY_SECRET")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ url, envelope, pfx: cert.pfx, senha: cert.senha, action: "http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4/nfeRecepcaoEvento" }),
  });
  const out = await r.json();
  const body: string = out.body || "";
  const all = (tag: string) => [...body.matchAll(new RegExp(`<(?:\\w+:)?${tag}>([^<]*)<`, "g"))].map((m) => m[1]);
  const cStats = all("cStat"), motivos = all("xMotivo");
  const cStat = cStats[1] ?? cStats[0] ?? null, motivo = motivos[1] ?? motivos[0] ?? out.error ?? "Sem resposta da SEFAZ";
  if (cStat !== "135" && cStat !== "155") return { ok: false, cStat, motivo };

  const prot = all("nProt").pop() ?? null;
  const proc = `<?xml version="1.0" encoding="UTF-8"?><procEventoNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">${evento}${(body.match(/<retEvento[\s\S]*?<\/retEvento>/) || [""])[0]}</procEventoNFe>`;
  await admin.storage.from("fiscal-xml").upload(`nfce/${em.unidade_id}/${em.chave_acesso}-cancelamento.xml`, new Blob([proc], { type: "application/xml" }), { upsert: true });
  await admin.from("nfce_emissoes").update({ status: "cancelada", data_cancelamento: new Date().toISOString(), motivo_cancelamento: just }).eq("id", em.id);
  await admin.from("vendas").update({ nfce_status: "cancelada" }).eq("grupo_venda", grupo);
  await admin.rpc("fn_audit", { p_acao: "nfce_cancelar", p_entidade: "nfce_emissoes", p_entidade_id: em.id, p_unidade_id: em.unidade_id,
    p_dados_anteriores: { status: "emitida" }, p_dados_novos: { status: "cancelada", protocolo: prot, justificativa: just }, p_ip: "" }).then(() => {}, () => {});
  return { ok: true, protocolo: prot, motivo };
}
