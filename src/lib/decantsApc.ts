/** Validação da divisão de frasco (a regra definitiva roda em fn_decant_dividir_frasco). Valores em milésimos de ml. */
export function validarDivisao(p: { disponivel: number; mlDecants: number; mlApc: number; precoApc: number | null; precos: number[] }): string[] {
  const e: string[] = [];
  const m = (v: number) => Math.round(v * 1000);
  if (!Number.isFinite(p.mlDecants) || p.mlDecants < 0 || p.mlApc < 0) e.push("Volumes não podem ser negativos.");
  else if (m(p.mlDecants) + m(p.mlApc) !== m(p.disponivel)) e.push(`Decants + APC devem somar ${p.disponivel} ml (saldo real).`);
  if (p.mlApc > 0 && !(Number(p.precoApc) > 0)) e.push("Informe o preço total do APC.");
  if (p.precos.some((v) => Number.isFinite(v) && v < 0)) e.push("Preço inválido.");
  return e;
}

/** Tamanhos que ainda cabem no saldo a granel (nunca usa APC). */
export const tamanhosVendaveis = (granelMl: number, tamanhos = [5, 8, 10]) =>
  tamanhos.filter((t) => Math.round(granelMl * 1000) >= Math.round(t * 1000));

/** Resumo da ficha do frasco: tamanhos ordenados e resultado parcial (só com custo visível). */
export function resumoFicha(f: {
  vendas_sob_demanda?: Record<string, { qtd: number; receita: number }>;
  receita_total?: number; custo_rateio_decants?: number | null; custo_rateio_apc?: number | null; custo_frasco?: number | null;
}) {
  const tamanhos = Object.entries(f.vendas_sob_demanda || {})
    .map(([ml, v]) => ({ ml: Number(ml), qtd: Number(v.qtd), receita: Number(v.receita) }))
    .sort((a, b) => a.ml - b.ml);
  const temCusto = f.custo_frasco !== undefined && f.custo_frasco !== null;
  const resultado = temCusto ? Math.round((Number(f.receita_total || 0) - Number(f.custo_rateio_decants || 0) - Number(f.custo_rateio_apc || 0)) * 100) / 100 : null;
  return { tamanhos, temCusto, resultado };
}
