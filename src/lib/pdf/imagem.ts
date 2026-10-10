// Carrega a foto de um produto como Data URL para uso dentro do PDF.
// As fotos são reduzidas antes de entrar no PDF: sem isso um relatório com
// centenas de produtos geraria um arquivo de dezenas de megabytes.

export interface ImagemPdf {
  data: string;
  w: number;
  h: number;
}

/** Lado máximo (px) de uma foto embutida no PDF. 240px basta para as caixas usadas. */
export const LADO_MAX = 240;

function reduzir(
  fonte: CanvasImageSource,
  larguraOriginal: number,
  alturaOriginal: number,
  maxLado: number,
): ImagemPdf | null {
  try {
    const escala = Math.min(1, maxLado / Math.max(larguraOriginal, alturaOriginal || 1));
    const w = Math.max(1, Math.round((larguraOriginal || 1) * escala));
    const h = Math.max(1, Math.round((alturaOriginal || 1) * escala));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    // fundo branco: fotos com transparência não viram mancha preta
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(fonte, 0, 0, w, h);
    return { data: canvas.toDataURL("image/jpeg", 0.72), w, h };
  } catch {
    return null;
  }
}

async function loadImageViaCanvas(url: string, maxLado: number): Promise<ImagemPdf | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const timer = setTimeout(() => resolve(null), 10000);
    img.onload = () => {
      clearTimeout(timer);
      resolve(reduzir(img, img.naturalWidth || 1, img.naturalHeight || 1, maxLado));
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    img.src = url;
  });
}

export async function urlToDataUrl(url: string, maxLado: number = LADO_MAX): Promise<ImagemPdf | null> {
  if (!url) return null;
  // 1) Try fetch
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
      const img = await new Promise<HTMLImageElement | null>((resolve) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = () => resolve(null);
        i.src = dataUrl;
      });
      if (img) {
        const reduzida = reduzir(img, img.naturalWidth || 1, img.naturalHeight || 1, maxLado);
        if (reduzida) return reduzida;
      }
    }
  } catch {
    /* fallthrough */
  }
  // 2) Canvas with crossOrigin
  const viaCanvas = await loadImageViaCanvas(url, maxLado);
  if (viaCanvas) return viaCanvas;
  // 3) Proxy via images.weserv.nl to bypass CORS
  try {
    const cleaned = url.replace(/^https?:\/\//, "");
    const proxied = `https://images.weserv.nl/?url=${encodeURIComponent(cleaned)}`;
    const viaProxy = await loadImageViaCanvas(proxied, maxLado);
    if (viaProxy) return viaProxy;
  } catch {
    /* ignore */
  }
  console.warn("[PDF] Não foi possível carregar imagem:", url);
  return null;
}

/** Carrega em paralelo as fotos de uma lista de URLs (null vira null). */
export function carregarImagens(
  urls: (string | undefined)[],
  maxLado: number = LADO_MAX,
): Promise<(ImagemPdf | null)[]> {
  return Promise.all(urls.map((u) => (u ? urlToDataUrl(u, maxLado) : Promise.resolve(null))));
}

/** Desenha a foto dentro de uma caixa, mantendo a proporção (conter). */
export function desenharFoto(
  doc: jsPDFDoc,
  img: ImagemPdf | null,
  x: number,
  y: number,
  box: number,
): void {
  if (!img) return;
  const ratio = img.w / img.h;
  let w = box;
  let h = box;
  if (ratio > 1) h = box / ratio;
  else w = box * ratio;
  const ox = x + (box - w) / 2;
  const oy = y + (box - h) / 2;
  const fmt = img.data.includes("image/png") ? "PNG" : "JPEG";
  try {
    doc.addImage(img.data, fmt, ox, oy, w, h);
  } catch {
    /* imagem inválida: deixa a caixa vazia */
  }
}

type jsPDFDoc = {
  addImage: (data: string, fmt: string, x: number, y: number, w: number, h: number) => void;
};
