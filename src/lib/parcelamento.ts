// Taxas MDR da maquininha InfinitePay (taxa sobre o valor do produto)
export const TAXAS_MDR: Record<number, number> = {
  1: 2.69,
  2: 5.42,
  3: 6.49,
  4: 7.28,
  5: 8.02,
  6: 8.45,
  7: 8.87,
  8: 9.40,
  9: 9.93,
  10: 10.47,
};

export const PARCELAS_SEM_JUROS_LIMITE = 6;

export interface OpcaoParcelamento {
  parcelas: number;
  taxa: number;
  temJuros: boolean;
  valorTotal: number;
  valorParcela: number;
  acrescimo: number;
}

export function calcularParcelamento(valorProduto: number): OpcaoParcelamento[] {
  return Array.from({ length: 10 }, (_, i) => {
    const parcelas = i + 1;
    const taxa = TAXAS_MDR[parcelas];
    const temJuros = parcelas > PARCELAS_SEM_JUROS_LIMITE;
    const valorTotal = temJuros ? valorProduto / (1 - taxa / 100) : valorProduto;
    const valorParcela = valorTotal / parcelas;
    return {
      parcelas,
      taxa,
      temJuros,
      valorTotal,
      valorParcela,
      acrescimo: valorTotal - valorProduto,
    };
  });
}
