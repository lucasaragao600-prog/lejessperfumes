// Cálculos do módulo Decants. Valores exibidos; a regra definitiva roda no banco (fn_decant_custo_ml).

/** Custo por ml = custo ÷ (volume × rendimento%). Arredonda em 6 casas, como no banco. */
export function custoPorMl(custo: number, volumeMl: number, rendimentoPct = 100): number {
  if (!volumeMl || volumeMl <= 0 || !rendimentoPct || rendimentoPct <= 0) return 0;
  return Math.round((custo / ((volumeMl * rendimentoPct) / 100)) * 1e6) / 1e6;
}

/** Soma movimentos em milésimos de ml para não acumular erro de ponto flutuante. */
export function saldoMl(movimentos: number[]): number {
  return movimentos.reduce((acc, m) => acc + Math.round(m * 1000), 0) / 1000;
}

/** Volume no padrão do SKU: 5 → "005", 2,5 → "2P5". */
export function volumeSku(volumeMl: number): string {
  const inteiro = Math.trunc(volumeMl);
  const frac = Math.round((volumeMl - inteiro) * 1000) / 1000;
  if (frac === 0) return String(inteiro).padStart(3, "0");
  return `${inteiro}P${String(frac).split(".")[1]}`;
}

export function skuDecant(codigoPerfume: string, volumeMl: number): string {
  return `DEC-${codigoPerfume}-${volumeSku(volumeMl)}`;
}

export const TIPOS_SAIDA_ML = [
  { value: "tester", label: "Tester" },
  { value: "uso_interno", label: "Uso interno" },
  { value: "vazamento", label: "Vazamento" },
  { value: "perda", label: "Perda" },
  { value: "amostra", label: "Amostra" },
  { value: "descarte", label: "Descarte" },
] as const;

export const ROTULO_MOV_ML: Record<string, string> = {
  abertura: "Abertura",
  producao: "Produção",
  ajuste: "Ajuste",
  ...Object.fromEntries(TIPOS_SAIDA_ML.map((t) => [t.value, t.label])),
};

export const fmtMl = (v: number) =>
  `${Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} ml`;
export const fmtBRL = (v: number) =>
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/* ---------- Fase 2: produção e ficha técnica ---------- */

/** Volume necessário do lote, em milésimos de ml para não acumular erro. */
export function volumeNecessario(itens: { volumeMl: number; quantidade: number }[]): number {
  return itens.reduce((acc, i) => acc + Math.round(i.volumeMl * 1000) * Math.max(0, Math.trunc(i.quantidade || 0)), 0) / 1000;
}

export interface FichaTecnica {
  custoLiquido: number; custoEmbalagem: number; custoTotal: number;
  lucroBruto: number; margemPct: number | null; markupPct: number | null;
}

/** Fórmulas A4.10: margem = (preço − custo) ÷ preço; markup = (preço − custo) ÷ custo. */
export function fichaTecnica(p: {
  volumeMl: number; custoMl: number; frasco: number; atomizador: number; etiqueta: number;
  embalagem: number; maoObra: number; outros: number; preco: number;
}): FichaTecnica {
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const custoLiquido = r2(p.volumeMl * p.custoMl);
  const custoEmbalagem = r2(p.frasco + p.atomizador + p.etiqueta + p.embalagem);
  const custoTotal = r2(custoLiquido + custoEmbalagem + p.maoObra + p.outros);
  const lucroBruto = r2(p.preco - custoTotal);
  return {
    custoLiquido, custoEmbalagem, custoTotal, lucroBruto,
    margemPct: p.preco > 0 ? r2((lucroBruto / p.preco) * 100) : null,
    markupPct: custoTotal > 0 ? r2((lucroBruto / custoTotal) * 100) : null,
  };
}

