// Validação fiscal de itens antes de emitir (sem dependências: usada no backend e nos testes).
export interface ItemFiscal {
  ncm?: string | null; cest?: string | null; origem?: string | null; cfop?: string | null; csosn?: string | null; cst_icms?: string | null;
  unidade_comercial?: string | null; gtin?: string | null; cst_pis?: string | null; cst_cofins?: string | null; emite_nota?: boolean;
}
export interface ErroFiscal { campo: string; mensagem: string; grave: boolean }

const CSOSN_OK = ["101", "102", "103", "300", "400", "500", "900"];
const CST_OK = ["00", "20", "40", "41", "60"];
const CFOP_ST = ["5405", "5656", "5667"];

export function gtinValido(g?: string | null) {
  if (!g || g === "SEM GTIN") return true;
  if (!/^\d{8}$|^\d{12,14}$/.test(g)) return false;
  const d = g.split("").map(Number); const dv = d.pop()!;
  const soma = d.reverse().reduce((s, n, i) => s + n * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (soma % 10)) % 10 === dv;
}

export function validarItem(it: ItemFiscal, crt: "1" | "2" | "3"): ErroFiscal[] {
  const e: ErroFiscal[] = [];
  const add = (campo: string, mensagem: string, grave = true) => e.push({ campo, mensagem, grave });
  if (it.emite_nota === false) { add("emite_nota", "Produto marcado como \"não emite nota\""); return e; }
  const ncm = String(it.ncm || "").replace(/\D/g, "");
  if (!ncm) add("ncm", "NCM não informado", false); else if (ncm.length !== 8) add("ncm", "NCM deve ter 8 dígitos");
  if (it.cest && !/^\d{7}$/.test(String(it.cest).replace(/\D/g, ""))) add("cest", "CEST deve ter 7 dígitos");
  if (it.origem != null && it.origem !== "" && !/^[0-8]$/.test(String(it.origem))) add("origem", "Origem deve ser de 0 a 8");
  const cfop = String(it.cfop || "");
  if (!cfop) add("cfop", "CFOP não informado", false); else if (!/^5\d{3}$/.test(cfop)) add("cfop", "CFOP de venda ao consumidor deve começar com 5");
  if (crt === "3") {
    if (!it.cst_icms) add("cst_icms", "Regime normal exige CST do ICMS", false);
    else if (!CST_OK.includes(String(it.cst_icms))) add("cst_icms", "CST do ICMS não suportado");
    if (it.cst_icms === "60" && cfop && !CFOP_ST.includes(cfop)) add("cfop", "CST 60 exige CFOP de ST (5405)");
  } else {
    const c = String(it.csosn || "");
    if (!c) add("csosn", "CSOSN não informado", false);
    else if (!CSOSN_OK.includes(c)) add("csosn", "CSOSN inválido para o Simples Nacional");
    if (c === "500" && cfop && !CFOP_ST.includes(cfop)) add("cfop", "CSOSN 500 exige CFOP de ST (5405)");
    if (c && c !== "500" && c !== "900" && CFOP_ST.includes(cfop)) add("csosn", `CFOP ${cfop} exige CSOSN 500`);
  }
  if (!gtinValido(it.gtin)) add("gtin", "Código de barras (GTIN) com dígito verificador inválido", false);
  return e;
}
