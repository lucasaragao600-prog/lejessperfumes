import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/context/AuthContext";

export const PERMISSOES_REPOSICAO = [
  { key: "reposicao_visualizar", label: "Visualizar reposições" },
  { key: "reposicao_criar", label: "Criar reposição" },
  { key: "reposicao_editar", label: "Editar reposição" },
  { key: "reposicao_cancelar", label: "Cancelar reposição" },
  { key: "reposicao_separar", label: "Separar produtos" },
  { key: "reposicao_enviar", label: "Confirmar envio" },
  { key: "reposicao_receber", label: "Receber reposição" },
  { key: "reposicao_conferir", label: "Conferir recebimento" },
  { key: "reposicao_ver_itens_esperados", label: "Ver quantidades esperadas (sem conferência cega)" },
  { key: "reposicao_aprovar_divergencia", label: "Aprovar divergência" },
  { key: "reposicao_finalizar", label: "Finalizar reposição" },
  { key: "reposicao_visualizar_historico", label: "Ver histórico" },
  { key: "reposicao_visualizar_dashboard", label: "Ver painel de indicadores" },
] as const;

export type PermissaoKey = (typeof PERMISSOES_REPOSICAO)[number]["key"];

interface RolePermissionRow {
  id: string;
  role: AppRole;
  permission: string;
}

export function usePermissoes() {
  const { role } = useAuth();
  const qc = useQueryClient();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["role_permissions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("role_permissions").select("*");
      if (error) throw error;
      return (data || []) as RolePermissionRow[];
    },
  });

  const isMaster = role === "master";

  const can = (permission: PermissaoKey) =>
    isMaster || rows.some((r) => r.role === role && r.permission === permission);

  const roleHas = (r: AppRole, permission: string) =>
    r === "master" || rows.some((x) => x.role === r && x.permission === permission);

  const toggle = useMutation({
    mutationFn: async (p: { role: AppRole; permission: string; enabled: boolean }) => {
      if (p.enabled) {
        const { error } = await supabase
          .from("role_permissions")
          .upsert({ role: p.role, permission: p.permission }, { onConflict: "role,permission" });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("role_permissions")
          .delete()
          .eq("role", p.role)
          .eq("permission", p.permission);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["role_permissions"] }),
  });

  return { isLoading, isMaster, can, roleHas, toggle: toggle.mutateAsync };
}
