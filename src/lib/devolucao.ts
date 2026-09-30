/** Regras puras de devolução/troca (espelham as validações do banco). */

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function valorUnitarioLiquido(totalItem: number, quantidade: number): number {
  if (!quantidade || quantidade <= 0) return 0;
  return round2(totalItem / quantidade);
}

export function saldoDevolvivel(vendido: number, jaDevolvido: number): number {
  return Math.max(0, vendido - jaDevolvido);
}

export function validarQuantidadeDevolucao(qtd: number, vendido: number, jaDevolvido: number): string | null {
  if (!Number.isInteger(qtd) || qtd <= 0) return "Quantidade inválida";
  if (qtd > saldoDevolvivel(vendido, jaDevolvido)) return "Quantidade maior que a vendida";
  return null;
}

export function diasEntre(dataVenda: string, hoje: string): number {
  const a = Date.UTC(+dataVenda.slice(0, 4), +dataVenda.slice(5, 7) - 1, +dataVenda.slice(8, 10));
  const b = Date.UTC(+hoje.slice(0, 4), +hoje.slice(5, 7) - 1, +hoje.slice(8, 10));
  return Math.round((b - a) / 86400000);
}

export function foraDoPrazo(dataVenda: string, hoje: string, prazoDias: number): boolean {
  return diasEntre(dataVenda, hoje) > prazoDias;
}

export function diferencaTroca(valorDevolvido: number, valorNovo: number) {
  const dif = round2(valorNovo - valorDevolvido);
  return { diferenca: dif, aPagar: dif > 0 ? dif : 0, aReceber: dif < 0 ? -dif : 0 };
}

export function vendasLiquidas(bruto: number, devolucoes: number) {
  return round2(bruto - devolucoes);
}

export const FORMAS_REEMBOLSO = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "Pix" },
  { value: "estorno_cartao", label: "Estorno no cartão" },
  { value: "credito_loja", label: "Crédito na loja" },
  { value: "vale_troca", label: "Vale-troca" },
] as const;

export const DESTINOS_ITEM = [
  { value: "estoque", label: "Volta ao estoque" },
  { value: "avaria", label: "Avaria" },
  { value: "tester", label: "Vira tester" },
] as const;

export type FormaReembolso = (typeof FORMAS_REEMBOLSO)[number]["value"];
export type DestinoItem = (typeof DESTINOS_ITEM)[number]["value"];
