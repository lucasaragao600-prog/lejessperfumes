import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { carregarImagens, desenharFoto } from "./imagem";

const GOLD: [number, number, number] = [201, 162, 74];
const DARK: [number, number, number] = [25, 25, 28];
const MUTED: [number, number, number] = [120, 120, 125];

export interface VendidoPdfItem {
  codigo: string;
  nome: string;
  marca: string;
  tipo: string;
  concentracao: string;
  volume: string | number;
  qtdVendida: number;
  receita: number;
  ultimaVenda: string | null;
  estoqueAtual: number;
  imageUrl?: string;
}

export interface VendidosPdfOptions {
  itens: VendidoPdfItem[];
  dInicio: string;
  dFim: string;
  ordem: "qtd" | "receita";
  loja?: string;
}

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtData = (d: string | null) => (d ? d.split("-").reverse().join("/") : "—");

const FOTO_CX = 9; // lado da foto em mm

export async function gerarVendidosPdf(opts: VendidosPdfOptions): Promise<jsPDF> {
  const { itens, dInicio, dFim, ordem, loja } = opts;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 14;

  // Header
  doc.setFillColor(...DARK);
  doc.rect(0, 0, pageW, 22, "F");
  doc.setTextColor(...GOLD);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Produtos Vendidos", marginX, 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(220, 220, 220);
  const subParts: string[] = [`Período: ${fmtData(dInicio)} a ${fmtData(dFim)}`];
  if (loja) subParts.push(`Loja: ${loja}`);
  subParts.push(ordem === "qtd" ? "Ordenado por quantidade" : "Ordenado por receita");
  subParts.push(`${itens.length} produto(s)`);
  subParts.push(new Date().toLocaleString("pt-BR", { timeZone: "America/Manaus" }));
  doc.text(subParts.join("  ·  "), marginX, 17);

  const totalQtd = itens.reduce((s, x) => s + x.qtdVendida, 0);
  const totalReceita = itens.reduce((s, x) => s + x.receita, 0);

  // Fotos: baixa em paralelo antes de montar a tabela
  const fotos = await carregarImagens(itens.map((x) => x.imageUrl));

  autoTable(doc, {
    startY: 28,
    head: [[
      "Foto",
      "#",
      "Produto",
      "Qtd",
      "Receita",
      "Ticket médio",
      "Última venda",
      "Estoque",
    ]],
    body: itens.map((x, i) => [
      "",
      String(i + 1),
      `${x.nome}\n${x.marca} · ${x.codigo} · ${x.concentracao} ${x.volume}`,
      String(x.qtdVendida),
      fmtBRL(x.receita),
      x.qtdVendida > 0 ? fmtBRL(x.receita / x.qtdVendida) : "—",
      fmtData(x.ultimaVenda),
      String(x.estoqueAtual),
    ]),
    foot: [[
      "",
      "",
      "TOTAL",
      String(totalQtd),
      fmtBRL(totalReceita),
      totalQtd > 0 ? fmtBRL(totalReceita / totalQtd) : "—",
      "",
      "",
    ]],
    theme: "grid",
    styles: {
      fontSize: 8,
      cellPadding: 1.8,
      lineColor: [225, 225, 225],
      lineWidth: 0.1,
      textColor: DARK,
      minCellHeight: FOTO_CX + 3,
    },
    headStyles: { fillColor: DARK, textColor: GOLD, fontStyle: "bold", fontSize: 8 },
    footStyles: { fillColor: [240, 240, 240], textColor: DARK, fontStyle: "bold", fontSize: 8 },
    columnStyles: {
      0: { cellWidth: FOTO_CX + 4, cellPadding: 1.5 },
      1: { cellWidth: 8, halign: "right", textColor: MUTED },
      3: { cellWidth: 13, halign: "center", fontStyle: "bold" },
      4: { cellWidth: 25, halign: "right" },
      5: { cellWidth: 23, halign: "right" },
      6: { cellWidth: 20, halign: "right" },
      7: { cellWidth: 15, halign: "center" },
    },
    margin: { left: marginX, right: marginX, top: 26 },
    didParseCell: (data) => {
      // linha 2 do corpo: subtítulo do produto em cinza
      if (data.section === "body" && data.column.index === 2 && typeof data.cell.raw === "string" && data.cell.raw.includes("\n")) {
        data.cell.styles.fontSize = 7;
        data.cell.styles.textColor = MUTED;
      }
    },
    didDrawCell: (data) => {
      if (data.section !== "body" || data.column.index !== 0) return;
      const img = fotos[data.row.index];
      const cx = data.cell.x + 1.5;
      const cy = data.cell.y + 1.5;
      if (!img) {
        // sem foto: caixa clara para não parecer impressão cortada
        doc.setDrawColor(228, 228, 228);
        doc.setFillColor(247, 247, 247);
        doc.roundedRect(cx, cy, FOTO_CX, FOTO_CX, 1, 1, "FD");
        return;
      }
      desenharFoto(doc, img, cx, cy, FOTO_CX);
    },
  });

  // Footer
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`Página ${p} de ${total}`, pageW - marginX, pageH - 6, { align: "right" });
  }

  return doc;
}
