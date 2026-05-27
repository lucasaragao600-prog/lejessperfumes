import jsPDF from "jspdf";
import type { Perfume } from "@/data/mockData";

const GOLD: [number, number, number] = [201, 162, 74];
const DARK: [number, number, number] = [25, 25, 28];
const MUTED: [number, number, number] = [120, 120, 125];
const RED: [number, number, number] = [200, 50, 50];

export interface ProblematicoItem {
  perfume: Perfume;
  estoqueAtual: number;
  qtdVendida: number;
  diasSemVenda: number | null;
  flags: string[];
  sugestoes: string[];
  score: number;
}

export interface ProdutosProblematicosOptions {
  itens: ProblematicoItem[];
  incluirSugestoes: boolean;
  diasMinimoSemVenda?: number | null;
  loja?: string;
}

async function urlToDataUrl(url: string): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    const dim = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.width, h: img.height });
      img.onerror = () => resolve({ w: 1, h: 1 });
      img.src = dataUrl;
    });
    return { data: dataUrl, w: dim.w, h: dim.h };
  } catch {
    return null;
  }
}

export async function gerarProdutosProblematicosPdf(
  opts: ProdutosProblematicosOptions,
): Promise<jsPDF> {
  const { itens, incluirSugestoes, diasMinimoSemVenda, loja } = opts;
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
  doc.text("Produtos Problemáticos", marginX, 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(220, 220, 220);
  const subParts: string[] = [];
  if (loja) subParts.push(`Loja: ${loja}`);
  if (diasMinimoSemVenda != null) subParts.push(`A partir de ${diasMinimoSemVenda}d sem venda`);
  subParts.push(`${itens.length} produto(s)`);
  subParts.push(
    new Date().toLocaleString("pt-BR", { timeZone: "America/Manaus" }),
  );
  doc.text(subParts.join("  ·  "), marginX, 17);

  let y = 30;

  // Pre-fetch images in parallel
  const imgs = await Promise.all(
    itens.map((x) => (x.perfume.imageUrl ? urlToDataUrl(x.perfume.imageUrl) : Promise.resolve(null))),
  );

  const cardH = 42;
  for (let i = 0; i < itens.length; i++) {
    const x = itens[i];

    if (y + cardH > pageH - 12) {
      doc.addPage();
      y = 20;
    }

    // Card border
    doc.setDrawColor(220, 220, 220);
    doc.setFillColor(252, 252, 252);
    doc.roundedRect(marginX, y, pageW - marginX * 2, cardH, 2, 2, "FD");
    // Red accent left
    doc.setFillColor(...RED);
    doc.rect(marginX, y, 1.2, cardH, "F");

    // Image
    const imgX = marginX + 4;
    const imgY = y + 4;
    const imgSize = 34;
    doc.setFillColor(240, 240, 240);
    doc.rect(imgX, imgY, imgSize, imgSize, "F");
    const img = imgs[i];
    if (img) {
      try {
        const ratio = img.w / img.h;
        let w = imgSize;
        let h = imgSize;
        if (ratio > 1) h = imgSize / ratio;
        else w = imgSize * ratio;
        const ox = imgX + (imgSize - w) / 2;
        const oy = imgY + (imgSize - h) / 2;
        const fmt = img.data.includes("image/png") ? "PNG" : "JPEG";
        doc.addImage(img.data, fmt, ox, oy, w, h);
      } catch {
        /* ignore */
      }
    } else {
      doc.setTextColor(...MUTED);
      doc.setFontSize(7);
      doc.text("sem foto", imgX + imgSize / 2, imgY + imgSize / 2, { align: "center" });
    }

    // Texts
    const tx = imgX + imgSize + 5;
    const tw = pageW - tx - marginX - 22;
    doc.setTextColor(...DARK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    const nome = doc.splitTextToSize(x.perfume.nome || "", tw)[0];
    doc.text(nome, tx, y + 8);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    const dias = x.diasSemVenda !== null ? `${x.diasSemVenda}d sem venda` : "Nunca vendido";
    doc.text(
      `${x.perfume.marca} · ${x.perfume.codigo}`,
      tx,
      y + 13,
    );
    doc.text(
      `Estoque: ${x.estoqueAtual}  ·  Vendidos: ${x.qtdVendida}  ·  ${dias}`,
      tx,
      y + 17.5,
    );

    // Flags
    doc.setFontSize(7.5);
    doc.setTextColor(...RED);
    const flagsTxt = x.flags.join("  •  ");
    const flagsLines = doc.splitTextToSize(flagsTxt, tw);
    doc.text(flagsLines.slice(0, 2), tx, y + 23);

    // Sugestões
    if (incluirSugestoes && x.sugestoes.length > 0) {
      doc.setTextColor(...GOLD);
      const sugTxt = "Sugestões: " + x.sugestoes.join("; ");
      const sugLines = doc.splitTextToSize(sugTxt, tw);
      doc.text(sugLines.slice(0, 2), tx, y + 32);
    }

    // Score
    doc.setTextColor(...MUTED);
    doc.setFontSize(7);
    doc.text("RISCO", pageW - marginX - 4, y + 8, { align: "right" });
    doc.setTextColor(...RED);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(String(x.score), pageW - marginX - 4, y + 17, { align: "right" });
    doc.setFont("helvetica", "normal");

    y += cardH + 3;
  }

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
