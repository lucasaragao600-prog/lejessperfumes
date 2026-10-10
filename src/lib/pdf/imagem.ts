// Carrega a foto de um produto como Data URL para uso dentro do PDF.
// Usado pelos relatórios em PDF que exibem a imagem do produto.

export interface ImagemPdf {
  data: string;
  w: number;
  h: number;
}

async function loadImageViaCanvas(url: string): Promise<ImagemPdf | null> {
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

export async function urlToDataUrl(url: string): Promise<ImagemPdf | null> {
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
  // 2) Canvas with crossOrigin
  const viaCanvas = await loadImageViaCanvas(url);
  if (viaCanvas) return viaCanvas;
  // 3) Proxy via images.weserv.nl to bypass CORS
  try {
    const cleaned = url.replace(/^https?:\/\//, "");
    const proxied = `https://images.weserv.nl/?url=${encodeURIComponent(cleaned)}`;
    const viaProxy = await loadImageViaCanvas(proxied);
    if (viaProxy) return viaProxy;
  } catch {
    /* ignore */
  }
  console.warn("[PDF] Não foi possível carregar imagem:", url);
  return null;
}

/** Carrega em paralelo as fotos de uma lista de URLs (null vira null). */
export function carregarImagens(urls: (string | undefined)[]): Promise<(ImagemPdf | null)[]> {
  return Promise.all(urls.map((u) => (u ? urlToDataUrl(u) : Promise.resolve(null))));
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
