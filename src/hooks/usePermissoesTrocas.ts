import { useAuth } from "@/context/AuthContext";
import { useMinhasPermissoes } from "@/hooks/useAcessosUnidade";
import { PERMISSOES_TROCAS, podeAcao } from "@/lib/permissoesVenda";

/**
 * Permissões de Trocas e Devoluções do usuário logado (interface).
 * A validação definitiva acontece no banco dentro de cada RPC; este hook
 * apenas esconde botões que o usuário não poderia concluir.
 */
export function usePermissoesTrocas() {
  const { role } = useAuth();
  const minhas = useMinhasPermissoes();
  const isMaster = role === "master";
  const perms = minhas.data || [];

  const podeTrocar = podeAcao(isMaster, perms, PERMISSOES_TROCAS.trocar);
  const podeDevolver = podeAcao(isMaster, perms, PERMISSOES_TROCAS.devolver);
  const podeCancelar = podeAcao(isMaster, perms, PERMISSOES_TROCAS.cancelar);
  const podeQuarentena = podeAcao(isMaster, perms, PERMISSOES_TROCAS.quarentena);

  return {
    isMaster,
    carregando: minhas.isLoading,
    podeTrocar,
    podeDevolver,
    podeCancelar,
    podeQuarentena,
    podeAlgumaAcao: podeTrocar || podeDevolver,
  };
}
