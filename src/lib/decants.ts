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
