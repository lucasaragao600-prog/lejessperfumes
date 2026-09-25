import jsPDF from "jspdf";
import type { Perfume } from "@/data/mockData";

const GOLD: [number, number, number] = [201, 162, 74];
const DARK: [number, number, number] = [25, 25, 28];
const MUTED: [number, number, number] = [110, 110, 118];

export interface ListaProdutosOptions {
  itens: Perfume[];
  titulo?: string;
  subtitulo?: string;
  depositos: string[];
  tiposConfig?: Record<string, string>;
  concentracoesConfig?: Record<string, string>;
  casasMap?: Map<string, string>;
}

async function loadImageViaCanvas(url: string): Promise<{ data: string; w: number; h: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const timer = setTimeout(() => resolve(null), 10000);
    img.onload = () => {
      clearTimeout(timer);
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || 1;
        canvas.height = img.naturalHeight || 1;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0);
        const data = canvas.toDataURL("image/jpeg", 0.85);
        resolve({ data, w: canvas.width, h: canvas.height });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    img.src = url;
  });
}

async function urlToDataUrl(url: string): Promise<{ data: string; w: number; h: number } | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { mode: "cors", cache: "force-cache" });
    if (res.ok) {
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
    }
  } catch {
    /* fallthrough */
  }
  const viaCanvas = await loadImageViaCanvas(url);
  if (viaCanvas) return viaCanvas;
  try {
    const cleaned = url.replace(/^https?:\/\//, "");
    const proxied = `https://images.weserv.nl/?url=${encodeURIComponent(cleaned)}`;
    const viaProxy = await loadImageViaCanvas(proxied);
    if (viaProxy) return viaProxy;
  } catch {
    /* ignore */
  }
  return null;
}

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export async function gerarListaProdutosPdf(opts: ListaProdutosOptions): Promise<jsPDF> {
  const {
    itens,
    titulo = "Lista de Produtos",
    subtitulo,
    depositos,
    tiposConfig = {},
    concentracoesConfig = {},
    casasMap,
  } = opts;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 12;

  // Header
  doc.setFillColor(...DARK);
  doc.rect(0, 0, pageW, 22, "F");
  doc.setTextColor(...GOLD);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(titulo, marginX, 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(220, 220, 220);
  const sub: string[] = [];
  if (subtitulo) sub.push(subtitulo);
  sub.push(`${itens.length} produto(s)`);
  sub.push(new Date().toLocaleString("pt-BR", { timeZone: "America/Manaus" }));
  doc.text(sub.join("  ·  "), marginX, 17);

  let y = 28;

  // Pre-fetch images in parallel
  const imgs = await Promise.all(
    itens.map((p) => (p.imageUrl ? urlToDataUrl(p.imageUrl) : Promise.resolve(null))),
  );

  const cardH = 46;
  for (let i = 0; i < itens.length; i++) {
    const p = itens[i];

    if (y + cardH > pageH - 12) {
      doc.addPage();
      y = 16;
    }

    // Card
    doc.setDrawColor(222, 222, 222);
    doc.setFillColor(252, 252, 252);
    doc.roundedRect(marginX, y, pageW - marginX * 2, cardH, 2, 2, "FD");
    doc.setFillColor(...GOLD);
    doc.rect(marginX, y, 1.2, cardH, "F");

    // Image
    const imgX = marginX + 4;
    const imgY = y + 4;
    const imgSize = 38;
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

    // Text column
    const tx = imgX + imgSize + 4;
    const tw = pageW - tx - marginX - 3;
    const tipoNome = tiposConfig[p.tipo] || p.tipo;
    const concNome = concentracoesConfig[p.concentracao] || p.concentracao;
    const casaNome = casasMap?.get(p.casaSigla) || p.casaSigla;

    doc.setTextColor(...DARK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.text(doc.splitTextToSize(p.nome || "", tw)[0], tx, y + 7);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.6);
    doc.setTextColor(...MUTED);
    const linhas: string[] = [
      `SKU: ${p.codigo}${p.codigoBarras ? `   ·   EAN: ${p.codigoBarras}` : ""}`,
      `${p.marca}  ·  ${casaNome}  ·  ${tipoNome}  ·  ${p.classificacao || "-"}`,
      `${concNome}  ·  ${p.tamanho}  ·  ${p.volume}ml`,
      `Custo: ${brl(p.custo)}   ·   Custo médio: ${brl(p.custoMedio || 0)}   ·   Venda: ${brl(p.precoVenda)}`,
    ];
    linhas.forEach((l, idx) => {
      doc.text(doc.splitTextToSize(l, tw)[0], tx, y + 12.5 + idx * 4.2);
    });

    // Estoque por unidade
    const total = Object.values(p.estoques || {}).reduce((a, b) => a + b, 0);
    const estoqueParts = depositos.map((d) => `${d}: ${p.estoques?.[d] ?? 0}`);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...DARK);
    doc.setFontSize(7.6);
    doc.text(
      doc.splitTextToSize(
        `Estoque — ${estoqueParts.join("   ·   ")}   ·   Total: ${total}   ·   Mín: ${p.estoqueMinimo}`,
        tw,
      )[0],
      tx,
      y + 12.5 + linhas.length * 4.2,
    );
    doc.setFont("helvetica", "normal");

    y += cardH + 2.5;
  }

  // Footer
  const totalPaginas = doc.getNumberOfPages();
  for (let pg = 1; pg <= totalPaginas; pg++) {
    doc.setPage(pg);
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`Página ${pg} de ${totalPaginas}`, pageW - marginX, pageH - 6, { align: "right" });
  }

  return doc;
}