/** Sugestão FIFO: frascos mais antigos primeiro, até cobrir o necessário. */
export function sugerirFifo(frascos: { id: string; aberto_em: string; disponivel_ml: number }[], necessarioMl: number) {
  const ord = [...frascos].sort((a, b) => a.aberto_em.localeCompare(b.aberto_em));
  let resto = Math.round(necessarioMl * 1000);
  const out: { frasco_id: string; ml: number }[] = [];
  for (const f of ord) {
    if (resto <= 0) break;
    const disp = Math.round(Math.max(0, f.disponivel_ml) * 1000);
    if (disp <= 0) continue;
    const pega = Math.min(disp, resto);
    out.push({ frasco_id: f.id, ml: pega / 1000 });
    resto -= pega;
  }
  return { distribuicao: out, falta: resto / 1000 };
}

export const MOTIVOS_DIFERENCA = [
  { value: "vazamento", label: "Vazamento" }, { value: "quebra", label: "Quebra" },
  { value: "erro_envase", label: "Erro de envase" }, { value: "perda", label: "Perda" },
  { value: "volume_insuficiente", label: "Volume insuficiente" }, { value: "erro_operacional", label: "Erro operacional" },
  { value: "outro", label: "Outro" },
] as const;

export const STATUS_LOTE: Record<string, string> = {
  planejado: "Planejado", em_producao: "Em produção", aguardando_conferencia: "Aguardando conferência",
  concluido: "Concluído", cancelado: "Cancelado",
};

/* ---------- Fase 3 ---------- */
/** Estoque potencial: cada tamanho isolado (é "ou", nunca soma). */
export function estoquePotencial(disponivelMl: number, tamanhos: number[]) {
  const disp = Math.round(Math.max(0, disponivelMl) * 1000);
  return tamanhos.map((v) => ({ volumeMl: v, quantidade: Math.floor(disp / Math.round(v * 1000)) }));
}

export const CANAIS = [
  { value: "loja_fisica", label: "Loja física" }, { value: "site", label: "Site" }, { value: "whatsapp", label: "WhatsApp" },
  { value: "instagram", label: "Instagram" }, { value: "marketplace", label: "Marketplace" }, { value: "outro", label: "Outro" },
] as const;

export const ROTULO_MOV: Record<string, string> = {
  entrada: "Entrada", abertura: "Abertura", producao: "Produção", venda: "Venda", perda: "Perda", tester: "Tester",
  ajuste: "Ajuste", inventario: "Inventário", cancelamento: "Cancelamento", devolucao: "Devolução",
  devolucao_quarentena: "Devolução (quarentena)", entrada_producao: "Entrada de produção",
  transferencia_saida: "Transferência (saída)", transferencia_entrada: "Transferência (entrada)",
  uso_interno: "Uso interno", vazamento: "Vazamento", amostra: "Amostra", descarte: "Descarte",
};

/* ---------- Fase 4: perdas, períodos, rentabilidade, comparativo ---------- */
export const TIPOS_PERDA = [
  { value: "vazamento", label: "Vazamento" }, { value: "quebra", label: "Quebra" }, { value: "erro_envase", label: "Erro de envase" },
  { value: "evaporacao", label: "Evaporação" }, { value: "tester", label: "Tester" }, { value: "uso_interno", label: "Uso interno" },
  { value: "ajuste", label: "Ajuste" }, { value: "divergencia", label: "Divergência" }, { value: "descarte", label: "Descarte" },
  { value: "outro", label: "Outro" },
] as const;
export const ROTULO_PERDA: Record<string, string> = Object.fromEntries(TIPOS_PERDA.map((t) => [t.value, t.label]));

