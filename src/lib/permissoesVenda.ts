/**
 * Permissões granulares de Trocas e Devoluções (Fase 3).
 * A regra definitiva vive no banco (fn__pode dentro das RPCs); aqui é só
 * a decisão de interface: esconder o que o usuário não pode fazer.
 */

export const PERMISSOES_TROCAS = {
  trocar: "venda.trocar",
  trocarEntreUnidades: "venda.trocar_entre_unidades",
  devolver: "venda.devolver",
  devolverForaPrazo: "venda.devolver_fora_prazo",
  cancelar: "venda.cancelar",
  quarentena: "devolucao.quarentena",
  reembolso: "devolucao.reembolso",
} as const;

export type PermissaoTrocaKey = keyof typeof PERMISSOES_TROCAS;

/** Master pode tudo; demais precisam da permissão concedida em ao menos uma unidade. */
export function podeAcao(
  isMaster: boolean,
  permissoes: { permissao: string }[],
  chave: string,
): boolean {
  if (isMaster) return true;
  return permissoes.some((p) => p.permissao === chave);
}
