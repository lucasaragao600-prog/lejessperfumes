import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";

export interface ResultadoNfce {
  ok: boolean;
  jaEmitida?: boolean;
  numero?: number;
  serie?: number;
  chave?: string;
  protocolo?: string;
  qr?: string;
  dhEmi?: string;
  ambiente?: string;
  cStat?: string;
  motivo?: string;
  avisos?: string[];
  emitente?: { razao: string; cnpj: string; ie: string; endereco: string };
}

/** Envia a venda à SEFAZ (idempotente: se já autorizada, devolve a mesma nota). */
export async function emitirNfce(grupoVenda: string): Promise<ResultadoNfce> {
  const { data, error } = await supabase.functions.invoke("fiscal-sefaz", {
    body: { action: "emitir", grupo_venda: grupoVenda },
  });
  if (error) return { ok: false, motivo: "Não foi possível falar com o servidor fiscal" };
  return data as ResultadoNfce;
}

/** Cancela a NFC-e autorizada (até 30 minutos após a emissão). */
export async function cancelarNfce(grupoVenda: string, justificativa: string): Promise<{ ok: boolean; motivo?: string; protocolo?: string }> {
  const { data, error } = await supabase.functions.invoke("fiscal-sefaz", {
    body: { action: "cancelar", grupo_venda: grupoVenda, justificativa },
  });
  if (error) return { ok: false, motivo: "Não foi possível falar com o servidor fiscal" };
  return data;
}

const EXPLICACOES: Record<string, string> = {
  "539": "Este número de nota já foi usado antes para o mesmo CNPJ e série. A SEFAZ não aceita dois documentos com o mesmo número. Ao reenviar, o sistema usa o próximo número livre.",
  "204": "Esta nota já tinha sido enviada e registrada na SEFAZ. Ao reenviar, o sistema usa o próximo número livre.",
  "209": "A Inscrição Estadual da loja está errada ou não pertence a este CNPJ. Confira o cadastro fiscal da loja.",
  "231": "A Inscrição Estadual cadastrada na loja não pertence a este CNPJ na SEFAZ. Cada loja tem seu próprio CNPJ (matriz ou filial) e sua Inscrição Estadual: confira os dois no cadastro fiscal da loja.",
  "232": "A Inscrição Estadual da loja não está cadastrada na SEFAZ. Confira com o contador.",
  "301": "A SEFAZ apontou problema na situação cadastral da empresa (Inscrição Estadual irregular). Fale com o contador.",
  "778": "O código fiscal (NCM) de algum produto não existe ou está errado. Corrija o NCM no cadastro do produto.",
  "225": "Algum dado da nota está fora do padrão exigido pela SEFAZ. Avise o suporte com a mensagem técnica.",
  "297": "A assinatura digital não foi aceita. O certificado pode estar vencido ou ser de outra empresa.",
  "280": "O certificado digital não foi aceito pela SEFAZ (vencido ou inválido). Providencie a renovação.",
  "462": "O código de segurança (CSC) não foi aceito. Confira o ID e o CSC cadastrados na loja.",
  "464": "O código de segurança (CSC) não foi aceito. Confira o ID e o CSC cadastrados na loja.",
  "999": "A SEFAZ teve um erro interno. Tente reenviar em alguns minutos.",
  "108": "A SEFAZ está fora do ar no momento. Tente reenviar em alguns minutos.",
  "109": "A SEFAZ está fora do ar no momento. Tente reenviar em alguns minutos.",
};

/** Explica a recusa da SEFAZ em linguagem simples. */
export function explicarRejeicao(motivo?: string | null): string {
  const m = String(motivo || "");
  const cod = m.match(/^\s*(\d{3})/)?.[1];
  if (cod && EXPLICACOES[cod]) return EXPLICACOES[cod];
  if (/servidor fiscal|SEFAZ/i.test(m) && !cod) return "Não foi possível falar com a SEFAZ. Verifique a internet e tente reenviar.";
  return "A SEFAZ recusou a nota. Corrija o ponto indicado na mensagem técnica abaixo e reenvie.";
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const esc = (s: unknown) => String(s ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!));