export type PresetPeriodo = "hoje" | "ontem" | "7d" | "30d" | "mes" | "personalizado";
const addDias = (iso: string, d: number) => {
  const t = new Date(`${iso}T12:00:00Z`); t.setUTCDate(t.getUTCDate() + d); return t.toISOString().slice(0, 10);
};
/** Períodos do dashboard a partir do "hoje" de Manaus (YYYY-MM-DD). */
export function periodoPreset(p: Exclude<PresetPeriodo, "personalizado">, hoje: string): { ini: string; fim: string } {
  switch (p) {
    case "hoje": return { ini: hoje, fim: hoje };
    case "ontem": { const o = addDias(hoje, -1); return { ini: o, fim: o }; }
    case "7d": return { ini: addDias(hoje, -6), fim: hoje };
    case "30d": return { ini: addDias(hoje, -29), fim: hoje };
    case "mes": return { ini: `${hoje.slice(0, 8)}01`, fim: hoje };
  }
}

/** Lucro bruto = receita − custo consumido; margem = lucro ÷ receita. */
export function rentabilidade(receita: number, custoConsumido: number) {
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const lucro = r2(receita - custoConsumido);
  return { lucro, margemPct: receita > 0 ? r2((lucro / receita) * 100) : null };
}

/** Comparativo frasco fechado × decants. Só apresenta números; nunca decide. */
export function comparativoFechado(p: {
  precoFechado: number; custoFrasco: number; volumeMl: number; rendimentoPct: number; perdaPct: number;
  tamanhoMl: number; precoDecant: number; insumosUnit: number;
}) {
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const mlUtil = Math.max(0, Math.round(p.volumeMl * (p.rendimentoPct / 100) * (1 - p.perdaPct / 100) * 1000) / 1000);
  const unidades = p.tamanhoMl > 0 ? Math.floor(Math.round(mlUtil * 1000) / Math.round(p.tamanhoMl * 1000)) : 0;
  const receitaDecants = r2(unidades * p.precoDecant);
  const custoEmbalagens = r2(unidades * p.insumosUnit);
  const margemDecants = r2(receitaDecants - custoEmbalagens - p.custoFrasco);
  const margemFechado = r2(p.precoFechado - p.custoFrasco);
  return { mlUtil, unidades, receitaDecants, custoEmbalagens, margemDecants, margemFechado, diferenca: r2(margemDecants - margemFechado) };
}

export const RELATORIOS = [
  { value: "producao", label: "Produção" }, { value: "vendas", label: "Vendas" }, { value: "estoque", label: "Estoque" },
  { value: "estoque_filial", label: "Estoque por filial" }, { value: "volume_disponivel", label: "Volume disponível" },
  { value: "perfumes_abertos_fechados", label: "Perfumes abertos e fechados" }, { value: "perdas", label: "Perdas" },
  { value: "margem", label: "Margem" }, { value: "custos", label: "Custos" }, { value: "movimentacoes", label: "Movimentações" },
  { value: "divergencias", label: "Divergências" }, { value: "lotes", label: "Lotes" }, { value: "reposicao", label: "Reposição" },
  { value: "mais_vendidos", label: "Mais vendidos" }, { value: "sem_venda", label: "Sem venda" },
  { value: "rent_perfume", label: "Rentabilidade por perfume" }, { value: "rent_tamanho", label: "Rentabilidade por tamanho" },
  { value: "desempenho_filial", label: "Desempenho por filial" },
] as const;

/** Fase 5: sugestão de reposição. Só sugere quando atual ≤ mínimo; nunca propõe mais que o ml disponível permite produzir. */
export function sugestaoReposicao(p: { minimo: number; ideal: number; atual: number; emProducao?: number; volumeMl: number; disponivelMl: number }) {
  const alvo = Math.max(p.ideal, p.minimo);
  const sugerido = p.atual <= p.minimo ? Math.max(alvo - p.atual - (p.emProducao ?? 0), 0) : 0;
  const necessario = Math.round(sugerido * p.volumeMl * 1000) / 1000;
  const deficit = Math.max(Math.round((necessario - p.disponivelMl) * 1000) / 1000, 0);
  const produzivel = p.volumeMl > 0 ? Math.min(sugerido, Math.floor(p.disponivelMl / p.volumeMl + 1e-9)) : 0;
  return { sugerido, necessario, deficit, produzivel };
}
