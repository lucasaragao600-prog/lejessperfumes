import { useState } from "react";
import { ShieldCheck, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { usePermissoes } from "@/hooks/usePermissoes";
import { useReposicao } from "@/hooks/useReposicao";
import { formatarDataHora } from "@/lib/reposicaoUtils";
import ReposicaoFotoPreview from "@/components/ReposicaoFotoPreview";

export default function Divergencias() {
  const { profile, user } = useAuth();
  const { can } = usePermissoes();
  const { reposicoes, divergencias, aprovarDivergencia } = useReposicao();
  const [processando, setProcessando] = useState<string | null>(null);
  const [apenasPendentes, setApenasPendentes] = useState(true);

  const usuario = { id: user?.id, nome: profile?.nome || user?.email || "Sistema" };
  const lista = divergencias.filter((d) => (apenasPendentes ? !d.aprovado_em : true));

  const aprovar = async (id: string) => {
    const d = divergencias.find((x) => x.id === id);
    if (!d) return;
    setProcessando(id);
    try {
      await aprovarDivergencia({ divergencia: d, usuario });
      toast.success("Divergência aprovada.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível aprovar.");
    } finally {
      setProcessando(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setApenasPendentes(true)}
          className={`px-3 py-1.5 rounded-full text-xs border ${apenasPendentes ? "border-gold text-gold" : "border-border text-muted-foreground"}`}
        >
          Pendentes
        </button>
        <button
          onClick={() => setApenasPendentes(false)}
          className={`px-3 py-1.5 rounded-full text-xs border ${!apenasPendentes ? "border-gold text-gold" : "border-border text-muted-foreground"}`}
        >
          Todas
        </button>
      </div>

      {lista.length === 0 && (
        <div className="card-premium p-8 text-center text-sm text-muted-foreground">
          <AlertTriangle size={28} className="mx-auto mb-3 opacity-40" />
          Nenhuma divergência {apenasPendentes ? "pendente" : "registrada"}.
        </div>
      )}

      {lista.map((d) => {
        const rep = reposicoes.find((r) => r.id === d.reposicao_id);
        return (
          <div key={d.id} className="card-premium p-4 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground break-words">{d.produto_nome}</p>
                <p className="text-[11px] text-muted-foreground">
                  {rep?.codigo} · {rep?.origem} → {rep?.destino}
                </p>
              </div>
              <span className="text-[10px] px-2 py-1 rounded-full border border-destructive/30 bg-destructive/10 text-destructive whitespace-nowrap">
                {d.tipo}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Enviado {d.quantidade_esperada} · Recebido {d.quantidade_recebida} · {d.usuario_nome} em {formatarDataHora(d.created_at)}
            </p>
            {d.justificativa && <p className="text-xs text-foreground">“{d.justificativa}”</p>}
            {d.foto_url && <ReposicaoFotoPreview path={d.foto_url} label="Foto da divergência" />}
            {d.aprovado_em ? (
              <p className="text-[11px] text-emerald-400">
                Aprovada por {d.aprovado_por_nome} em {formatarDataHora(d.aprovado_em)}
              </p>
            ) : can("reposicao_aprovar_divergencia") ? (
              <button
                onClick={() => aprovar(d.id)}
                disabled={processando === d.id}
                className="btn-primary px-4 py-2 text-xs flex items-center gap-2"
              >
                {processando === d.id ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />} Aprovar divergência
              </button>
            ) : (
              <p className="text-[11px] text-muted-foreground">Aguardando aprovação de um responsável.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
