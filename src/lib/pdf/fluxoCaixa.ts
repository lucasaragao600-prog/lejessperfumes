import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Venda, Perfume, Deposito } from "@/data/mockData";
import type { VendaPagamento } from "@/hooks/useVendas";
import type { ConfiguracaoFiscal } from "@/hooks/useNfce";
import { renderPieChartDataUrl, type PieSlice } from "./pieChart";

const GOLD: [number, number, number] = [201, 162, 74];
const DARK: [number, number, number] = [30, 30, 35];
const RED: [number, number, number] = [200, 50, 50];
const AMBER: [number, number, number] = [220, 150, 30];

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

function fmtData(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function agoraManaus() {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Manaus",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date());
}

function descricaoProduto(p: Perfume | undefined, fallback: string, concNome: (s: string) => string) {
  if (!p) return fallback;
  const partes = [p.codigo, p.marca, p.nome, concNome(p.concentracao), `${p.volume}ml`].filter(Boolean);
  return partes.join(" - ");
}

function estoqueDaLoja(p: Perfume, loja: Deposito) {
  return p.estoques?.[loja] ?? 0;
}

function header(
  doc: jsPDF,
  config: ConfiguracaoFiscal | null | undefined,
  loja: Deposito,
  titulo: string,
  periodo: string,
) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(...DARK);
  doc.rect(0, 0, w, 26, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(config?.nomeFantasia || config?.razaoSocial || "Le Jess PDV ERP", 12, 11);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Loja: ${loja}`, 12, 17);
  doc.text(`Gerado em: ${agoraManaus()}`, w - 12, 17, { align: "right" });
  doc.text(periodo, w - 12, 11, { align: "right" });

  // Linha dourada
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.8);
  doc.line(0, 26, w, 26);

  // Título
  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(titulo, 12, 38);
}

function sectionTitle(doc: jsPDF, y: number, label: string): number {
  doc.setFillColor(...GOLD);
  doc.rect(12, y, 4, 6, "F");
  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(label, 20, y + 5);
  return y + 10;
}

function ensureSpace(doc: jsPDF, y: number, needed = 30): number {
  const h = doc.internal.pageSize.getHeight();
  if (y + needed > h - 12) {
    doc.addPage();
    return 20;
  }
  return y;
}

function footerPaginas(doc: jsPDF) {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(`Página ${i} de ${total}`, w - 12, h - 6, { align: "right" });
  }
}

export interface FluxoCaixaInput {
  loja: Deposito;
  vendas: Venda[];
  pagamentos: VendaPagamento[];
  perfumes: Perfume[];
  config: ConfiguracaoFiscal | null | undefined;
  concNome: (sigla: string) => string;
}

/* ============================================================
   RELATÓRIO DIÁRIO
   ============================================================ */
export function gerarFluxoCaixaDiario(params: FluxoCaixaInput & { data: string }): jsPDF {
  const { loja, vendas, pagamentos, perfumes, config, concNome, data } = params;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const perfumeById = new Map(perfumes.map((p) => [p.id, p]));

  // Filtrar vendas do dia/loja
  const vendasDoDia = vendas.filter((v) => v.data === data && v.deposito === loja);
  const grupos = new Set(vendasDoDia.map((v) => v.grupoVenda).filter(Boolean) as string[]);

  // Pagamentos relevantes
  const pagsDoDia = pagamentos.filter((p) => grupos.has(p.grupoVenda));

  header(doc, config, loja, "Relatório de Fluxo de Caixa — Diário", `Data: ${fmtData(data)}`);
  let y = 46;

  // ============= PARTE 1 — MODALIDADES =============
  y = sectionTitle(doc, y, "Parte 1 — Resumo por modalidade de pagamento");

  type Linha = { modalidade: string; bandeira: string; qtd: number; total: number };
  const linhas: Linha[] = [];
  const acumPorModal = new Map<string, number>();

  const grupoChave = (tipo: string, bandeira: string) => {
    if (tipo === "Crédito" || tipo === "Débito") return `${tipo} — ${bandeira || "N/A"}`;
    return tipo;
  };

  const mapAgrup = new Map<string, { modalidade: string; bandeira: string; qtd: number; total: number }>();

  // Decide POR GRUPO: se existe split registrado para o grupo, usa o split; senão usa o tipo da própria venda.
  // Garante que a soma das modalidades = faturamento (vendas.total).
  const pagsPorGrupo = new Map<string, typeof pagsDoDia>();
  for (const p of pagsDoDia) {
    const arr = pagsPorGrupo.get(p.grupoVenda) || [];
    arr.push(p);
    pagsPorGrupo.set(p.grupoVenda, arr);
  }

  // Soma dos totais de venda por grupo (para alocar split proporcionalmente quando necessário)
  const totalPorGrupo = new Map<string, number>();
  for (const v of vendasDoDia) {
    if (!v.grupoVenda) continue;
    totalPorGrupo.set(v.grupoVenda, (totalPorGrupo.get(v.grupoVenda) || 0) + v.total);
  }

  const gruposProcessados = new Set<string>();
  for (const v of vendasDoDia) {
    const grupo = v.grupoVenda;
    // Se grupo já processado via split, pula (split cobre o grupo inteiro)
    if (grupo && gruposProcessados.has(grupo)) continue;

    const splits = grupo ? pagsPorGrupo.get(grupo) : undefined;
    if (splits && splits.length > 0) {
      // Usa pagamentos do grupo. Reconcilia com total do grupo se houver diferença (arredondamento/legado).
      const somaSplit = splits.reduce((s, p) => s + (Number(p.valor) || 0), 0);
      const totalGrupo = totalPorGrupo.get(grupo!) || somaSplit;
      const fator = somaSplit > 0 ? totalGrupo / somaSplit : 1;
      for (const p of splits) {
        const key = grupoChave(p.tipoPagamento, p.bandeira);
        const cur = mapAgrup.get(key) || {
          modalidade: p.tipoPagamento,
          bandeira: p.tipoPagamento === "Crédito" || p.tipoPagamento === "Débito" ? p.bandeira || "N/A" : "—",
          qtd: 0,
          total: 0,
        };
        cur.qtd += 1;
        cur.total += (Number(p.valor) || 0) * fator;
        mapAgrup.set(key, cur);
      }
      gruposProcessados.add(grupo!);
    } else {
      // Sem split: usa tipo_pagamento/bandeira da própria venda
      const key = grupoChave(v.tipoPagamento, v.bandeira);
      const cur = mapAgrup.get(key) || {
        modalidade: v.tipoPagamento,
        bandeira: v.tipoPagamento === "Crédito" || v.tipoPagamento === "Débito" ? v.bandeira || "N/A" : "—",
        qtd: 0,
        total: 0,
      };
      cur.qtd += 1;
      cur.total += v.total;
      mapAgrup.set(key, cur);
    }
  }

  for (const l of mapAgrup.values()) {
    linhas.push(l);
    acumPorModal.set(l.modalidade, (acumPorModal.get(l.modalidade) || 0) + l.total);
  }

  linhas.sort((a, b) => a.modalidade.localeCompare(b.modalidade) || a.bandeira.localeCompare(b.bandeira));
  const totalGeral = linhas.reduce((s, l) => s + l.total, 0);

  autoTable(doc, {
    startY: y,
    head: [["Modalidade", "Bandeira", "Qtd. transações", "Total (R$)"]],
    body: [
      ...linhas.map((l) => [l.modalidade, l.bandeira, String(l.qtd), fmtBRL(l.total)]),
      [
        { content: "TOTAL GERAL", colSpan: 3, styles: { fontStyle: "bold", halign: "right", fillColor: GOLD, textColor: 255 } },
        { content: fmtBRL(totalGeral), styles: { fontStyle: "bold", fillColor: GOLD, textColor: 255 } },
      ],
    ],
    headStyles: { fillColor: DARK, textColor: 255 },
    styles: { fontSize: 9 },
    columnStyles: { 2: { halign: "right" }, 3: { halign: "right" } },
    margin: { left: 12, right: 12 },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // Gráfico de pizza
  const palette: Record<string, string> = {
    "Crédito": "#C9A24A",
    "Débito": "#2563EB",
    "Pix": "#10B981",
    "Dinheiro": "#22C55E",
    "Crediário": "#F97316",
    "Conta Assinada": "#8B5CF6",
  };
  const slices: PieSlice[] = Array.from(acumPorModal.entries())
    .filter(([, v]) => v > 0)
    .map(([label, value]) => ({ label, value, color: palette[label] || "#6B7280" }));
  const pieDataUrl = renderPieChartDataUrl(slices);
  y = ensureSpace(doc, y, 80);
  doc.addImage(pieDataUrl, "PNG", 12, y, 186, 70);
  y += 76;

  // ============= PARTE 2 — POR VENDEDOR =============
  y = ensureSpace(doc, y, 30);
  y = sectionTitle(doc, y, "Parte 2 — Vendas por vendedor");

  const porVend = new Map<string, Venda[]>();
  for (const v of vendasDoDia) {
    const k = v.vendedora || "—";
    if (!porVend.has(k)) porVend.set(k, []);
    porVend.get(k)!.push(v);
  }
  const vendedoresOrdenados = Array.from(porVend.entries())
    .map(([nome, vs]) => ({
      nome,
      vendas: vs,
      qtdProdutos: vs.reduce((s, v) => s + v.quantidade, 0),
      valorTotal: vs.reduce((s, v) => s + v.total, 0),
    }))
    .sort((a, b) => b.qtdProdutos - a.qtdProdutos);

  if (!vendedoresOrdenados.length) {
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text("Nenhuma venda registrada nesta data.", 12, y);
    y += 8;
  }

  for (const v of vendedoresOrdenados) {
    y = ensureSpace(doc, y, 40);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(20, 20, 20);
    doc.text(`Vendedor: ${v.nome}`, 12, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(
      `${v.qtdProdutos} produto(s) · ${fmtBRL(v.valorTotal)}`,
      doc.internal.pageSize.getWidth() - 12,
      y,
      { align: "right" },
    );
    y += 3;

    // Agrupar por produto
    const mapProd = new Map<string, { desc: string; qtd: number; valorUnit: number; total: number }>();
    for (const venda of v.vendas) {
      const p = perfumeById.get(venda.perfumeId);
      const desc = descricaoProduto(p, venda.perfumeNome, concNome);
      const cur = mapProd.get(venda.perfumeId) || { desc, qtd: 0, valorUnit: venda.precoUnitario, total: 0 };
      cur.qtd += venda.quantidade;
      cur.total += venda.total;
      mapProd.set(venda.perfumeId, cur);
    }

    autoTable(doc, {
      startY: y + 2,
      head: [["Produto", "Qtd", "Valor unit.", "Total"]],
      body: Array.from(mapProd.values()).map((r) => [
        r.desc,
        String(r.qtd),
        fmtBRL(r.valorUnit),
        fmtBRL(r.total),
      ]),
      headStyles: { fillColor: DARK, textColor: 255 },
      styles: { fontSize: 8 },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
      margin: { left: 12, right: 12 },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ============= PARTE 3 — PERFUMES VENDIDOS =============
  y = ensureSpace(doc, y, 40);
  y = sectionTitle(doc, y, "Parte 3 — Perfumes vendidos no dia");

  const mapAll = new Map<string, { desc: string; qtd: number; somaTotal: number }>();
  for (const venda of vendasDoDia) {
    const p = perfumeById.get(venda.perfumeId);
    const desc = descricaoProduto(p, venda.perfumeNome, concNome);
    const cur = mapAll.get(venda.perfumeId) || { desc, qtd: 0, somaTotal: 0 };
    cur.qtd += venda.quantidade;
    cur.somaTotal += venda.total;
    mapAll.set(venda.perfumeId, cur);
  }
  const linhasProd = Array.from(mapAll.values()).sort((a, b) => b.qtd - a.qtd);
  const somaQtd = linhasProd.reduce((s, x) => s + x.qtd, 0);
  const somaValor = linhasProd.reduce((s, x) => s + x.somaTotal, 0);

  autoTable(doc, {
    startY: y,
    head: [["Descrição", "Qtd", "Valor unit. médio", "Total"]],
    body: [
      ...linhasProd.map((r) => [
        r.desc,
        String(r.qtd),
        fmtBRL(r.qtd > 0 ? r.somaTotal / r.qtd : 0),
        fmtBRL(r.somaTotal),
      ]),
      [
        { content: `Soma total: ${somaQtd} produto(s)`, colSpan: 3, styles: { fontStyle: "bold", halign: "right", fillColor: GOLD, textColor: 255 } },
        { content: fmtBRL(somaValor), styles: { fontStyle: "bold", fillColor: GOLD, textColor: 255 } },
      ],
    ],
    headStyles: { fillColor: DARK, textColor: 255 },
    styles: { fontSize: 8 },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
    margin: { left: 12, right: 12 },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // ============= DESCONTOS & ACRÉSCIMOS =============
  y = ensureSpace(doc, y, 40);
  y = sectionTitle(doc, y, "Descontos e acréscimos aplicados");

  const ajustes = vendasDoDia.filter((v) => Number(v.desconto) > 0);
  const totalDescontos = ajustes
    .filter((v) => v.tipoAjuste !== "acrescimo")
    .reduce((s, v) => s + Number(v.desconto), 0);
  const totalAcrescimos = ajustes
    .filter((v) => v.tipoAjuste === "acrescimo")
    .reduce((s, v) => s + Number(v.desconto), 0);

  if (!ajustes.length) {
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text("Nenhum desconto ou acréscimo aplicado nesta data.", 12, y);
    y += 8;
  } else {
    autoTable(doc, {
      startY: y,
      head: [["Vendedor", "Produto", "Tipo", "Valor"]],
      body: [
        ...ajustes.map((v) => {
          const p = perfumeById.get(v.perfumeId);
          return [
            v.vendedora || "—",
            descricaoProduto(p, v.perfumeNome, concNome),
            v.tipoAjuste === "acrescimo" ? "Acréscimo" : "Desconto",
            fmtBRL(Number(v.desconto)),
          ];
        }),
        [
          { content: "Total descontos", colSpan: 3, styles: { fontStyle: "bold", halign: "right", fillColor: RED, textColor: 255 } },
          { content: `- ${fmtBRL(totalDescontos)}`, styles: { fontStyle: "bold", fillColor: RED, textColor: 255 } },
        ],
        [
          { content: "Total acréscimos", colSpan: 3, styles: { fontStyle: "bold", halign: "right", fillColor: GOLD, textColor: 255 } },
          { content: `+ ${fmtBRL(totalAcrescimos)}`, styles: { fontStyle: "bold", fillColor: GOLD, textColor: 255 } },
        ],
      ],
      headStyles: { fillColor: DARK, textColor: 255 },
      styles: { fontSize: 8 },
      columnStyles: { 3: { halign: "right" } },
      margin: { left: 12, right: 12 },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ============= PARTE 4 — REPOSIÇÃO =============
  y = ensureSpace(doc, y, 40);
  y = sectionTitle(doc, y, "Reposição de Estoque");

  const itensReposicao = perfumes
    .map((p) => ({
      perfume: p,
      atual: estoqueDaLoja(p, loja),
      minimo: p.estoqueMinimo || 0,
    }))
    .filter((x) => x.atual === 0 || (x.minimo > 0 && x.atual <= x.minimo))
    .sort((a, b) => a.atual - b.atual || (a.perfume.nome || "").localeCompare(b.perfume.nome || ""));

  if (!itensReposicao.length) {
    doc.setFontSize(10);
    doc.setTextColor(60, 140, 60);
    doc.text("Nenhum item requer reposição nesta loja.", 12, y);
  } else {
    autoTable(doc, {
      startY: y,
      head: [["Produto", "Estoque atual", "Mínimo", "Prioridade"]],
      body: itensReposicao.map((x) => [
        descricaoProduto(x.perfume, x.perfume.nome, concNome),
        String(x.atual),
        String(x.minimo),
        x.atual === 0 ? "REPOR URGENTE" : "ATENÇÃO",
      ]),
      headStyles: { fillColor: DARK, textColor: 255 },
      styles: { fontSize: 8 },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "center", fontStyle: "bold" } },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 3) {
          const txt = String(data.cell.raw);
          if (txt === "REPOR URGENTE") {
            data.cell.styles.fillColor = RED;
            data.cell.styles.textColor = 255;
          } else if (txt === "ATENÇÃO") {
            data.cell.styles.fillColor = AMBER;
            data.cell.styles.textColor = 255;
          }
        }
      },
      margin: { left: 12, right: 12 },
    });
  }

  footerPaginas(doc);
  return doc;
}

/* ============================================================
   RELATÓRIO QUINZENAL / MENSAL — base compartilhada
   ============================================================ */
function rangeReport(
  params: FluxoCaixaInput & { dataInicio: string; dataFim: string; titulo: string; periodoLabel: string; modo: "quinzenal" | "mensal" },
): jsPDF {
  const { loja, vendas, pagamentos, perfumes, config, concNome, dataInicio, dataFim, titulo, periodoLabel, modo } = params;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const perfumeById = new Map(perfumes.map((p) => [p.id, p]));

  const vendasPeriodo = vendas.filter(
    (v) => v.deposito === loja && v.data >= dataInicio && v.data <= dataFim,
  );

  header(doc, config, loja, titulo, periodoLabel);
  let y = 46;

  const faturamento = vendasPeriodo.reduce((s, v) => s + v.total, 0);
  const totalProdutos = vendasPeriodo.reduce((s, v) => s + v.quantidade, 0);

  // Card de faturamento
  doc.setFillColor(...DARK);
  doc.roundedRect(12, y, 186, 18, 2, 2, "F");
  doc.setTextColor(...GOLD);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("FATURAMENTO TOTAL", 18, y + 7);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text(fmtBRL(faturamento), 18, y + 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`${totalProdutos} produto(s) vendido(s)`, 192, y + 14, { align: "right" });
  y += 24;

  // Modalidades de pagamento
  const grupos = new Set(vendasPeriodo.map((v) => v.grupoVenda).filter(Boolean) as string[]);
  const pagsPeriodo = pagamentos.filter((p) => grupos.has(p.grupoVenda));

  const mapAgrup = new Map<string, { modalidade: string; bandeira: string; qtd: number; total: number }>();
  const grupoChave = (tipo: string, bandeira: string) => {
    if (tipo === "Crédito" || tipo === "Débito") return `${tipo} — ${bandeira || "N/A"}`;
    return tipo;
  };

  if (pagsPeriodo.length > 0) {
    for (const p of pagsPeriodo) {
      const key = grupoChave(p.tipoPagamento, p.bandeira);
      const cur = mapAgrup.get(key) || {
        modalidade: p.tipoPagamento,
        bandeira: p.tipoPagamento === "Crédito" || p.tipoPagamento === "Débito" ? p.bandeira || "N/A" : "—",
        qtd: 0,
        total: 0,
      };
      cur.qtd += 1;
      cur.total += Number(p.valor) || 0;
      mapAgrup.set(key, cur);
    }
  } else {
    for (const v of vendasPeriodo) {
      const key = grupoChave(v.tipoPagamento, v.bandeira);
      const cur = mapAgrup.get(key) || {
        modalidade: v.tipoPagamento,
        bandeira: v.tipoPagamento === "Crédito" || v.tipoPagamento === "Débito" ? v.bandeira || "N/A" : "—",
        qtd: 0,
        total: 0,
      };
      cur.qtd += 1;
      cur.total += v.total;
      mapAgrup.set(key, cur);
    }
  }

  const linhas = Array.from(mapAgrup.values()).sort(
    (a, b) => a.modalidade.localeCompare(b.modalidade) || a.bandeira.localeCompare(b.bandeira),
  );
  const totalPags = linhas.reduce((s, l) => s + l.total, 0);

  if (linhas.length) {
    autoTable(doc, {
      startY: y,
      head: [["Modalidade", "Bandeira", "Qtd. transações", "Total (R$)"]],
      body: [
        ...linhas.map((l) => [l.modalidade, l.bandeira, String(l.qtd), fmtBRL(l.total)]),
        [
          { content: "TOTAL", colSpan: 3, styles: { fontStyle: "bold", halign: "right", fillColor: GOLD, textColor: 255 } },
          { content: fmtBRL(totalPags), styles: { fontStyle: "bold", fillColor: GOLD, textColor: 255 } },
        ],
      ],
      headStyles: { fillColor: DARK, textColor: 255 },
      styles: { fontSize: 9 },
      columnStyles: { 2: { halign: "right" }, 3: { halign: "right" } },
      margin: { left: 12, right: 12 },
    });
    y = (doc as any).lastAutoTable.finalY + 6;

    // Gráfico de pizza por modalidade
    const acumPorModal = new Map<string, number>();
    for (const l of linhas) {
      acumPorModal.set(l.modalidade, (acumPorModal.get(l.modalidade) || 0) + l.total);
    }
    const palette: Record<string, string> = {
      "Crédito": "#C9A24A",
      "Débito": "#2563EB",
      "Pix": "#10B981",
      "Dinheiro": "#22C55E",
      "Crediário": "#F97316",
      "Conta Assinada": "#8B5CF6",
    };
    const slices: PieSlice[] = Array.from(acumPorModal.entries())
      .filter(([, v]) => v > 0)
      .map(([label, value]) => ({ label, value, color: palette[label] || "#6B7280" }));
    if (slices.length > 0) {
      const pieDataUrl = renderPieChartDataUrl(slices);
      y = ensureSpace(doc, y, 80);
      doc.addImage(pieDataUrl, "PNG", 12, y, 186, 70);
      y += 76;
    }
  }

  // Descontos & acréscimos do período (resumo)
  const totalDescontosPeriodo = vendasPeriodo
    .filter((v) => v.tipoAjuste !== "acrescimo")
    .reduce((s, v) => s + (Number(v.desconto) || 0), 0);
  const totalAcrescimosPeriodo = vendasPeriodo
    .filter((v) => v.tipoAjuste === "acrescimo")
    .reduce((s, v) => s + (Number(v.desconto) || 0), 0);
  const qtdDescontos = vendasPeriodo.filter((v) => v.tipoAjuste !== "acrescimo" && Number(v.desconto) > 0).length;
  const qtdAcrescimos = vendasPeriodo.filter((v) => v.tipoAjuste === "acrescimo" && Number(v.desconto) > 0).length;

  if (totalDescontosPeriodo > 0 || totalAcrescimosPeriodo > 0) {
    y = ensureSpace(doc, y, 30);
    y = sectionTitle(doc, y, "Descontos e acréscimos no período");
    autoTable(doc, {
      startY: y,
      head: [["Tipo", "Qtd. ocorrências", "Total"]],
      body: [
        ["Descontos concedidos", String(qtdDescontos), `- ${fmtBRL(totalDescontosPeriodo)}`],
        ["Acréscimos aplicados", String(qtdAcrescimos), `+ ${fmtBRL(totalAcrescimosPeriodo)}`],
      ],
      headStyles: { fillColor: DARK, textColor: 255 },
      styles: { fontSize: 9 },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right", fontStyle: "bold" } },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 2) {
          data.cell.styles.textColor = data.row.index === 0 ? RED : GOLD;
        }
      },
      margin: { left: 12, right: 12 },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // Top produtos
  const mapProd = new Map<string, { desc: string; qtd: number; valor: number }>();
  for (const v of vendasPeriodo) {
    const p = perfumeById.get(v.perfumeId);
    const desc = descricaoProduto(p, v.perfumeNome, concNome);
    const cur = mapProd.get(v.perfumeId) || { desc, qtd: 0, valor: 0 };
    cur.qtd += v.quantidade;
    cur.valor += v.total;
    mapProd.set(v.perfumeId, cur);
  }
  const topProdutos = Array.from(mapProd.values()).sort((a, b) => b.qtd - a.qtd);

  y = sectionTitle(doc, y, "Produtos mais vendidos");
  autoTable(doc, {
    startY: y,
    head: [["#", "Descrição", "Qtd", "Valor total"]],
    body: topProdutos.slice(0, modo === "mensal" ? 30 : 20).map((r, i) => [
      String(i + 1),
      r.desc,
      String(r.qtd),
      fmtBRL(r.valor),
    ]),
    headStyles: { fillColor: DARK, textColor: 255 },
    styles: { fontSize: 8 },
    columnStyles: { 0: { halign: "center" }, 2: { halign: "right" }, 3: { halign: "right" } },
    margin: { left: 12, right: 12 },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // Vendedoras
  const mapVend = new Map<string, { qtd: number; valor: number }>();
  for (const v of vendasPeriodo) {
    const k = v.vendedora || "—";
    const cur = mapVend.get(k) || { qtd: 0, valor: 0 };
    cur.qtd += v.quantidade;
    cur.valor += v.total;
    mapVend.set(k, cur);
  }
  const vendedoras = Array.from(mapVend.entries()).map(([nome, v]) => ({ nome, ...v }));
  const totalVendedoras = vendedoras.reduce((s, x) => s + x.valor, 0);

  if (modo === "mensal" && vendedoras.length) {
    const destaque = [...vendedoras].sort((a, b) => b.valor - a.valor)[0];
    y = ensureSpace(doc, y, 24);
    doc.setFillColor(...GOLD);
    doc.roundedRect(12, y, 186, 18, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("VENDEDORA DESTAQUE DO MÊS", 18, y + 7);
    doc.setFontSize(14);
    doc.text(`${destaque.nome} — ${fmtBRL(destaque.valor)} (${destaque.qtd} produto(s))`, 18, y + 14);
    y += 24;
  }

  y = ensureSpace(doc, y, 30);
  y = sectionTitle(doc, y, modo === "mensal" ? "Comparativo entre vendedoras" : "Vendas por vendedora");
  const ordVend = [...vendedoras].sort((a, b) => b.valor - a.valor);
  autoTable(doc, {
    startY: y,
    head: [["#", "Vendedora", "Qtd produtos", "Valor total", "% do total"]],
    body: ordVend.map((v, i) => [
      String(i + 1),
      v.nome,
      String(v.qtd),
      fmtBRL(v.valor),
      totalVendedoras > 0 ? `${((v.valor / totalVendedoras) * 100).toFixed(1)}%` : "0%",
    ]),
    headStyles: { fillColor: DARK, textColor: 255 },
    styles: { fontSize: 9 },
    columnStyles: { 0: { halign: "center" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
    margin: { left: 12, right: 12 },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // Ranking duplo (quinzenal)
  if (modo === "quinzenal") {
    y = ensureSpace(doc, y, 30);
    y = sectionTitle(doc, y, "Ranking — por quantidade vendida");
    autoTable(doc, {
      startY: y,
      head: [["#", "Vendedora", "Qtd"]],
      body: [...vendedoras].sort((a, b) => b.qtd - a.qtd).map((v, i) => [String(i + 1), v.nome, String(v.qtd)]),
      headStyles: { fillColor: DARK, textColor: 255 },
      styles: { fontSize: 9 },
      columnStyles: { 0: { halign: "center" }, 2: { halign: "right" } },
      margin: { left: 12, right: 12 },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // Mensal: produtos com maior giro (apoio à reposição)
  if (modo === "mensal" && topProdutos.length) {
    y = ensureSpace(doc, y, 30);
    y = sectionTitle(doc, y, "Produtos com maior giro — apoio à reposição");
    autoTable(doc, {
      startY: y,
      head: [["Descrição", "Qtd vendida no mês", "Estoque atual (loja)"]],
      body: topProdutos.slice(0, 20).map((r) => {
        const id = Array.from(mapProd.entries()).find(([, val]) => val === r)?.[0];
        const p = id ? perfumeById.get(id) : undefined;
        const est = p ? estoqueDaLoja(p, loja) : 0;
        return [r.desc, String(r.qtd), String(est)];
      }),
      headStyles: { fillColor: DARK, textColor: 255 },
      styles: { fontSize: 8 },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
      margin: { left: 12, right: 12 },
    });
  }

  footerPaginas(doc);
  return doc;
}

export function gerarFluxoCaixaQuinzenal(
  params: FluxoCaixaInput & { dataInicio: string; dataFim: string },
): jsPDF {
  return rangeReport({
    ...params,
    titulo: "Relatório de Fluxo de Caixa — Quinzenal",
    periodoLabel: `Período: ${fmtData(params.dataInicio)} a ${fmtData(params.dataFim)}`,
    modo: "quinzenal",
  });
}

export function gerarFluxoCaixaMensal(
  params: FluxoCaixaInput & { dataInicio: string; dataFim: string },
): jsPDF {
  return rangeReport({
    ...params,
    titulo: "Relatório de Fluxo de Caixa — Mensal",
    periodoLabel: `Período: ${fmtData(params.dataInicio)} a ${fmtData(params.dataFim)}`,
    modo: "mensal",
  });
}
