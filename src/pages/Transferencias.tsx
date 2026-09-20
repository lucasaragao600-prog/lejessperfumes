import { useMemo, useState } from "react";
import { ArrowLeftRight, Plus, ListOrdered, AlertTriangle } from "lucide-react";
import { useUnidades } from "@/hooks/useUnidades";
import { TRF_STATUS_META, useTransferencias, type Transferencia } from "@/hooks/useTransferencias";
import NovaTransferencia from "@/components/transferencias/NovaTransferencia";
import TransferenciaDetalhe from "@/components/transferencias/TransferenciaDetalhe";

type SubTab = "lista" | "nova" | "divergencias";

export default function Transferencias() {
  const { transferencias, isLoading } = useTransferencias();
  const { todas } = useUnidades({ contexto: "historico" });
  const [tab, setTab] = useState<SubTab>("lista");
  const [abertaId, setAbertaId] = useState<string | null>(null);
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroUnidade, setFiltroUnidade] = useState("");
  const [busca, setBusca] = useState("");

  const aberta = transferencias.find((t) => t.id === abertaId) || null;
  const nomeUnidade = (id: string) => todas.find((u) => u.id === id)?.nomeExibicao || "—";
  const divergentes = transferencias.filter((t) => t.status === "AGUARDANDO_TRATAMENTO");

  const lista = useMemo(() => {
    const base = tab === "divergencias" ? divergentes : transferencias;
    const q = busca.trim().toLowerCase();
    return base.filter((t) => {
      if (filtroStatus && t.status !== filtroStatus) return false;
      if (filtroUnidade && t.origem_unidade_id !== filtroUnidade && t.destino_unidade_id !== filtroUnidade) return false;
      if (q && !t.numero.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [transferencias, divergentes, tab, filtroStatus, filtroUnidade, busca]);

  if (aberta) {
    return (
      <div className="px-4 py-4 max-w-4xl mx-auto">
        <TransferenciaDetalhe transferencia={aberta as Transferencia} onVoltar={() => setAbertaId(null)} />
      </div>
    );
  }

  return (
    <div className="px-4 py-4 max-w-5xl mx-auto space-y-4 pb-24">
      <div className="flex items-center gap-2">
        <ArrowLeftRight size={18} className="text-gold" />
        <h1 className="page-title">Transferências</h1>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {([
          { id: "lista", label: "Todas", icon: ListOrdered },
          { id: "nova", label: "Nova", icon: Plus },
          { id: "divergencias", label: `Divergências${divergentes.length ? ` (${divergentes.length})` : ""}`, icon: AlertTriangle },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id as SubTab)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap border ${
              tab === id ? "border-gold/40 text-gold bg-gold/5" : "border-border text-muted-foreground"
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {tab === "nova" ? (
        <NovaTransferencia onCriada={(id) => { setTab("lista"); setAbertaId(id); }} />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por número"
              className="bg-surface-raised text-foreground border border-border rounded-lg px-3 py-2 text-sm"
            />
            <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}
              className="bg-surface-raised text-foreground border border-border rounded-lg px-3 py-2 text-sm">
              <option value="">Todos os status</option>
              {Object.entries(TRF_STATUS_META).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <select value={filtroUnidade} onChange={(e) => setFiltroUnidade(e.target.value)}
              className="bg-surface-raised text-foreground border border-border rounded-lg px-3 py-2 text-sm">
              <option value="">Todas as unidades</option>
              {todas.map((u) => (
                <option key={u.id} value={u.id}>{u.nomeExibicao}</option>
              ))}
            </select>
          </div>

          {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {!isLoading && lista.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma transferência encontrada.</p>
          )}

          <div className="space-y-2">
            {lista.map((t) => {
              const meta = TRF_STATUS_META[t.status];
              return (
                <button key={t.id} onClick={() => setAbertaId(t.id)}
                  className="w-full card p-3.5 text-left hover:border-gold/30 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{t.numero}</span>
                    <span className={`ml-auto text-[11px] px-2 py-0.5 rounded-full border ${meta.className}`}>{meta.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {nomeUnidade(t.origem_unidade_id)} → {nomeUnidade(t.destino_unidade_id)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(t.created_at).toLocaleString("pt-BR", { timeZone: "America/Manaus" })} · {t.criado_por_nome}
                  </p>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
