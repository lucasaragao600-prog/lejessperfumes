import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";
import type { NtDetalhe, NtUnidade } from "@/hooks/useNotasTransferencia";
import { NT_STATUS_META } from "@/hooks/useNotasTransferencia";
import { buscarLogoEmpresa, logoPadrao } from "@/hooks/useLogoEmpresa";
import {
  REF_LABEL, VIA_LABEL, dataHoraNt, htmlTermica, linhasNota, totaisNota, urlScanNota, viaCega, type NtVia,
} from "@/lib/notaTransferencia";

const GOLD: [number, number, number] = [201, 162, 74];
const DARK: [number, number, number] = [25, 25, 28];
const MUTED: [number, number, number] = [120, 120, 125];
const moeda = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export async function carregarLogoNt(): Promise<string | null> {
  try {
    const res = await fetch((await buscarLogoEmpresa().catch(() => "")) || logoPadrao);
    const blob = await res.blob();
    return await new Promise((r) => {
      const fr = new FileReader();
      fr.onloadend = () => r(fr.result as string);
      fr.onerror = () => r(null);
      fr.readAsDataURL(blob);
    });
  } catch { return null; }
}

function endereco(u: NtUnidade) {
  return [
    [u.logradouro, u.numero, u.complemento].filter(Boolean).join(", "),
    u.bairro, [u.cidade, u.uf].filter(Boolean).join("/"), u.cep ? `CEP ${u.cep}` : "",
  ].filter(Boolean).join(" · ");
}

