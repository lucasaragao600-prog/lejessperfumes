import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Reposicao, ReposicaoItem } from "@/hooks/useReposicao";
import { STATUS_META } from "@/hooks/useReposicao";
import { agruparPorCategoria, formatarDataHora } from "@/lib/reposicaoUtils";
import logoLeJess from "@/assets/logo-le-jess.png";

const GOLD: [number, number, number] = [201, 162, 74];
const DARK: [number, number, number] = [25, 25, 28];
const MUTED: [number, number, number] = [120, 120, 125];

async function loadLogo(): Promise<string | null> {
  try {
    const res = await fetch(logoLeJess);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function gerarPdfReposicao(rep: Reposicao, itens: ReposicaoItem[], mostrarConferencia: boolean) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 14;

  const logo = await loadLogo();
  if (logo) {
    try {
      doc.addImage(logo, "PNG", 14, y - 2, 32, 12);
    } catch {
      /* ignora logo inválida */
    }
  }

  doc.setFontSize(16);
  doc.setTextColor(...DARK);
  doc.text("Reposição de Estoque", pageW - 14, y + 4, { align: "right" });
  doc.setFontSize(11);
  doc.setTextColor(...GOLD);
  doc.text(rep.codigo, pageW - 14, y + 11, { align: "right" });
  y += 20;

  doc.setDrawColor(...GOLD);
  doc.line(14, y, pageW - 14, y);
  y += 8;

  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  const info: [string, string][] = [
    ["Origem", rep.origem],
    ["Destino", rep.destino],
    ["Situação", STATUS_META[rep.status]?.label || rep.status],
    ["Criada em", formatarDataHora(rep.created_at)],
    ["Criada por", rep.criado_por_nome || "—"],
    ["Separada por", rep.separado_por_nome || "—"],
    ["Enviada por", `${rep.enviado_por_nome || "—"} ${rep.enviado_em ? `(${formatarDataHora(rep.enviado_em)})` : ""}`],
    ["Recebida por", `${rep.recebido_por_nome || "—"} ${rep.recebido_em ? `(${formatarDataHora(rep.recebido_em)})` : ""}`],
  ];
  info.forEach(([label, valor], i) => {
    const col = i % 2;
    const linha = Math.floor(i / 2);
    const x = 14 + col * (pageW / 2 - 10);
    doc.setTextColor(...MUTED);
    doc.text(`${label}:`, x, y + linha * 6);
    doc.setTextColor(...DARK);
    doc.text(String(valor), x + 26, y + linha * 6);
  });
  y += Math.ceil(info.length / 2) * 6 + 6;

  const grupos = agruparPorCategoria(itens);
  for (const grupo of grupos) {
    const head = mostrarConferencia
      ? [["Produto", "Solicitado", "Separado", "Enviado", "Recebido", "Situação"]]
      : [["Produto", "Quantidade"]];
    const body = grupo.itens.map((item) => {
      if (!mostrarConferencia) return [item.produto_nome, String(item.quantidade_solicitada)];
      const esperado = item.quantidade_enviada ?? item.quantidade_solicitada;
      const recebido = item.quantidade_recebida;
      const situacao =
        recebido == null ? "—" : recebido === esperado ? "OK" : recebido < esperado ? "FALTANDO" : "EXCEDENTE";
      return [
        item.produto_nome,
        String(item.quantidade_solicitada),
        item.quantidade_separada == null ? "—" : String(item.quantidade_separada),
        item.quantidade_enviada == null ? "—" : String(item.quantidade_enviada),
        recebido == null ? "—" : String(recebido),
        situacao,
      ];
    });

    autoTable(doc, {
      startY: y,
      head,
      body,
      theme: "grid",
      headStyles: { fillColor: DARK, textColor: [255, 255, 255], fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: DARK },
      margin: { left: 14, right: 14 },
      didDrawPage: () => undefined,
      willDrawPage: () => undefined,
      showHead: "firstPage",
      tableLineColor: [225, 225, 228],
      didParseCell: () => undefined,
      // título da categoria
      beforePageBreak: () => undefined,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const finalY = (doc as any).lastAutoTable?.finalY ?? y;
    doc.setFontSize(9);
    doc.setTextColor(...GOLD);
    doc.text(grupo.categoria, 14, y - 2);
    y = finalY + 10;
  }

  const total = itens.reduce((s, i) => s + (i.quantidade_enviada ?? i.quantidade_solicitada), 0);
  doc.setFontSize(10);
  doc.setTextColor(...DARK);
  doc.text(`Total de produtos: ${itens.length}`, 14, y);
  doc.text(`Total de unidades: ${total}`, pageW - 14, y, { align: "right" });
  y += 12;

  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text("Observações:", 14, y);
  doc.setDrawColor(210, 210, 214);
  doc.rect(14, y + 2, pageW - 28, 20);
  if (rep.observacoes) {
    doc.setTextColor(...DARK);
    doc.text(doc.splitTextToSize(rep.observacoes, pageW - 34), 17, y + 8);
  }
  y += 32;

  doc.setTextColor(...MUTED);
  doc.line(14, y, 90, y);
  doc.line(pageW - 90, y, pageW - 14, y);
  doc.text("Responsável pelo envio", 14, y + 5);
  doc.text("Responsável pelo recebimento", pageW - 90, y + 5);

  doc.save(`${rep.codigo}.pdf`);
}
