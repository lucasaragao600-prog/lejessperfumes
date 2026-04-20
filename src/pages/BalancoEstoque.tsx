import { useState, useMemo } from "react";
import { Plus, ClipboardCheck, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown, DollarSign, History, Trash2, Eye, Play } from "lucide-react";
import { useBalancos } from "@/hooks/useBalancos";
import { useAuth } from "@/context/AuthContext";
import BalancoNovo from "@/components/BalancoNovo";
import BalancoConferencia from "@/components/BalancoConferencia";
import BalancoDetalhes from "@/components/BalancoDetalhes";
import { toast } from "sonner";

type View = "lista" | "novo" | "conferencia" | "detalhes";

const STATUS_STYLE: Record<string, string> = {
  rascunho: "bg-muted text-muted-foreground",
  em_andamento: "bg-gold/15 text-gold border border-gold/30",
  concluido: "bg-primary/15 text-primary border border-primary/30",
  ajustado: "bg-success/15 text-success border border-success/30",
  cancelado: "bg-destructive/15 text-destructive border border-destructive/30",
};

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  ajustado: "Ajustado",
  cancelado: "Cancelado",
};

export default function BalancoEstoque() {
  const { balancos, isLoading, excluirBalanco } = useBalancos();
  const { role } = useAuth();
  const isMaster = role === "master";
  const [view, setView] = useState<View>("lista");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<string>("Todos");

  const kpis = useMemo(() => {
    const ativos = balancos.filter((b) => b.status === "em_andamento" || b.status === "rascunho");
    const concluidos = balancos.filter((b) => b.status === "concluido" || b.status === "ajustado");
    const divergencias = balancos.reduce((s, b) => s + (b.total_divergencias || 0), 0);
    const sobras = balancos.reduce((s, b) => s + (b.total_sobras || 0), 0);
    const faltas = balancos.reduce((s, b) => s + (b.total_faltas || 0), 0);
    const valor = balancos.reduce((s, b) => s + Number(b.valor_divergencia || 0), 0);
    return { ativos: ativos.length, concluidos: concluidos.length, divergencias, sobras, faltas, valor };
  }, [balancos]);

  const filtrados = useMemo(() => {
    if (filtroStatus === "Todos") return balancos;
    return balancos.filter((b) => b.status === filtroStatus);
  }, [balancos, filtroStatus]);

  if (view === "novo") {
    return (
      <BalancoNovo
        onBack={() => setView("lista")}
        onCreated={(id) => {
          setSelectedId(id);
          setView("conferencia");
        }}
      />
    );
  }
  if (view === "conferencia" && selectedId) {
    return (
      <BalancoConferencia
        balancoId={selectedId}
        onBack={() => setView("lista")}
        onOpenHistorico={(id) => {
          setSelectedId(id);
          setView("detalhes");
        }}
      />
    );
  }
  if (view === "detalhes" && selectedId) {
    return <BalancoDetalhes balancoId={selectedId} onBack={() => setView("lista")} />;
  }

  const handleExcluir = async (id: string, nome: string) => {
    if (!confirm(`Excluir balanço "${nome}"? Esta ação é permanente.`)) return;
    try {
      await excluirBalanco(id);
      toast.success("Balanço excluído");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao excluir");
    }
  };

  return (
    <div className="px-4 pt-4 pb-32 md:pb-12 space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="page-subtitle">Inventário</p>
          <h1 className="page-title">Balanço de Estoque</h1>
        </div>
        <button onClick={() => setView("novo")} className="btn-primary px-4 py-2.5 text-sm">
          <Plus size={16} /> Novo balanço
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi icon={<ClipboardCheck size={16} />} label="Ativos" value={kpis.ativos.toString()} accent="gold" />
        <Kpi icon={<CheckCircle2 size={16} />} label="Concluídos" value={kpis.concluidos.toString()} accent="success" />
        <Kpi icon={<AlertTriangle size={16} />} label="Divergências" value={kpis.divergencias.toString()} accent={kpis.divergencias ? "warning" : "muted"} />
        <Kpi icon={<DollarSign size={16} />} label="Impacto total" value={`R$ ${kpis.valor.toFixed(2)}`} accent="muted" />
        <Kpi icon={<TrendingUp size={16} />} label="Sobras" value={kpis.sobras.toString()} accent="warning" />
        <Kpi icon={<TrendingDown size={16} />} label="Faltas" value={kpis.faltas.toString()} accent="destructive" />
      </div>

      {/* Filtros */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {["Todos", "rascunho", "em_andamento", "concluido", "ajustado", "cancelado"].map((s) => (
          <button
            key={s}
            onClick={() => setFiltroStatus(s)}
            className={`pill ${filtroStatus === s ? "pill-active" : "pill-inactive"}`}
          >
            {s === "Todos" ? "Todos" : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Carregando…</div>
      ) : filtrados.length === 0 ? (
        <div className="card-premium p-12 text-center">
          <ClipboardCheck size={32} className="mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm text-muted-foreground mb-4">
            {filtroStatus === "Todos" ? "Nenhum balanço criado ainda" : "Nenhum balanço com este status"}
          </p>
          {filtroStatus === "Todos" && (
            <button onClick={() => setView("novo")} className="btn-primary px-4 py-2 text-sm">
              <Plus size={14} /> Criar primeiro balanço
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtrados.map((b) => {
            const progresso = b.total_itens ? Math.round((b.total_conferidos / b.total_itens) * 100) : 0;
            const editavel = b.status === "em_andamento" || b.status === "rascunho";
            return (
              <div key={b.id} className="card-premium p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-foreground truncate">{b.nome}</h3>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${STATUS_STYLE[b.status]}`}>
                        {STATUS_LABEL[b.status]}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {b.responsavel} · {b.depositos.join(", ")} · {new Date(b.iniciado_em).toLocaleString("pt-BR")}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 mb-3">
                  <Mini label="Itens" value={b.total_itens.toString()} />
                  <Mini label="Conferidos" value={`${b.total_conferidos}/${b.total_itens}`} />
                  <Mini label="Diverg." value={b.total_divergencias.toString()} color={b.total_divergencias ? "warning" : "muted"} />
                  <Mini label="Impacto" value={`R$ ${Number(b.valor_divergencia).toFixed(0)}`} color={b.valor_divergencia ? "destructive" : "muted"} />
                </div>

                {editavel && (
                  <div className="mb-3">
                    <div className="h-1.5 bg-surface rounded-full overflow-hidden">
                      <div
                        className="h-full transition-all duration-300"
                        style={{ width: `${progresso}%`, background: "var(--gradient-gold)" }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  {editavel ? (
                    <button
                      onClick={() => { setSelectedId(b.id); setView("conferencia"); }}
                      className="btn-primary flex-1 py-2 text-xs"
                    >
                      <Play size={12} /> Continuar conferência
                    </button>
                  ) : (
                    <button
                      onClick={() => { setSelectedId(b.id); setView("conferencia"); }}
                      className="btn-secondary flex-1 py-2 text-xs"
                    >
                      <Eye size={12} /> Abrir
                    </button>
                  )}
                  <button
                    onClick={() => { setSelectedId(b.id); setView("detalhes"); }}
                    className="btn-secondary px-3 py-2 text-xs"
                  >
                    <History size={12} />
                  </button>
                  {isMaster && (
                    <button
                      onClick={() => handleExcluir(b.id, b.nome)}
                      className="btn-secondary px-3 py-2 text-xs text-destructive"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Kpi({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) {
  const color =
    accent === "gold" ? "text-gold" :
    accent === "warning" ? "text-warning" :
    accent === "destructive" ? "text-destructive" :
    accent === "success" ? "text-success" :
    "text-foreground";
  return (
    <div className="kpi-card">
      <div className="flex items-center gap-2 mb-1.5 text-muted-foreground">
        {icon}
        <p className="text-[10px] uppercase tracking-wider">{label}</p>
      </div>
      <p className={`text-xl font-display font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function Mini({ label, value, color }: { label: string; value: string; color?: string }) {
  const c =
    color === "warning" ? "text-warning" :
    color === "destructive" ? "text-destructive" :
    "text-foreground";
  return (
    <div className="bg-surface rounded-lg p-2 text-center">
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-xs font-semibold ${c}`}>{value}</p>
    </div>
  );
}