/** Monta o documento A4 com uma página por via. `impressao` > 1 marca "2ª via / reimpressão". */
export async function montarPdfNota(nt: NtDetalhe, vias: NtVia[], impressao: number, logo: string | null) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const qr = await QRCode.toDataURL(urlScanNota(nt.codigo_publico), { margin: 0, width: 200 });

  vias.forEach((via, idx) => {
    if (idx > 0) doc.addPage();
    const cega = viaCega(nt, via);
    let y = 14;
    if (logo) { try { doc.addImage(logo, "PNG", 14, y - 2, 32, 12); } catch { /* logo inválida */ } }
    doc.addImage(qr, "PNG", W - 36, y - 4, 22, 22);

    doc.setFontSize(14); doc.setTextColor(...DARK);
    doc.text("NOTA DE TRANSFERÊNCIA Nº", W - 40, y + 2, { align: "right" });
    doc.setFontSize(12); doc.setTextColor(...GOLD);
    doc.text(`${nt.numero}${nt.revisao > 1 ? ` · rev. ${nt.revisao}` : ""}`, W - 40, y + 8, { align: "right" });
    doc.setFontSize(8); doc.setTextColor(...MUTED);
    doc.text(`${NT_STATUS_META[nt.status]?.label || nt.status} · ${VIA_LABEL[via]}`, W - 40, y + 13, { align: "right" });
    if (impressao > 1) {
      doc.setTextColor(200, 40, 40); doc.setFontSize(9);
      doc.text(`${impressao}ª VIA / REIMPRESSÃO`, 14, y + 16);
    }
    y += 22;
    doc.setDrawColor(...GOLD); doc.line(14, y, W - 14, y); y += 5;

    doc.setFontSize(7.5); doc.setTextColor(...MUTED);
    doc.text("Documento de controle interno, sem valor fiscal.", 14, y);
    if (nt.cnpjs_diferentes) {
      doc.setTextColor(200, 120, 0);
      doc.text("CNPJs diferentes: verificar necessidade de NF-e de transferência com o contador.", W - 14, y, { align: "right" });
    }
    y += 6;

    const bloco = (titulo: string, u: NtUnidade, x: number) => {
      doc.setFontSize(8); doc.setTextColor(...GOLD); doc.text(titulo, x, y);
      doc.setFontSize(9); doc.setTextColor(...DARK); doc.text(u.nome_exibicao || u.nome, x, y + 5);
      doc.setFontSize(7.5); doc.setTextColor(...MUTED);
      doc.text(`CNPJ: ${u.cnpj || "—"}  IE: ${u.inscricao_estadual || "—"}`, x, y + 9.5);
      doc.text(`Telefone: ${u.telefone || "—"}`, x, y + 13.5);
      doc.text(doc.splitTextToSize(endereco(u) || "—", W / 2 - 22), x, y + 17.5);
    };
    bloco("ORIGEM", nt.origem, 14);
    bloco("DESTINO", nt.destino, W / 2 + 4);
    y += 28;

    const info: [string, string][] = [
      ["Referência", `${REF_LABEL[nt.tipo_origem] || nt.tipo_origem} ${nt.origem_numero}`],
      ["Emitida em", dataHoraNt(nt.emitido_em)],
      ["Transportador", nt.transportador || "—"],
      ["Recebida em", dataHoraNt(nt.recebido_em)],
    ];
    if (nt.nt_original_numero) info.push(["Substitui/retifica", `${nt.nt_original_numero} — ${nt.motivo_revisao}`]);
    if (nt.status === "CANCELADA") info.push(["Cancelada", `${dataHoraNt(nt.cancelado_em)} — ${nt.cancelado_motivo || ""}`]);
    doc.setFontSize(8.5);
    info.forEach(([l, v], i) => {
      const x = 14 + (i % 2) * (W / 2 - 10); const yy = y + Math.floor(i / 2) * 5.5;
      doc.setTextColor(...MUTED); doc.text(`${l}:`, x, yy);
      doc.setTextColor(...DARK); doc.text(String(v), x + 27, yy);
    });
    y += Math.ceil(info.length / 2) * 5.5 + 3;

    const valores = nt.mostrar_valores && via !== "transporte";
    const linhas = linhasNota(nt.itens, cega);
    const head = [["Código / Lote", "Descrição", "Tipo", "Enviado", "Recebido", "Diferença", ...(valores ? ["Custo un.", "Total"] : [])]];
    const body = linhas.map((l, i) => [
      l.codigo, l.descricao, l.tipo, l.enviado, l.recebido, l.diferenca,
      ...(valores ? [moeda(nt.itens[i].custo_unitario ?? 0), moeda((nt.itens[i].custo_unitario ?? 0) * (nt.itens[i].quantidade_enviada ?? 0))] : []),
    ]);
    autoTable(doc, {
      startY: y, head, body, theme: "grid",
      headStyles: { fillColor: DARK, textColor: [255, 255, 255], fontSize: 7.5 },
      bodyStyles: { fontSize: 7.5, textColor: DARK }, margin: { left: 14, right: 14 },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = ((doc as any).lastAutoTable?.finalY ?? y) + 6;

    const tot = totaisNota(nt.itens, cega);
    doc.setFontSize(8.5); doc.setTextColor(...DARK);
    doc.text(
      `Itens: ${tot.itens}   Unidades: ${tot.unidades ?? "—"}   ml: ${tot.ml ?? "—"}   ` +
      `Recebido: ${tot.unidadesRecebidas} un${tot.mlRecebidos ? ` / ${tot.mlRecebidos} ml` : ""}`, 14, y);
    y += 6;

    doc.setFontSize(8); doc.setTextColor(...MUTED); doc.text("Observações:", 14, y);
    doc.setDrawColor(210, 210, 214); doc.rect(14, y + 2, W - 28, 14);
    if (nt.observacao) { doc.setTextColor(...DARK); doc.text(doc.splitTextToSize(nt.observacao, W - 34).slice(0, 3), 17, y + 7); }
    y += 26;

    if (y > 262) { doc.addPage(); y = 30; }
    const assin: [string, string][] = [
      ["Separado por", nt.separado_por_nome || ""],
      ["Enviado por", nt.emitido_por_nome || ""],
      ["Transportador", nt.transportador || ""],
      ["Recebido por", nt.recebido_por_nome ? `${nt.recebido_por_nome} · ${dataHoraNt(nt.recebido_em)}` : "Nome / data"],
    ];
    const larg = (W - 28 - 12) / 4;
    assin.forEach(([l, nome], i) => {
      const x = 14 + i * (larg + 4);
      doc.setDrawColor(...MUTED); doc.line(x, y, x + larg, y);
      doc.setFontSize(7.5); doc.setTextColor(...MUTED); doc.text(l, x, y + 4);
      doc.setTextColor(...DARK); doc.text(doc.splitTextToSize(nome, larg).slice(0, 2), x, y + 8);
    });
  });
  return doc;
}

export async function gerarPdfNota(nt: NtDetalhe, vias: NtVia[], impressao: number) {
  const doc = await montarPdfNota(nt, vias, impressao, await carregarLogoNt());
  doc.save(`${nt.numero}${impressao > 1 ? `-impressao${impressao}` : ""}.pdf`);
}

export async function imprimirTermicaNota(nt: NtDetalhe, via: NtVia, impressao: number) {
  const qr = await QRCode.toDataURL(urlScanNota(nt.codigo_publico), { margin: 0, width: 240 });
  const logo = (await carregarLogoNt()) || "";
  const w = window.open("", "_blank", "width=420,height=700");
  if (!w) throw new Error("Libere as janelas pop-up para imprimir.");
  w.document.write(htmlTermica(nt, via, impressao, qr, logo));
  w.document.close();
}
