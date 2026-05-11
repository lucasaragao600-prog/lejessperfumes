// Donut chart com legenda lateral (estilo dashboard).
export interface PieSlice {
  label: string;
  value: number;
  color: string;
}

export function renderPieChartDataUrl(slices: PieSlice[], opts?: { size?: number; total?: number }): string {
  const width = opts?.size ?? 900;
  const height = Math.round(width * 0.5);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  // Fundo escuro (estilo card)
  ctx.fillStyle = "#1A1A1F";
  ctx.fillRect(0, 0, width, height);

  const data = slices.filter((s) => s.value > 0);
  const total = opts?.total ?? data.reduce((s, x) => s + x.value, 0);

  const cy = height / 2;
  const radius = Math.min(height / 2 - 30, 170);
  const cx = radius + 40;
  const innerRadius = radius * 0.58;

  if (total <= 0) {
    ctx.fillStyle = "#9CA3AF";
    ctx.font = "20px sans-serif";
    ctx.fillText("Sem dados de pagamento", 30, cy);
    return canvas.toDataURL("image/png");
  }

  // Donut
  let start = -Math.PI / 2;
  for (const s of data) {
    const angle = (s.value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(start) * innerRadius, cy + Math.sin(start) * innerRadius);
    ctx.arc(cx, cy, radius, start, start + angle);
    ctx.arc(cx, cy, innerRadius, start + angle, start, true);
    ctx.closePath();
    ctx.fillStyle = s.color;
    ctx.fill();
    ctx.strokeStyle = "#1A1A1F";
    ctx.lineWidth = 3;
    ctx.stroke();
    start += angle;
  }

  // Total abaixo do donut
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 20px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(`Total: ${total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`, cx, cy + radius + 30);

  // Legenda à direita
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const legendX = cx + radius + 60;
  const lineH = 56;
  const legendTotalH = data.length * lineH;
  let legendY = Math.max(40, (height - legendTotalH) / 2 + lineH / 2);

  for (const s of data) {
    // Bolinha colorida
    ctx.beginPath();
    ctx.arc(legendX, legendY, 7, 0, Math.PI * 2);
    ctx.fillStyle = s.color;
    ctx.fill();

    // Valor (branco, bold)
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 22px sans-serif";
    const valor = s.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    ctx.fillText(valor, legendX + 18, legendY - 10);

    // Label (cinza, menor)
    ctx.fillStyle = "#9CA3AF";
    ctx.font = "16px sans-serif";
    ctx.fillText(s.label, legendX + 18, legendY + 12);

    legendY += lineH;
  }

  return canvas.toDataURL("image/png");
}
