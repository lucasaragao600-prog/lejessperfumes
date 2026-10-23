export const STATUS_DEVOLUCAO_FISCAL = {
  pendente: "Fiscal pendente",
  em_analise: "Em análise contábil",
  rejeitada: "Pendência / Rejeição fiscal",
  documento_informado: "NF-e de entrada informada",
} as const;

/** Checks the NF-e access key structure, model and modulo-11 check digit. */
export function chaveEntradaValida(chave: string): boolean {
  if (!/^\d{44}$/.test(chave) || chave.slice(20, 22) !== "55") return false;
  let soma = 0;
  let peso = 2;
  for (let i = 42; i >= 0; i--) {
    soma += Number(chave[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const calculado = 11 - (soma % 11);
  return Number(chave[43]) === (calculado >= 10 ? 0 : calculado);
}