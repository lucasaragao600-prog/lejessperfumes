/**
 * Motor Fiscal de Leitura de XML NF-e
 *
 * Recebe um XML de NF-e (string), extrai itens e totais, ratea frete/seguro/
 * outras despesas/desconto proporcionalmente, calcula ICMS, IPI e custo real
 * unitário/total de cada produto.
 *
 * Compatível com o padrão nacional NF-e 4.00.
 */

import { XMLParser } from "fast-xml-parser";

const TOLERANCIA = 0.01;

export interface ResultadoNFeItem {
  produto: string;
  quantidade: number;
  valor_unitario: number;
  custo_final_unitario: number;
  icms_unitario: number;
  ipi_unitario: number;
  frete_unitario: number;
  seguro_unitario: number;
  outros_unitario: number;
  desconto_unitario: number;
  total_produto: number;
  icms_total: number;
  ipi_total: number;
  frete_rateado: number;
  seguro_rateado: number;
  outros_rateado: number;
  desconto_rateado: number;
  custo_total_item: number;
  aliquota_icms: number;
  aliquota_ipi: number;
  carga_tributaria_percentual: number;
  inconsistencia: boolean;
  ajustado: boolean;
}

export interface ResumoNota {
  total_produtos: number;
  total_icms: number;
  total_ipi: number;
  total_frete: number;
  total_seguro: number;
  total_outros: number;
  total_desconto: number;
  valor_total_nota: number;
}

export interface SaidaNFe {
  resultado: ResultadoNFeItem[];
  resumo_nota: ResumoNota;
}

function r2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function num(n: unknown): number {
  if (n == null) return 0;
  const v = typeof n === "string" ? parseFloat(n.replace(",", ".")) : (n as number);
  if (!Number.isFinite(v) || isNaN(v as number) || (v as number) < 0) return 0;
  return v as number;
}

function aprox(a: number, b: number, tol = TOLERANCIA): boolean {
  return Math.abs(a - b) <= tol;
}

/** Procura recursivamente o primeiro nó que contenha alguma das chaves alvo */
function findNode(obj: any, key: string): any {
  if (!obj || typeof obj !== "object") return undefined;
  if (key in obj) return obj[key];
  for (const k of Object.keys(obj)) {
    const found = findNode(obj[k], key);
    if (found !== undefined) return found;
  }
  return undefined;
}

/** Acha o primeiro nó "ICMSxx" dentro do bloco ICMS */
function extractICMS(icmsNode: any): { vBC: number; pICMS: number; vICMS: number } {
  if (!icmsNode || typeof icmsNode !== "object") return { vBC: 0, pICMS: 0, vICMS: 0 };
  for (const k of Object.keys(icmsNode)) {
    const sub = icmsNode[k];
    if (sub && typeof sub === "object" && ("vICMS" in sub || "pICMS" in sub || "vBC" in sub)) {
      return {
        vBC: num(sub.vBC),
        pICMS: num(sub.pICMS),
        vICMS: num(sub.vICMS),
      };
    }
  }
  return { vBC: 0, pICMS: 0, vICMS: 0 };
}

function extractIPI(ipiNode: any): { pIPI: number; vIPI: number } {
  if (!ipiNode || typeof ipiNode !== "object") return { pIPI: 0, vIPI: 0 };
  // IPI -> IPITrib / IPINT
  for (const k of Object.keys(ipiNode)) {
    const sub = ipiNode[k];
    if (sub && typeof sub === "object" && ("vIPI" in sub || "pIPI" in sub)) {
      return { pIPI: num(sub.pIPI), vIPI: num(sub.vIPI) };
    }
  }
  return { pIPI: 0, vIPI: 0 };
}

/**
 * Processa XML completo de NF-e e retorna estrutura fiscal.
 */
