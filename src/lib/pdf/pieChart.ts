// Desenha um gráfico de pizza em canvas e retorna dataURL para inserir no jsPDF.
export interface PieSlice {
  label: string;
  value: number;
  color: string; // hex
}

export function renderPieChartDataUrl(slices: PieSlice[], opts?: { size?: number }): string {
  const size = opts?.size ?? 520;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = Math.round(size * 0.6);
  const ctx = canvas.getContext("2d")!;

  // Background transparente
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const total = slices.reduce((s, x) => s + (x.value > 0 ? x.value : 0), 0);
  const cy = canvas.height / 2;
  const radius = Math.min(canvas.height / 2 - 10, 140);
  const cx = radius + 20;

  if (total <= 0) {
    ctx.fillStyle = "#9CA3AF";
    ctx.font = "16px sans-serif";
    ctx.fillText("Sem dados de pagamento", 20, cy);
    return canvas.toDataURL("image/png");
  }

  let start = -Math.PI / 2;
  for (const s of slices) {
    if (s.value <= 0) continue;
    const angle = (s.value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, start, start + angle);
    ctx.closePath();
    ctx.fillStyle = s.color;
    ctx.fill();
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 2;
    ctx.stroke();
    start += angle;
  }

  // Legenda
  const legendX = cx + radius + 30;
  let legendY = 30;
  ctx.font = "14px sans-serif";
  ctx.textBaseline = "middle";
  for (const s of slices) {
    if (s.value <= 0) continue;
    ctx.fillStyle = s.color;
    ctx.fillRect(legendX, legendY - 8, 16, 16);
    ctx.fillStyle = "#111111";
    const pct = ((s.value / total) * 100).toFixed(1);
    const valor = s.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    ctx.fillText(`${s.label} — ${valor} (${pct}%)`, legendX + 24, legendY);
    legendY += 26;
  }

  return canvas.toDataURL("image/png");
}
