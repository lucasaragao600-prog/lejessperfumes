import { useMemo, useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePermissoes, PERMISSOES_REPOSICAO } from "@/hooks/usePermissoes";
import type { AppRole } from "@/context/AuthContext";

const PERFIS: { role: AppRole; label: string }[] = [
  { role: "vendedor_lider", label: "Vendedor Líder" },
  { role: "vendedor", label: "Vendedor" },
];

const MODULOS: Record<string, string> = {
  venda: "Vendas", estoque: "Estoque", caixa: "Caixa", fiscal: "Fiscal", relatorio: "Relatórios",
  credito: "Crédito", reposicao: "Reposição", decants: "Decants", custo: "Custos", produto: "Produtos",
  devolucao: "Trocas e devoluções", nt: "Notas de transferência",
};

export default function PermissoesCargo() {
  const { isMaster, roleHas, toggle, isLoading } = usePermissoes();
  const [perfil, setPerfil] = useState<AppRole>("vendedor_lider");
  const [salvando, setSalvando] = useState<string | null>(null);

  const { data: catalogo = [] } = useQuery({
    queryKey: ["permissoes_catalogo"],
    queryFn: async () => {
      const { data, error } = await supabase.from("permissoes_catalogo").select("chave, modulo, descricao").order("chave");
      if (error) throw error;
      return data || [];
    },
    enabled: isMaster,
  });

  const grupos = useMemo(() => {
    const itens = [
      ...catalogo.map((c) => ({ key: c.chave, label: c.descricao, modulo: c.modulo })),
      ...PERMISSOES_REPOSICAO.map((p) => ({ key: p.key, label: p.label, modulo: "reposicao" })),
    ];
    const m = new Map<string, typeof itens>();
    for (const i of itens) m.set(i.modulo, [...(m.get(i.modulo) || []), i]);
    return [...m.entries()].sort(([a], [b]) => (MODULOS[a] || a).localeCompare(MODULOS[b] || b));
  }, [catalogo]);

  if (!isMaster) return null;

  const alterar = async (permission: string, enabled: boolean) => {
    setSalvando(permission);
    try {
      await toggle({ role: perfil, permission, enabled });
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
        <h3 className="text-sm font-semibold text-foreground">Permissões por perfil</h3>
      </div>
      <p className="text-[11px] text-muted-foreground">
        O Master sempre tem acesso completo. Cada perfil continua limitado à própria loja. "Ver custo" libera custo, margem e lucro.
      </p>
      <div className="flex gap-2">
        {PERFIS.map((p) => (
          <button key={p.role} onClick={() => setPerfil(p.role)}
            className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all ${perfil === p.role ? "bg-gold/20 text-gold border-gold-muted" : "bg-surface-overlay border-border text-muted-foreground"}`}>
            {p.label}
          </button>
        ))}
      </div>
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Carregando…</p>
      ) : (
        <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
          {grupos.map(([modulo, itens]) => (
            <div key={modulo}>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">{MODULOS[modulo] || modulo}</p>
              {itens.map((p) => (
                <label key={p.key} className="flex items-center justify-between gap-3 py-1.5 border-b border-border last:border-0">
                  <span className="text-xs text-foreground">{p.label}</span>
                  <span className="flex items-center gap-2">
                    {salvando === p.key && <Loader2 size={13} className="animate-spin text-muted-foreground" />}
                    <input type="checkbox" checked={roleHas(perfil, p.key)}
                      onChange={(e) => alterar(p.key, e.target.checked)}
                      className="w-4 h-4 accent-[hsl(var(--gold))]" aria-label={p.label} />
                  </span>
                </label>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
