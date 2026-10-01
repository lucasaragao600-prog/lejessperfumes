import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";
import type { NtDetalhe, NtUnidade } from "@/hooks/useNotasTransferencia";
import { NT_ORIGEM_LABEL, NT_STATUS_META } from "@/hooks/useNotasTransferencia";
import { buscarLogoEmpresa, logoPadrao } from "@/hooks/useLogoEmpresa";

const GOLD: [number, number, number] = [201, 162, 74];
const DARK: [number, number, number] = [25, 25, 28];
const MUTED: [number, number, number] = [120, 120, 125];

const dataHora = (s?: string | null) =>
  s ? new Date(s).toLocaleString("pt-BR", { timeZone: "America/Manaus" }) : "—";
const qtd = (n: number | null, um: string) =>
  n == null ? "—" : `${n.toLocaleString("pt-BR")}${um === "ml" ? " ml" : ""}`;
const moeda = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

async function carregarLogo(): Promise<string | null> {
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
    u.bairro, [u.cidade, u.uf].filter(Boolean).join("/"), u.cep,
  ].filter(Boolean).join(" · ");
}

/** Gera o PDF da NT. `via` > 1 marca "2ª via / reimpressão". */
export async function gerarPdfNota(nt: NtDetalhe, via: number) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  let y = 14;

  const logo = await carregarLogo();
  if (logo) { try { doc.addImage(logo, "PNG", 14, y - 2, 32, 12); } catch { /* logo inválida */ } }
  const qr = await QRCode.toDataURL(`${window.location.origin}/nt/${nt.codigo_publico}`, { margin: 0, width: 200 });
  doc.addImage(qr, "PNG", W - 36, y - 4, 22, 22);

  doc.setFontSize(15); doc.setTextColor(...DARK);
  doc.text("Nota de Transferência", W - 40, y + 3, { align: "right" });
  doc.setFontSize(11); doc.setTextColor(...GOLD);
  doc.text(`${nt.numero}${nt.revisao > 1 ? ` · rev. ${nt.revisao}` : ""}`, W - 40, y + 9, { align: "right" });
  doc.setFontSize(8); doc.setTextColor(...MUTED);
  doc.text(NT_STATUS_META[nt.status]?.label || nt.status, W - 40, y + 14, { align: "right" });
  if (via > 1) {
    doc.setTextColor(200, 40, 40); doc.setFontSize(9);
    doc.text(`${via}ª VIA / REIMPRESSÃO`, 14, y + 16);
  }
  y += 22;
  doc.setDrawColor(...GOLD); doc.line(14, y, W - 14, y); y += 6;

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
    doc.text(doc.splitTextToSize(endereco(u) || "—", W / 2 - 22), x, y + 13.5);
  };
  bloco("ORIGEM", nt.origem, 14);
  bloco("DESTINO", nt.destino, W / 2 + 4);
  y += 24;

  const info: [string, string][] = [
    ["Origem do envio", `${NT_ORIGEM_LABEL[nt.tipo_origem] || nt.tipo_origem} ${nt.origem_numero}`],
    ["Emitida em", dataHora(nt.emitido_em)],
    ["Separado por", nt.separado_por_nome || "—"],
    ["Enviado por", nt.emitido_por_nome || "—"],
    ["Recebido por", nt.recebido_por_nome || "—"],
    ["Recebido em", dataHora(nt.recebido_em)],
  ];
  if (nt.nt_original_numero) info.push(["Substitui/retifica", `${nt.nt_original_numero} — ${nt.motivo_revisao}`]);
  if (nt.status === "CANCELADA") info.push(["Cancelada", `${dataHora(nt.cancelado_em)} — ${nt.cancelado_motivo || ""}`]);
  doc.setFontSize(8.5);
  info.forEach(([l, v], i) => {
    const x = 14 + (i % 2) * (W / 2 - 10); const yy = y + Math.floor(i / 2) * 5.5;
    doc.setTextColor(...MUTED); doc.text(`${l}:`, x, yy);
    doc.setTextColor(...DARK); doc.text(String(v), x + 30, yy);
  });
  y += Math.ceil(info.length / 2) * 5.5 + 4;

  const valores = nt.mostrar_valores;
  const head = [["Código", "Descrição", "Enviado", "Recebido", "Diferença", ...(valores ? ["Custo un.", "Total"] : [])]];
  const body = nt.itens.map((i) => {
    const dif = i.quantidade_recebida == null || i.quantidade_enviada == null ? null : i.quantidade_recebida - i.quantidade_enviada;
    return [
      i.codigo || "—", i.descricao, qtd(i.quantidade_enviada, i.unidade_medida), qtd(i.quantidade_recebida, i.unidade_medida),
      dif == null ? "—" : dif === 0 ? "OK" : qtd(dif, i.unidade_medida),
      ...(valores ? [moeda(i.custo_unitario ?? 0), moeda((i.custo_unitario ?? 0) * (i.quantidade_enviada ?? 0))] : []),
    ];
  });
  autoTable(doc, {
    startY: y, head, body, theme: "grid",
    headStyles: { fillColor: DARK, textColor: [255, 255, 255], fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: DARK }, margin: { left: 14, right: 14 },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = ((doc as any).lastAutoTable?.finalY ?? y) + 8;
  doc.setFontSize(9); doc.setTextColor(...DARK);
  doc.text(`Itens: ${nt.itens.length}`, 14, y);
  y += 24;
  doc.setDrawColor(...MUTED);
  doc.line(14, y, 90, y); doc.line(W - 90, y, W - 14, y);
  doc.setFontSize(8); doc.setTextColor(...MUTED);
  doc.text("Responsável pelo envio", 14, y + 5);
  doc.text("Responsável pelo recebimento", W - 90, y + 5);

  doc.save(`${nt.numero}${via > 1 ? `-via${via}` : ""}.pdf`);
}
