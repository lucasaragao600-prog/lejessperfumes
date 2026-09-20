import { useMemo, useState } from "react";
import { X, Loader2, ShieldCheck, UserCheck, UserX, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useAcessosUnidade } from "@/hooks/useAcessosUnidade";

interface Props {
  unidadeId: string;
  unidadeNome: string;
  onClose: () => void;
}

const MODULOS: Record<string, string> = {
  venda: "Vendas",
  estoque: "Estoque",
  reposicao: "Reposição",
  caixa: "Caixa",
  fiscal: "Fiscal",
  relatorio: "Relatórios",
};

export default function AcessosUnidade({ unidadeId, unidadeNome, onClose }: Props) {
  const { catalogo, usuarios, vinculos, permissoes, isLoading, definirAcesso, definirPermissao } =
    useAcessosUnidade(unidadeId);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const temAcesso = (usuarioId: string) =>
    vinculos.some((v) => v.usuarioId === usuarioId && v.ativo);

  const temPermissao = (usuarioId: string, chave: string) =>
    permissoes.some((p) => p.usuarioId === usuarioId && p.permissao === chave);

  const porModulo = useMemo(() => {
    const grupos: Record<string, typeof catalogo> = {};
    for (const p of catalogo) {
      grupos[p.modulo] = grupos[p.modulo] || [];
      grupos[p.modulo].push(p);
    }
    return grupos;
  }, [catalogo]);

  const alternarAcesso = async (usuarioId: string, ativo: boolean) => {
    setSalvando(true);
    try {
      await definirAcesso({ usuarioId, unidadeId, ativo });
      toast.success(ativo ? "Acesso concedido" : "Acesso revogado");
    } catch (e: any) {
      toast.error("Não foi possível alterar o acesso", { description: e?.message });
    } finally {
      setSalvando(false);
    }
  };

  const alternarPermissao = async (usuarioId: string, permissao: string, concedida: boolean) => {
    setSalvando(true);
    try {
      await definirPermissao({ usuarioId, unidadeId, permissao, concedida });
    } catch (e: any) {
      toast.error("Não foi possível alterar a permissão", { description: e?.message });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="w-full md:max-w-2xl max-h-[90vh] overflow-y-auto bg-surface rounded-t-2xl md:rounded-2xl border border-border p-4 space-y-3">
        <div className="flex items-center justify-between sticky top-0 bg-surface pb-2">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-gold" />
            <h3 className="text-sm font-semibold text-foreground">Acessos — {unidadeNome}</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground">
            <X size={18} />
          </button>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Conceda acesso à unidade e escolha o que cada pessoa pode fazer nela. O master tem acesso
          total a todas as unidades, independente destas marcações.
        </p>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-gold" />
          </div>
        ) : (
          <div className="space-y-2">
            {usuarios.map((u) => {
              const acesso = temAcesso(u.userId);
              const aberto = expandido === u.userId;
              return (
                <div key={u.userId} className="kpi-card p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">{u.nome || "Sem nome"}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {acesso ? "Com acesso a esta unidade" : "Sem acesso"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        disabled={salvando}
                        onClick={() => alternarAcesso(u.userId, !acesso)}
                        className={`flex items-center gap-1 text-[11px] px-2 py-1.5 rounded-lg border ${
                          acesso
                            ? "border-destructive/40 text-destructive"
                            : "border-gold-muted text-gold"
                        }`}
                      >
                        {acesso ? <UserX size={12} /> : <UserCheck size={12} />}
                        {acesso ? "Revogar" : "Conceder"}
                      </button>
                      <button
                        onClick={() => setExpandido(aberto ? null : u.userId)}
                        className="text-muted-foreground"
                        aria-label="Permissões"
                      >
                        <ChevronDown
                          size={16}
                          className={`transition-transform ${aberto ? "rotate-180" : ""}`}
                        />
                      </button>
                    </div>
                  </div>

                  {aberto && (
                    <div className="mt-3 space-y-3 border-t border-border pt-3">
                      {Object.entries(porModulo).map(([modulo, itens]) => (
                        <div key={modulo}>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                            {MODULOS[modulo] || modulo}
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                            {itens.map((p) => (
                              <label
                                key={p.chave}
                                className="flex items-center gap-2 text-xs text-foreground"
                              >
                                <input
                                  type="checkbox"
                                  disabled={salvando || !acesso}
                                  checked={temPermissao(u.userId, p.chave)}
                                  onChange={(e) =>
                                    alternarPermissao(u.userId, p.chave, e.target.checked)
                                  }
                                />
                                {p.descricao}
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                      {!acesso && (
                        <p className="text-[10px] text-muted-foreground">
                          Conceda o acesso à unidade para poder marcar as permissões.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
