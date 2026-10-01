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