export function processarXmlNFe(xml: string): SaidaNFe {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseTagValue: true,
    trimValues: true,
  });

  const json = parser.parse(xml);

  // Localizar nó <infNFe>
  const infNFe = findNode(json, "infNFe");
  if (!infNFe) {
    return {
      resultado: [],
      resumo_nota: {
        total_produtos: 0,
        total_icms: 0,
        total_ipi: 0,
        total_frete: 0,
        total_seguro: 0,
        total_outros: 0,
        total_desconto: 0,
        valor_total_nota: 0,
      },
    };
  }

  // Itens: det pode ser objeto único ou array
  const detRaw = infNFe.det ?? [];
  const dets: any[] = Array.isArray(detRaw) ? detRaw : [detRaw];

  // Totais ICMSTot
  const icmsTot = infNFe.total?.ICMSTot ?? {};
  const valor_frete_total = num(icmsTot.vFrete);
  const valor_seguro = num(icmsTot.vSeg);
  const valor_outros = num(icmsTot.vOutro);
  const valor_desconto = num(icmsTot.vDesc);
  const valor_total_nota = num(icmsTot.vNF);
  const total_produtos_nota = num(icmsTot.vProd);
  const total_icms_nota = num(icmsTot.vICMS);
  const total_ipi_nota = num(icmsTot.vIPI);

  // Pré-extração dos itens
  type Pre = {
    produto: string;
    quantidade: number;
    valor_unitario: number;
    valor_total: number;
    icms: { vBC: number; pICMS: number; vICMS: number };
    ipi: { pIPI: number; vIPI: number };
    vFreteItem: number;
    vSegItem: number;
    vOutroItem: number;
    vDescItem: number;
  };

  const pre: Pre[] = dets.map((d) => {
    const prod = d.prod ?? {};
    const imposto = d.imposto ?? {};
    return {
      produto: String(prod.xProd ?? "").trim(),
      quantidade: num(prod.qCom),
      valor_unitario: num(prod.vUnCom),
      valor_total: num(prod.vProd),
      icms: extractICMS(imposto.ICMS),
      ipi: extractIPI(imposto.IPI),
      vFreteItem: num(prod.vFrete),
      vSegItem: num(prod.vSeg),
      vOutroItem: num(prod.vOutro),
      vDescItem: num(prod.vDesc),
    };
  });

  // Soma dos totais para rateio (preferir vProd informado por item)
  const soma_total_produtos =
    pre.reduce((acc, p) => acc + p.valor_total, 0) || total_produtos_nota || 0;

  // Determina se já há valores por item; se sim, NÃO ratear (já vem rateado pela origem)
  const freteJaPorItem = pre.some((p) => p.vFreteItem > 0);
  const seguroJaPorItem = pre.some((p) => p.vSegItem > 0);
  const outrosJaPorItem = pre.some((p) => p.vOutroItem > 0);
  const descontoJaPorItem = pre.some((p) => p.vDescItem > 0);

  const resultado: ResultadoNFeItem[] = pre.map((p) => {
    const percentual_item =
      soma_total_produtos > 0 ? p.valor_total / soma_total_produtos : 0;

    const frete_rateado = freteJaPorItem
      ? p.vFreteItem
      : valor_frete_total * percentual_item;
    const seguro_rateado = seguroJaPorItem
      ? p.vSegItem
      : valor_seguro * percentual_item;
    const outros_rateado = outrosJaPorItem
      ? p.vOutroItem
      : valor_outros * percentual_item;
    const desconto_rateado = descontoJaPorItem
      ? p.vDescItem
      : valor_desconto * percentual_item;

    // Validação inicial: vProd ≈ qCom * vUnCom
    const total_produto_calc = p.quantidade * p.valor_unitario;
    let inconsistencia = false;
    if (!aprox(p.valor_total, total_produto_calc)) {
      inconsistencia = true;
    }

    // ICMS unitário (prioriza valor)
    let icms_unitario =
      p.icms.vICMS > 0 && p.quantidade > 0
        ? p.icms.vICMS / p.quantidade
        : p.valor_unitario * (p.icms.pICMS / 100);

    // IPI unitário (prioriza valor)
    let ipi_unitario =
      p.ipi.vIPI > 0 && p.quantidade > 0
        ? p.ipi.vIPI / p.quantidade
        : p.valor_unitario * (p.ipi.pIPI / 100);

    // Derivação de alíquotas se ausentes
    let aliquota_icms = p.icms.pICMS;
    if (aliquota_icms === 0 && p.icms.vICMS > 0 && p.valor_total > 0) {
      aliquota_icms = (p.icms.vICMS / p.valor_total) * 100;
    }
    let aliquota_ipi = p.ipi.pIPI;
    if (aliquota_ipi === 0 && p.ipi.vIPI > 0 && p.valor_total > 0) {
      aliquota_ipi = (p.ipi.vIPI / p.valor_total) * 100;
    }

    // Totais
    let icms_total = p.quantidade * icms_unitario;
    let ipi_total = p.quantidade * ipi_unitario;

    // Validação final → ajusta pela alíquota se divergir do XML
    let ajustado = false;
    if (p.icms.vICMS > 0 && !aprox(icms_total, p.icms.vICMS)) {
      icms_unitario = p.valor_unitario * (aliquota_icms / 100);
      icms_total = p.quantidade * icms_unitario;
      ajustado = true;
    }
    if (p.ipi.vIPI > 0 && !aprox(ipi_total, p.ipi.vIPI)) {
      ipi_unitario = p.valor_unitario * (aliquota_ipi / 100);
      ipi_total = p.quantidade * ipi_unitario;
      ajustado = true;
    }

    const total_produto = p.valor_total || total_produto_calc;

    const frete_unitario = p.quantidade > 0 ? frete_rateado / p.quantidade : 0;
    const seguro_unitario = p.quantidade > 0 ? seguro_rateado / p.quantidade : 0;
    const outros_unitario = p.quantidade > 0 ? outros_rateado / p.quantidade : 0;
    const desconto_unitario = p.quantidade > 0 ? desconto_rateado / p.quantidade : 0;

    const custo_final_unitario =
      p.valor_unitario +
      icms_unitario +
      ipi_unitario +
      frete_unitario +
      seguro_unitario +
      outros_unitario -
      desconto_unitario;

    const custo_total_item =
      total_produto +
      icms_total +
      ipi_total +
      frete_rateado +
      seguro_rateado +
      outros_rateado -
      desconto_rateado;

    const carga_tributaria_percentual =
      p.valor_unitario > 0
        ? ((icms_unitario + ipi_unitario) / p.valor_unitario) * 100
        : 0;

    return {
      produto: p.produto,
      quantidade: r2(p.quantidade),
      valor_unitario: r2(p.valor_unitario),
      custo_final_unitario: r2(Math.max(0, custo_final_unitario)),
      icms_unitario: r2(icms_unitario),
      ipi_unitario: r2(ipi_unitario),
      frete_unitario: r2(frete_unitario),
      seguro_unitario: r2(seguro_unitario),
      outros_unitario: r2(outros_unitario),
      desconto_unitario: r2(desconto_unitario),
      total_produto: r2(total_produto),
      icms_total: r2(icms_total),
      ipi_total: r2(ipi_total),
      frete_rateado: r2(frete_rateado),
      seguro_rateado: r2(seguro_rateado),
      outros_rateado: r2(outros_rateado),
      desconto_rateado: r2(desconto_rateado),
      custo_total_item: r2(Math.max(0, custo_total_item)),
      aliquota_icms: r2(aliquota_icms),
      aliquota_ipi: r2(aliquota_ipi),
      carga_tributaria_percentual: r2(carga_tributaria_percentual),
      inconsistencia,
      ajustado,
    };
  });

  const resumo_nota: ResumoNota = {
    total_produtos: r2(
      total_produtos_nota || resultado.reduce((a, r) => a + r.total_produto, 0)
    ),
    total_icms: r2(
      total_icms_nota || resultado.reduce((a, r) => a + r.icms_total, 0)
    ),
    total_ipi: r2(
      total_ipi_nota || resultado.reduce((a, r) => a + r.ipi_total, 0)
    ),
    total_frete: r2(valor_frete_total),
    total_seguro: r2(valor_seguro),
    total_outros: r2(valor_outros),
    total_desconto: r2(valor_desconto),
    valor_total_nota: r2(
      valor_total_nota ||
        resultado.reduce((a, r) => a + r.custo_total_item, 0)
    ),
  };

  return { resultado, resumo_nota };
}
