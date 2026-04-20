import { useState, useMemo, useEffect, useRef } from "react";
import { ArrowLeft, Search, ScanBarcode, Save, CheckCircle2, AlertTriangle, Filter, Download } from "lucide-react";
import { useBalancos, useBalancoItens, type BalancoItem } from "@/hooks/useBalancos";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  sem_divergencia: "OK",
  sobra: "Sobra",
  falta: "Falta",
};

const STATUS_STYLE: Record<string, string> = {
  pendente: "bg-muted text-muted-foreground",
  sem_divergencia: "bg-success/15 text-success border border-success/30",
  sobra: "bg-warning/15 text-warning border border-warning/30",
  falta: "bg-destructive/15 text-destructive border border-destructive/30",
};

interface Props {
  balancoId: string;
  onBack: () => void;
  onOpenHistorico: (id: string) => void;
}

export default function BalancoConferencia({ balancoId, onBack, onOpenHistorico }: Props) {
  const { profile, role } = useAuth();
  const isMaster = role === "master";
  const { balancos, atualizarItem, concluirBalanco, aplicarAjustes, recalcularTotais } = useBalancos();
  const { data: itens = [], isLoading } = useBalancoItens(balancoId);
  const balanco = balancos.find((b) => b.id === balancoId);

  const [busca, setBusca] = useState("");
  const [filtroDeposito, setFiltroDeposito] = useState<string>("Todos");
  const [filtroStatus, setFiltroStatus] = useState<string>("Todos");
  const [edits, setEdits] = useState<Record<string, { qtd: string; just: string }>>({});
  const [showRevisao, setShowRevisao] = useState(false);
  const buscaRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    buscaRef.current?.focus();
  }, []);

  const depositos = useMemo(() => {
    const set = new Set(itens.map((i) => i.deposito));
    return ["Todos", ...Array.from(set)];
  }, [itens]);

  const filtrados = useMemo(() => {
    return itens.filter((i) => {
      if (filtroDeposito !== "Todos" && i.deposito !== filtroDeposito) return false;
      if (filtroStatus !== "Todos" && i.status !== filtroStatus) return false;
      if (busca) {
        const b = busca.toLowerCase();
        return (
          i.perfume_nome.toLowerCase().includes(b) ||
          i.perfume_codigo.toLowerCase().includes(b) ||
          i.marca.toLowerCase().includes(b)
        );
      }
      return true;
    });
  }, [itens, busca, filtroDeposito, filtroStatus]);

  const totalConferidos = itens.filter((i) => i.status !== "pendente").length;
  const totalDiverg = itens.filter((i) => i.status === "sobra" || i.status === "falta").length;
  const valorDiverg = itens.reduce((s, i) => s + Number(i.impacto_financeiro || 0), 0);
  const progresso = itens.length ? Math.round((totalConferidos / itens.length) * 100) : 0;

  const editavel = balanco?.status === "em_andamento" || balanco?.status === "rascunho";

  const handleSalvarItem = async (item: BalancoItem) => {
    const e = edits[item.id];
    if (!e || e.qtd === "") return;
    const qtd = parseInt(e.qtd, 10);
    if (isNaN(qtd) || qtd < 0) {
      toast.error("Quantidade inválida");
      return;
    }
    const diff = qtd - item.estoque_sistema;
    if (diff !== 0 && !e.just.trim()) {
      toast.error("Justificativa obrigatória para divergência");
      return;
    }
    await atualizarItem({
      itemId: item.id,
      quantidade_contada: qtd,
      justificativa: e.just,
      conferido_por: profile?.nome || "—",
      estoque_sistema: item.estoque_sistema,
      custo_unitario: item.custo_unitario,
    });
    setEdits((p) => {
      const n = { ...p };
      delete n[item.id];
      return n;
    });
    toast.success("Item conferido");
  };

  const handleConcluir = async () => {
    if (!balanco) return;
    if (totalConferidos < itens.length) {
      const ok = confirm(
        `${itens.length - totalConferidos} itens ainda não foram conferidos. Concluir mesmo assim?`
      );
      if (!ok) return;
    }
    await concluirBalanco({ balancoId, usuario: profile?.nome || "—" });
    toast.success("Balanço concluído");
  };

  const handleAplicar = async () => {
    if (!balanco || !isMaster) return;
    await aplicarAjustes({ balancoId, usuario: profile?.nome || "—" });
    toast.success("Ajustes aplicados ao estoque");
    setShowRevisao(false);
  };

  const handleSalvarTudo = async () => {
    let count = 0;
    for (const [itemId, e] of Object.entries(edits)) {
      if (e.qtd === "") continue;
      const item = itens.find((i) => i.id === itemId);
      if (!item) continue;
      const qtd = parseInt(e.qtd, 10);
      if (isNaN(qtd) || qtd < 0) continue;
      const diff = qtd - item.estoque_sistema;
      if (diff !== 0 && !e.just.trim()) continue;
      await atualizarItem({
        itemId: item.id,
        quantidade_contada: qtd,
        justificativa: e.just,
        conferido_por: profile?.nome || "—",
        estoque_sistema: item.estoque_sistema,
        custo_unitario: item.custo_unitario,
      });
      count++;
    }
    setEdits({});
    await recalcularTotais(balancoId);
    toast.success(`${count} itens salvos`);
  };

  if (!balanco) return null;

  const divergentes = itens.filter((i) => i.status === "sobra" || i.status === "falta");

  return (
    <div className="px-4 pt-4 pb-32 md:pb-12 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onBack} className="p-2 rounded-xl hover:bg-surface-raised transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <p className="page-subtitle">Balanço de Estoque</p>
            <h1 className="page-title truncate">{balanco.nome}</h1>
          </div>
        </div>
        <button
          onClick={() => onOpenHistorico(balancoId)}
          className="btn-secondary px-3 py-2 text-xs hidden md:inline-flex"
        >
          Auditoria
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiBox label="Itens" value={itens.length.toString()} />
        <KpiBox label="Conferidos" value={`${totalConferidos}/${itens.length}`} accent="gold" />
        <KpiBox label="Divergências" value={totalDiverg.toString()} accent={totalDiverg ? "warning" : "success"} />
        <KpiBox label="Impacto" value={`R$ ${valorDiverg.toFixed(2)}`} accent={valorDiverg ? "destructive" : "muted"} />
      </div>

      {/* Progresso */}
      <div className="card-premium p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">Progresso da conferência</span>
          <span className="text-xs font-semibold text-gold">{progresso}%</span>
        </div>
        <div className="h-2 bg-surface rounded-full overflow-hidden">
          <div
            className="h-full transition-all duration-300"
            style={{ width: `${progresso}%`, background: "var(--gradient-gold)" }}
          />
        </div>
      </div>

      {/* Filtros */}
      <div className="space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={buscaRef}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, código ou marca / scanner"
            className="input-premium pl-10 pr-3 py-3 w-full"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {depositos.map((d) => (
            <button
              key={d}
              onClick={() => setFiltroDeposito(d)}
              className={`pill ${filtroDeposito === d ? "pill-active" : "pill-inactive"}`}
            >
              {d}
            </button>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {["Todos", "pendente", "sem_divergencia", "sobra", "falta"].map((s) => (
            <button
              key={s}
              onClick={() => setFiltroStatus(s)}
              className={`pill ${filtroStatus === s ? "pill-active" : "pill-inactive"}`}
            >
              {s === "Todos" ? "Todos" : STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Carregando…</div>
      ) : filtrados.length === 0 ? (
        <div className="card-premium p-12 text-center">
          <p className="text-sm text-muted-foreground">Nenhum item encontrado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtrados.map((item) => {
            const e = edits[item.id] || { qtd: item.quantidade_contada?.toString() ?? "", just: item.justificativa };
            const qtdNum = e.qtd === "" ? null : parseInt(e.qtd, 10);
            const diffPreview = qtdNum !== null && !isNaN(qtdNum) ? qtdNum - item.estoque_sistema : null;
            return (
              <div key={item.id} className="card-premium p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{item.perfume_nome}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {item.perfume_codigo} · {item.marca} · {item.deposito}
                    </p>
                  </div>
                  <span className={`text-[10px] px-2 py-1 rounded-full font-semibold flex-shrink-0 ${STATUS_STYLE[item.status]}`}>
                    {STATUS_LABEL[item.status]}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-3">
                  <Field label="Sistema" value={item.estoque_sistema.toString()} />
                  <Field
                    label="Contado"
                    value={
                      editavel ? (
                        <input
                          type="number"
                          inputMode="numeric"
                          value={e.qtd}
                          onChange={(ev) =>
                            setEdits((p) => ({ ...p, [item.id]: { qtd: ev.target.value, just: e.just } }))
                          }
                          onWheel={(ev) => (ev.target as HTMLInputElement).blur()}
                          className="input-premium px-2 py-1 text-sm w-full text-center"
                          min={0}
                        />
                      ) : (
                        item.quantidade_contada?.toString() ?? "—"
                      )
                    }
                  />
                  <Field
                    label="Diferença"
                    value={
                      diffPreview !== null
                        ? diffPreview > 0 ? `+${diffPreview}` : diffPreview.toString()
                        : item.diferenca !== 0 ? (item.diferenca > 0 ? `+${item.diferenca}` : item.diferenca.toString()) : "0"
                    }
                    color={
                      (diffPreview ?? item.diferenca) > 0
                        ? "warning"
                        : (diffPreview ?? item.diferenca) < 0
                        ? "destructive"
                        : "success"
                    }
                  />
                </div>

                {editavel && diffPreview !== null && diffPreview !== 0 && (
                  <input
                    value={e.just}
                    onChange={(ev) =>
                      setEdits((p) => ({ ...p, [item.id]: { qtd: e.qtd, just: ev.target.value } }))
                    }
                    placeholder="Justificativa obrigatória para divergência"
                    className="input-premium px-3 py-2 text-xs w-full mb-2"
                  />
                )}

                {editavel && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">
                      Custo R$ {Number(item.custo_unitario).toFixed(2)} · Impacto R$ {item.impacto_financeiro.toFixed(2)}
                    </span>
                    <button
                      onClick={() => handleSalvarItem(item)}
                      disabled={!edits[item.id] || edits[item.id].qtd === ""}
                      className="btn-primary px-3 py-1.5 text-xs"
                    >
                      Salvar
                    </button>
                  </div>
                )}
                {!editavel && item.justificativa && (
                  <p className="text-xs text-muted-foreground italic">"{item.justificativa}"</p>
                )}
                {item.ajuste_aplicado && (
                  <p className="text-[10px] text-success mt-1 flex items-center gap-1">
                    <CheckCircle2 size={11} /> Ajuste aplicado ao estoque
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Action bar */}
      {editavel && Object.keys(edits).length > 0 && (
        <div className="fixed bottom-20 md:bottom-6 left-0 right-0 px-4 z-40">
          <div className="max-w-md md:max-w-2xl mx-auto card-premium p-3 flex gap-2 shadow-elevated">
            <button onClick={handleSalvarTudo} className="btn-secondary flex-1 py-2.5 text-sm">
              <Save size={14} /> Salvar todos ({Object.keys(edits).length})
            </button>
          </div>
        </div>
      )}

      {balanco.status === "em_andamento" && Object.keys(edits).length === 0 && (
        <button onClick={handleConcluir} className="btn-primary w-full py-3.5 text-sm">
          <CheckCircle2 size={16} /> Concluir balanço
        </button>
      )}

      {balanco.status === "concluido" && isMaster && (
        <button onClick={() => setShowRevisao(true)} className="btn-primary w-full py-3.5 text-sm">
          <AlertTriangle size={16} /> Revisar e aplicar ajustes ({divergentes.length})
        </button>
      )}

      {balanco.status === "ajustado" && (
        <div className="card-premium p-4 text-center text-sm text-success border border-success/30">
          <CheckCircle2 size={20} className="mx-auto mb-2" />
          Ajustes aplicados em {balanco.ajustado_em ? new Date(balanco.ajustado_em).toLocaleString("pt-BR") : "—"} por {balanco.ajustado_por}
        </div>
      )}

      {/* Modal de revisão */}
      {showRevisao && (
        <div className="fixed inset-0 z-[80] bg-background/80 backdrop-blur-sm flex items-end md:items-center justify-center p-4">
          <div className="card-premium w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="p-5 border-b border-border">
              <h3 className="font-display text-xl">Revisão de ajustes</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Confirme os ajustes que serão aplicados ao estoque
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-2">
              {divergentes.map((it) => (
                <div key={it.id} className="bg-surface rounded-lg p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate">{it.perfume_nome}</p>
                    <p className="text-[11px] text-muted-foreground">{it.deposito} · {it.justificativa || "Sem justificativa"}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs">{it.estoque_sistema} → {it.quantidade_contada}</p>
                    <p className={`text-[11px] font-semibold ${it.diferenca > 0 ? "text-warning" : "text-destructive"}`}>
                      {it.diferenca > 0 ? `+${it.diferenca}` : it.diferenca}
                    </p>
                  </div>
                </div>
              ))}
              {divergentes.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">Nenhuma divergência</p>
              )}
            </div>
            <div className="p-5 border-t border-border flex gap-2">
              <button onClick={() => setShowRevisao(false)} className="btn-secondary flex-1 py-2.5 text-sm">
                Cancelar
              </button>
              <button
                onClick={handleAplicar}
                disabled={divergentes.length === 0}
                className="btn-primary flex-1 py-2.5 text-sm"
              >
                Aplicar ajustes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiBox({ label, value, accent = "default" }: { label: string; value: string; accent?: string }) {
  const color =
    accent === "gold" ? "text-gold" :
    accent === "warning" ? "text-warning" :
    accent === "destructive" ? "text-destructive" :
    accent === "success" ? "text-success" :
    "text-foreground";
  return (
    <div className="kpi-card">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">{label}</p>
      <p className={`text-xl font-display font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function Field({ label, value, color }: { label: string; value: any; color?: string }) {
  const c =
    color === "warning" ? "text-warning" :
    color === "destructive" ? "text-destructive" :
    color === "success" ? "text-success" :
    "text-foreground";
  return (
    <div className="bg-surface rounded-lg p-2 text-center">
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <div className={`text-sm font-semibold ${c}`}>{value}</div>
    </div>
  );
}