export interface ItemDanfe { nome: string; quantidade: number; precoUnitario: number; total: number }
export interface PagDanfe { tipo: string; valor: number }

/** Imprime o DANFE NFC-e (bobina 80 mm) com QR Code. */
export async function imprimirDanfe(nf: ResultadoNfce, itens: ItemDanfe[], pagamentos: PagDanfe[], troco = 0) {
  if (!nf.ok || !nf.chave || !nf.qr) return;
  const qrImg = await QRCode.toDataURL(nf.qr, { margin: 0, width: 220 });
  const bruto = itens.reduce((s, i) => s + i.precoUnitario * i.quantidade, 0);
  const liquido = itens.reduce((s, i) => s + i.total, 0);
  const chave = nf.chave.replace(/(\d{4})/g, "$1 ").trim();
  const homolog = nf.ambiente !== "producao";
  const data = nf.dhEmi ? new Date(nf.dhEmi).toLocaleString("pt-BR", { timeZone: "America/Manaus" }) : "";
  const e = nf.emitente;
  const pw = window.open("", "_blank", "width=380,height=700");
  if (!pw) return;
  pw.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>DANFE NFC-e ${nf.numero}</title>
<style>@page{size:80mm auto;margin:3mm}body{font-family:Arial,sans-serif;font-weight:900;font-size:11px;width:74mm;margin:0;color:#000}
.c{text-align:center}.hr{border-top:1px dashed #000;margin:4px 0}table{width:100%;border-collapse:collapse}td{vertical-align:top;padding:1px 0}.r{text-align:right}</style></head><body>
<div class="c">${esc(e?.razao)}<br>CNPJ ${esc(e?.cnpj)} IE ${esc(e?.ie)}<br>${esc(e?.endereco)}</div>
<div class="hr"></div><div class="c">DANFE NFC-e - Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica</div>
${homolog ? '<div class="c" style="margin-top:3px">EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO - SEM VALOR FISCAL</div>' : ""}
<div class="hr"></div><table>${itens.map((i) => `<tr><td colspan="2">${esc(i.nome)}</td></tr><tr><td>${i.quantidade} x ${brl(i.precoUnitario)}</td><td class="r">${brl(i.precoUnitario * i.quantidade)}</td></tr>`).join("")}</table>
<div class="hr"></div><table><tr><td>Qtd. total de itens</td><td class="r">${itens.reduce((s, i) => s + i.quantidade, 0)}</td></tr>
<tr><td>Valor total</td><td class="r">${brl(bruto)}</td></tr>${bruto - liquido > 0.004 ? `<tr><td>Descontos</td><td class="r">-${brl(bruto - liquido)}</td></tr>` : ""}
<tr><td>Valor a pagar</td><td class="r">${brl(liquido)}</td></tr>
${pagamentos.map((p) => `<tr><td>${esc(p.tipo)}</td><td class="r">${brl(p.valor)}</td></tr>`).join("")}
${troco > 0 ? `<tr><td>Troco</td><td class="r">${brl(troco)}</td></tr>` : ""}</table>
<div class="hr"></div><div class="c">Consulte pela chave de acesso em<br>www.sefaz.am.gov.br/nfce/consulta<br><br>${chave}</div>
<div class="hr"></div><div class="c">CONSUMIDOR NÃO IDENTIFICADO</div>
<div class="c">NFC-e nº ${nf.numero} Série ${nf.serie} ${esc(data)}<br>Protocolo de autorização: ${esc(nf.protocolo)}</div>
<div class="c" style="margin-top:6px"><img src="${qrImg}" style="width:38mm;height:38mm"></div>
<script>window.onload=()=>{setTimeout(()=>{window.print();},300)}</script></body></html>`);
  pw.document.close();
}
