import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { usePermissoes, PERMISSOES_REPOSICAO } from "@/hooks/usePermissoes";

export default function PermissoesCargo() {
  const { isMaster, roleHas, toggle, isLoading } = usePermissoes();
  const [salvando, setSalvando] = useState<string | null>(null);

  if (!isMaster) return null;

  const alterar = async (permission: string, enabled: boolean) => {
    setSalvando(permission);
    try {
      await toggle({ role: "vendedor", permission, enabled });
    } catch {
      toast.error("Não foi possível salvar a permissão.");
    } finally {
      setSalvando(null);
    }
  };

  return (
    <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <KeyRound size={16} className="text-gold" />
        <h3 className="text-sm font-semibold text-foreground">Permissões de Reposição — Vendedor</h3>
      </div>
      <p className="text-[11px] text-muted-foreground">
        O perfil Master sempre tem acesso completo. Marque o que o vendedor pode fazer no módulo de Reposição.
      </p>
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Carregando…</p>
      ) : (
        <div className="space-y-1.5">
          {PERMISSOES_REPOSICAO.map((p) => {
            const ativo = roleHas("vendedor", p.key);
            return (
              <label key={p.key} className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-0">
                <span className="text-xs text-foreground">{p.label}</span>
                <span className="flex items-center gap-2">
                  {salvando === p.key && <Loader2 size={13} className="animate-spin text-muted-foreground" />}
                  <input
                    type="checkbox"
                    checked={ativo}
                    onChange={(e) => alterar(p.key, e.target.checked)}
                    className="w-4 h-4 accent-[hsl(var(--gold))]"
                  />
                </span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
