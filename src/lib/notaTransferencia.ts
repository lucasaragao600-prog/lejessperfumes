import type { NtDetalhe, NtItem } from "@/hooks/useNotasTransferencia";

export type NtVia = "origem" | "destino" | "transporte";

export const VIA_LABEL: Record<NtVia, string> = {
  origem: "Via da origem",
  destino: "Via do destino",
  transporte: "Via do transporte",
};

export const REF_LABEL: Record<string, string> = {
  transferencia: "Transferência",
  reposicao: "Reposição",
  decant: "Transferência de decants",
  manual: "Transferência manual",
};

/** A via do destino é cega enquanto a mercadoria não foi recebida (ou quando o servidor já ocultou). */
export function viaCega(nt: Pick<NtDetalhe, "status" | "conferencia_cega">, via: NtVia) {
  return nt.conferencia_cega || (via === "destino" && nt.status === "EMITIDA");
}

export function fmtQtd(n: number | null | undefined, um: string) {
  if (n == null) return "—";
  return `${Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}${um === "ml" ? " ml" : ""}`;
}

export function dataHoraNt(s?: string | null) {
  return s ? new Date(s).toLocaleString("pt-BR", { timeZone: "America/Manaus" }) : "—";
}

export interface LinhaNt {
  codigo: string;
  descricao: string;
  um: string;
  tipo: string;
  enviado: string;
  recebido: string;
  diferenca: string;
}

const TIPO_LABEL: Record<string, string> = {
  produto: "Produto", decant_pronto: "Decant", decant_fechado: "Frasco fechado", frasco: "Frasco aberto",
};

export function linhasNota(itens: NtItem[], cega: boolean): LinhaNt[] {
  return itens.map((i) => {
    const env = cega ? null : i.quantidade_enviada;
    const dif = env == null || i.quantidade_recebida == null ? null : i.quantidade_recebida - env;
    return {
      codigo: i.codigo || "—",
      descricao: i.descricao,
      um: i.unidade_medida,
      tipo: TIPO_LABEL[i.tipo_item] || i.tipo_item,
      enviado: cega ? "(conferência cega)" : fmtQtd(env, i.unidade_medida),
      recebido: fmtQtd(i.quantidade_recebida, i.unidade_medida),
      diferenca: dif == null ? "—" : dif === 0 ? "OK" : fmtQtd(dif, i.unidade_medida),
    };
  });
}

export function totaisNota(itens: NtItem[], cega: boolean) {
  const soma = (um: string, campo: "quantidade_enviada" | "quantidade_recebida") =>
    itens.filter((i) => i.unidade_medida === um).reduce((s, i) => s + Number(i[campo] ?? 0), 0);
  return {
    itens: itens.length,
    unidades: cega ? null : soma("un", "quantidade_enviada"),
    ml: cega ? null : soma("ml", "quantidade_enviada"),
    unidadesRecebidas: soma("un", "quantidade_recebida"),
    mlRecebidos: soma("ml", "quantidade_recebida"),
  };
}

export function urlScanNota(codigo: string, origin = window.location.origin) {
  return `${origin}/nt/${codigo}`;
}

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

/** HTML resumido para impressora térmica de 72 mm. */
export function htmlTermica(nt: NtDetalhe, via: NtVia, impressao: number, qrDataUrl: string, logo: string) {
  const cega = viaCega(nt, via);
  const linhas = linhasNota(nt.itens, cega);
  const tot = totaisNota(nt.itens, cega);
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(nt.numero)}</title>
<style>
@page { size: 72mm auto; margin: 2mm; }
body { width: 68mm; margin: 0; font-family: Arial, sans-serif; font-size: 10px; font-weight: 700; color: #000; }
.c { text-align: center; } .h { font-size: 13px; } hr { border: 0; border-top: 1px dashed #000; margin: 4px 0; }
table { width: 100%; border-collapse: collapse; } td { padding: 1px 0; vertical-align: top; } .r { text-align: right; white-space: nowrap; }
.sig { margin-top: 18px; border-top: 1px solid #000; padding-top: 2px; }
</style></head><body>
${logo ? `<div class="c"><img src="${esc(logo)}" style="max-width:40mm;max-height:14mm"></div>` : ""}
<div class="c h">NOTA DE TRANSFERÊNCIA</div>
<div class="c h">Nº ${esc(nt.numero)}${nt.revisao > 1 ? ` rev.${nt.revisao}` : ""}</div>
<div class="c">${esc(VIA_LABEL[via].toUpperCase())}</div>
${impressao > 1 ? `<div class="c">*** ${impressao}ª VIA / REIMPRESSÃO ***</div>` : ""}
<hr>
<div>De: ${esc(nt.origem.nome_exibicao)}</div>
<div>Para: ${esc(nt.destino.nome_exibicao)}</div>
<div>Ref.: ${esc(REF_LABEL[nt.tipo_origem] || nt.tipo_origem)} ${esc(nt.origem_numero)}</div>
<div>Emitida: ${esc(dataHoraNt(nt.emitido_em))}</div>
${nt.transportador ? `<div>Transportador: ${esc(nt.transportador)}</div>` : ""}
<hr>
<table>${linhas.map((l) => `<tr><td>${esc(l.codigo)} ${esc(l.descricao)}</td></tr>
<tr><td class="r">Env: ${esc(l.enviado)} · Rec: ${esc(l.recebido)}</td></tr>`).join("")}</table>
<hr>
<div>Itens: ${tot.itens}${tot.unidades != null ? ` · Unidades: ${tot.unidades}` : ""}${tot.ml ? ` · ml: ${tot.ml}` : ""}</div>
${nt.cnpjs_diferentes ? `<div>CNPJs diferentes: verificar necessidade de NF-e de transferência com o contador.</div>` : ""}
<div class="c" style="margin-top:4px"><img src="${qrDataUrl}" style="width:26mm;height:26mm"></div>
<div class="c">Documento de controle interno, sem valor fiscal.</div>
<div class="sig">Enviado por</div>
<div class="sig">Recebido por / data</div>
<script>window.onload=()=>{window.print();setTimeout(()=>window.close(),300)}</script>
</body></html>`;
}
