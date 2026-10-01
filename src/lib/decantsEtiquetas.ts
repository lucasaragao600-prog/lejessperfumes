import JsBarcode from "jsbarcode";
import QRCode from "qrcode";

export interface Etiqueta {
  sku: string; tamanho: string; volume_ml: number; marca: string; nome: string; concentracao: string;
  lote: string; data_producao: string | null; n: number;
}
export interface ModeloEtiqueta {
  id: string; nome: string; largura_mm: number; altura_mm: number; mostrar_qr: boolean; mostrar_barras: boolean; padrao: boolean; ativo: boolean;
}

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const fmtData = (d: string | null) => (d ? d.split("-").reverse().join("/") : "");
const fmtVol = (v: number) => `${String(Number(v)).replace(".", ",")} ml`;

export const urlScan = (codigo: string, origin = window.location.origin) => `${origin}/d/${encodeURIComponent(codigo)}`;

function barrasSvg(valor: string): string {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  JsBarcode(svg, valor, { format: "CODE128", displayValue: false, margin: 0, height: 40, width: 1.4 });
  svg.setAttribute("preserveAspectRatio", "none");
  return svg.outerHTML;
}

/** Monta o HTML de impressão: uma página por etiqueta, no tamanho do modelo (PDF/driver da impressora térmica). */
export async function htmlEtiquetas(etqs: Etiqueta[], m: ModeloEtiqueta): Promise<string> {
  const qrs = new Map<string, string>();
  if (m.mostrar_qr) for (const l of new Set(etqs.map((e) => e.lote))) qrs.set(l, await QRCode.toDataURL(urlScan(l), { margin: 0, width: 240 }));
  const barras = new Map<string, string>();
  if (m.mostrar_barras) for (const s of new Set(etqs.map((e) => e.sku))) barras.set(s, barrasSvg(s));
  const W = m.largura_mm, H = m.altura_mm, qr = Math.min(H - 4, W * 0.38);
  const corpo = etqs.map((e) => `
  <div class="etq">
    <div class="txt">
      <div class="marca">LE JESS</div>
      <div class="nome">${esc(e.nome)}</div>
      <div class="lin">${esc(e.marca)}${e.concentracao ? " · " + esc(e.concentracao) : ""}</div>
      <div class="lin b">${esc(fmtVol(e.volume_ml))} · ${esc(e.sku)}</div>
      <div class="lin">Lote ${esc(e.lote)} · ${esc(fmtData(e.data_producao))}</div>
      ${m.mostrar_barras ? `<div class="bar">${barras.get(e.sku)}</div>` : ""}
    </div>
    ${m.mostrar_qr ? `<img class="qr" src="${qrs.get(e.lote)}" alt="QR ${esc(e.lote)}"/>` : ""}
  </div>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Etiquetas ${esc(etqs[0]?.lote ?? "")}</title><style>
@page { size: ${W}mm ${H}mm; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, Helvetica, sans-serif; color: #000; background: #fff; }
.etq { width: ${W}mm; height: ${H}mm; padding: 1.5mm; display: flex; gap: 1.5mm; align-items: center; overflow: hidden; page-break-after: always; break-after: page; }
.txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: .3mm; }
.marca { font-weight: 900; font-size: ${Math.max(H * 0.09, 2.2)}mm; letter-spacing: .4mm; }
.nome { font-weight: 700; font-size: ${Math.max(H * 0.085, 2)}mm; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lin { font-size: ${Math.max(H * 0.065, 1.7)}mm; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.b { font-weight: 700; }
.bar svg { width: 100%; height: ${Math.max(H * 0.2, 4)}mm; display: block; }
.qr { width: ${qr}mm; height: ${qr}mm; flex: none; image-rendering: pixelated; }
</style></head><body>${corpo}</body></html>`;
}

export async function imprimirEtiquetas(etqs: Etiqueta[], m: ModeloEtiqueta) {
  const win = window.open("", "_blank");
  if (!win) throw new Error("Permita janelas pop-up para imprimir as etiquetas.");
  win.document.write(await htmlEtiquetas(etqs, m));
  win.document.close();
  setTimeout(() => { try { win.focus(); win.print(); } catch { /* já impresso */ } }, 800);
}
