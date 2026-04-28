/**
 * Motor Fiscal Inteligente
 *
 * Interpreta dados de nota fiscal (ou entrada manual) e calcula
 * automaticamente ICMS, IPI e custo real do produto com precisão financeira.
 *
 * Regras:
 *  - ICMS e IPI sempre calculados sobre o valor do produto (nunca preço de venda)
 *  - Prioridade: 1) valores informados (valor_icms / valor_ipi)
 *                2) alíquotas
 *                3) cálculo automático
 *  - Tolerância padrão: ±0,01 para arredondamento
 *  - Sempre retorna números arredondados em 2 casas decimais
 */

export interface ItemEntradaCompleto {
  produto: string;
  quantidade: number;
  valor_unitario: number;
  valor_total?: number;
  bc_icms?: number;
  aliquota_icms?: number;
  valor_icms?: number;
  aliquota_ipi?: number;
  valor_ipi?: number;
}

export interface ItemEntradaReduzido {
  produto: string;
  quantidade: number;
  valor_unitario: number;
  aliquota_icms?: number;
  aliquota_ipi?: number;
}

export type EntradaFiscal =
  | { itens: ItemEntradaCompleto[] }
  | ItemEntradaCompleto
  | ItemEntradaReduzido;

export interface ResultadoFiscal {
  produto: string;
  valor_unitario: number;
  quantidade: number;
  icms_unitario: number;
  ipi_unitario: number;
  custo_final_unitario: number;
  total_produto: number;
  icms_total: number;
  ipi_total: number;
  custo_final_total: number;
  aliquota_icms: number;
  aliquota_ipi: number;
  carga_tributaria_percentual: number;
  inconsistencia: boolean;
  ajustado: boolean;
}

export interface SaidaFiscal {
  resultado: ResultadoFiscal[];
}

const TOLERANCIA = 0.01;

/** Arredonda para 2 casas decimais com segurança financeira */
function r2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Normaliza para número não-negativo finito */
function num(n: unknown): number {
  const v = typeof n === "string" ? parseFloat(n) : (n as number);
  if (!Number.isFinite(v) || isNaN(v as number) || (v as number) < 0) return 0;
  return v as number;
}

function aprox(a: number, b: number, tol = TOLERANCIA): boolean {
  return Math.abs(a - b) <= tol;
}

/** Processa um único item */
export function processarItem(
  raw: ItemEntradaCompleto | ItemEntradaReduzido
): ResultadoFiscal {
  const produto = String(raw.produto ?? "").trim();
  const quantidade = num(raw.quantidade);
  const valor_unitario = num(raw.valor_unitario);

  const item = raw as ItemEntradaCompleto;
  const valor_total_informado =
    item.valor_total != null ? num(item.valor_total) : undefined;
  const bc_icms = item.bc_icms != null ? num(item.bc_icms) : undefined;
  let aliquota_icms =
    item.aliquota_icms != null ? num(item.aliquota_icms) : undefined;
  let aliquota_ipi =
    item.aliquota_ipi != null ? num(item.aliquota_ipi) : undefined;
  const valor_icms = item.valor_icms != null ? num(item.valor_icms) : undefined;
  const valor_ipi = item.valor_ipi != null ? num(item.valor_ipi) : undefined;

  const total_produto_calc = quantidade * valor_unitario;
  const total_produto = valor_total_informado ?? total_produto_calc;

  // 2. Validação inicial
  let inconsistencia = false;
  if (
    valor_total_informado != null &&
    !aprox(valor_total_informado, total_produto_calc)
  ) {
    inconsistencia = true;
  }
  if (bc_icms != null && !aprox(bc_icms, total_produto)) {
    inconsistencia = true;
  }

  // 4 / 5. ICMS / IPI unitário (prioriza valores informados)
  let icms_unitario =
    valor_icms != null && quantidade > 0
      ? valor_icms / quantidade
      : valor_unitario * ((aliquota_icms ?? 0) / 100);

  let ipi_unitario =
    valor_ipi != null && quantidade > 0
      ? valor_ipi / quantidade
      : valor_unitario * ((aliquota_ipi ?? 0) / 100);

  // 6. Derivação de alíquotas se ausentes
  if (aliquota_icms == null) {
    aliquota_icms =
      valor_icms != null && total_produto > 0
        ? (valor_icms / total_produto) * 100
        : valor_unitario > 0
          ? (icms_unitario / valor_unitario) * 100
          : 0;
  }
  if (aliquota_ipi == null) {
    aliquota_ipi =
      valor_ipi != null && total_produto > 0
        ? (valor_ipi / total_produto) * 100
        : valor_unitario > 0
          ? (ipi_unitario / valor_unitario) * 100
          : 0;
  }

  // 8. Totais
  let icms_total = quantidade * icms_unitario;
  let ipi_total = quantidade * ipi_unitario;

  // 9. Validação final - se divergente, recalcular pela alíquota
  let ajustado = false;
  if (valor_icms != null && !aprox(icms_total, valor_icms)) {
    icms_unitario = valor_unitario * ((aliquota_icms ?? 0) / 100);
    icms_total = quantidade * icms_unitario;
    ajustado = true;
  }
  if (valor_ipi != null && !aprox(ipi_total, valor_ipi)) {
    ipi_unitario = valor_unitario * ((aliquota_ipi ?? 0) / 100);
    ipi_total = quantidade * ipi_unitario;
    ajustado = true;
  }

  // 7. Custo final
  const custo_final_unitario = valor_unitario + icms_unitario + ipi_unitario;
  const custo_final_total = quantidade * custo_final_unitario;

  const carga_tributaria_percentual =
    valor_unitario > 0
      ? ((icms_unitario + ipi_unitario) / valor_unitario) * 100
      : 0;

  return {
    produto,
    valor_unitario: r2(valor_unitario),
    quantidade: r2(quantidade),
    icms_unitario: r2(icms_unitario),
    ipi_unitario: r2(ipi_unitario),
    custo_final_unitario: r2(custo_final_unitario),
    total_produto: r2(total_produto),
    icms_total: r2(icms_total),
    ipi_total: r2(ipi_total),
    custo_final_total: r2(custo_final_total),
    aliquota_icms: r2(aliquota_icms ?? 0),
    aliquota_ipi: r2(aliquota_ipi ?? 0),
    carga_tributaria_percentual: r2(carga_tributaria_percentual),
    inconsistencia,
    ajustado,
  };
}

/** Processa entrada (item único, lista, ou objeto { itens: [...] }) */
export function processarFiscal(entrada: EntradaFiscal): SaidaFiscal {
  let itens: (ItemEntradaCompleto | ItemEntradaReduzido)[] = [];

  if (entrada && typeof entrada === "object" && "itens" in entrada && Array.isArray(entrada.itens)) {
    itens = entrada.itens;
  } else if (Array.isArray(entrada)) {
    itens = entrada;
  } else {
    itens = [entrada as ItemEntradaCompleto];
  }

  return {
    resultado: itens.map(processarItem),
  };
}
