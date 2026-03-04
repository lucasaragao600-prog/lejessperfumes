import { useState, useMemo } from "react";
import { getHojeManaus } from "@/lib/dateUtils";

function formatHoraManaus(iso?: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Manaus",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return "";
  }
}
import { ArrowLeftRight, ArrowDown, RefreshCw, FlaskConical, Plus, Search, ArrowUpDown } from "lucide-react";
import PerfumeSearchSelect from "@/components/PerfumeSearchSelect";
import { formatDate, type Deposito, type Movimentacao } from "@/data/mockData";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";

const depositos: Deposito[] = ["Casa", "Sumaúma", "Amazonas"];
const tipos = ["Entrada", "Ajuste", "Transferência", "Saída Tester"] as const;

const tipoConfig = {
  "Entrada": { icon: ArrowDown, color: "text-success", bg: "bg-success/10 border-success/30" },
  "Ajuste": { icon: RefreshCw, color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/30" },
  "Transferência": { icon: ArrowLeftRight, color: "text-gold", bg: "bg-primary/10 border-gold-muted" },
  "Saída Tester": { icon: FlaskConical, color: "text-purple-400", bg: "bg-purple-400/10 border-purple-400/30" },
};

export default function Movimentacoes() {
  const { movimentacoes, perfumes, baixarEstoque, adicionarEstoque, ajustarEstoque, transferirEstoque, adicionarTester, adicionarMovimentacao, concentracoesConfig } = useApp();
  const { profile, role } = useAuth();
  const isMaster = role === "master";
  const userLoja = (!isMaster && profile?.loja) ? profile.loja as Deposito : null;

  const [filtroTipo, setFiltroTipo] = useState<string>("Todos");
  const [busca, setBusca] = useState("");
  const [ordenacao, setOrdenacao] = useState<"recente" | "antiga">("recente");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    tipo: "Entrada" as typeof tipos[number],
    perfumeId: "",
    deposito: (userLoja || "") as Deposito | "",
    depositoOrigem: (userLoja || "") as Deposito | "",
    depositoDestino: "" as Deposito | "",
    quantidade: 1,
    observacao: "",
  });

  const filtradas = useMemo(() => {
    let result = movimentacoes.filter((m) => {
      const matchTipo = filtroTipo === "Todos" || m.tipo === filtroTipo;
      const matchBusca = busca.trim() === "" || m.perfumeNome.toLowerCase().includes(busca.toLowerCase());
      return matchTipo && matchBusca;
    });
    result = [...result].sort((a, b) =>
      ordenacao === "recente" ? b.data.localeCompare(a.data) : a.data.localeCompare(b.data)
    );
    return result;
  }, [movimentacoes, filtroTipo, busca, ordenacao]);

  const handleSalvar = async () => {
    if (!form.perfumeId) return;
    if (form.tipo !== "Ajuste" && form.quantidade < 1) return;
    if (form.tipo === "Saída Tester" && !form.depositoOrigem) return;
    if (form.tipo === "Transferência" && (!form.depositoOrigem || !form.depositoDestino)) return;
    if (form.tipo !== "Transferência" && form.tipo !== "Saída Tester" && !form.deposito) return;

    const p = perfumes.find((x) => x.id === form.perfumeId)!;

    if (form.tipo === "Saída Tester") {
      const est = p.estoques[form.depositoOrigem as Deposito];
      if (est < form.quantidade) {
        alert(`Estoque insuficiente em ${form.depositoOrigem}. Disponível: ${est}`);
        return;
      }
    } else if (form.tipo === "Transferência") {
      const est = p.estoques[form.depositoOrigem as Deposito];
      if (est < form.quantidade) {
        alert(`Estoque insuficiente em ${form.depositoOrigem}. Disponível: ${est}`);
        return;
      }
    }
    // Ajuste: allow any value >= 0 (absolute stock set)

    const hoje = getHojeManaus();
    const estoqueAtual = form.tipo === "Ajuste" ? p.estoques[form.deposito as Deposito] : 0;
    const diferencaAjuste = form.tipo === "Ajuste" ? form.quantidade - estoqueAtual : 0;
    const nova: Movimentacao = {
      id: `m${Date.now()}`,
      data: hoje,
      tipo: form.tipo,
      perfumeId: form.perfumeId,
      perfumeNome: p.nome,
      quantidade: form.tipo === "Ajuste" ? diferencaAjuste : Math.abs(form.quantidade),
      observacao: form.tipo === "Ajuste" ? `Ajuste: ${estoqueAtual} → ${form.quantidade}${form.observacao ? ` | ${form.observacao}` : ""}` : (form.observacao || undefined),
      registradoPor: profile?.nome || "Desconhecido",
      ...(form.tipo === "Transferência"
        ? { depositoOrigem: form.depositoOrigem as Deposito, depositoDestino: form.depositoDestino as Deposito }
        : form.tipo === "Saída Tester"
        ? { depositoOrigem: form.depositoOrigem as Deposito, depositoDestino: undefined, deposito: form.depositoOrigem as Deposito }
        : { deposito: form.deposito as Deposito }),
    };

    if (form.tipo === "Saída Tester") {
      baixarEstoque(form.perfumeId, form.depositoOrigem as Deposito, form.quantidade);
      adicionarTester(form.perfumeId, form.depositoOrigem as Deposito, form.quantidade);
    } else if (form.tipo === "Transferência") {
      transferirEstoque(form.perfumeId, form.depositoOrigem as Deposito, form.depositoDestino as Deposito, form.quantidade);
    } else if (form.tipo === "Entrada") {
      adicionarEstoque(form.perfumeId, form.deposito as Deposito, form.quantidade);
    } else if (form.tipo === "Ajuste") {
      ajustarEstoque(form.perfumeId, form.deposito as Deposito, form.quantidade);
    }

    await adicionarMovimentacao(nova);
    setForm({ tipo: "Entrada", perfumeId: "", deposito: userLoja || "", depositoOrigem: userLoja || "", depositoDestino: "", quantidade: 1, observacao: "" });
    setShowForm(false);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 pt-12 pb-4"
        style={{ background: "var(--gradient-header)" }}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="page-title">Movimentações</h1>
            <p className="page-subtitle mt-1">{filtradas.length} registros</p>
          </div>
          <button onClick={() => setShowForm(!showForm)} className="btn-primary px-4 py-2">
            <Plus size={16} /> Nova
          </button>
        </div>

        <div className="relative mb-3">
          <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" value={busca} onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por perfume..."
            className="input-premium pl-9 pr-3 py-2.5 text-xs" />
        </div>

        <div className="flex gap-2 items-center">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide flex-1">
            {["Todos", ...tipos].map((t) => (
              <button key={t} onClick={() => setFiltroTipo(t)}
                className={`pill ${filtroTipo === t ? "pill-active" : "pill-inactive"}`}>
                {t}
              </button>
            ))}
          </div>
          <button
            onClick={() => setOrdenacao(o => o === "recente" ? "antiga" : "recente")}
            className={`btn-secondary px-2.5 py-1.5 flex-shrink-0 ${ordenacao === "antiga" ? "border-gold-muted text-gold" : ""}`}>
            <ArrowUpDown size={13} />
          </button>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="mx-4 mb-5 card-premium p-5 animate-fade-in" style={{ boxShadow: "var(--shadow-gold)" }}>
          <h3 className="font-display text-lg text-foreground mb-4">Nova Movimentação</h3>
          <div className="space-y-4">
            <div>
              <label className="text-[11px] text-muted-foreground mb-2 block uppercase tracking-wider font-medium">Tipo</label>
              <div className="grid grid-cols-2 gap-2">
                {tipos.map((t) => (
                  <button key={t}
                    onClick={() => setForm({ ...form, tipo: t, depositoOrigem: userLoja || "", depositoDestino: "", deposito: userLoja || "" })}
                    className={`py-2.5 rounded-xl text-xs font-medium border transition-all duration-150 ${
                      form.tipo === t
                        ? "border-gold-muted bg-primary/10 text-gold"
                        : "border-border bg-surface-overlay text-muted-foreground hover:text-foreground"
                    }`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[11px] text-muted-foreground mb-2 block uppercase tracking-wider font-medium">Perfume</label>
              <PerfumeSearchSelect perfumes={perfumes} value={form.perfumeId}
                onChange={(id) => setForm({ ...form, perfumeId: id })} concentracoesConfig={concentracoesConfig} />
            </div>

            {form.tipo === "Transferência" ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-muted-foreground mb-2 block uppercase tracking-wider font-medium">Origem</label>
                  <select value={form.depositoOrigem} onChange={(e) => setForm({ ...form, depositoOrigem: e.target.value as Deposito })}
                    className="input-premium px-3 py-2.5 text-xs" disabled={!!userLoja}>
                    <option value="">Selecione</option>
                    {depositos.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground mb-2 block uppercase tracking-wider font-medium">Destino</label>
                  <select value={form.depositoDestino} onChange={(e) => setForm({ ...form, depositoDestino: e.target.value as Deposito })}
                    className="input-premium px-3 py-2.5 text-xs">
                    <option value="">Selecione</option>
                    {depositos.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
            ) : form.tipo === "Saída Tester" ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-muted-foreground mb-2 block uppercase tracking-wider font-medium">Depósito Origem</label>
                  <select value={form.depositoOrigem} onChange={(e) => setForm({ ...form, depositoOrigem: e.target.value as Deposito })}
                    className="input-premium px-3 py-2.5 text-xs" disabled={!!userLoja}>
                    <option value="">Selecione</option>
                    {depositos.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground mb-2 block uppercase tracking-wider font-medium">Destino</label>
                  <div className="bg-purple-400/8 border border-purple-400/25 rounded-xl px-3 py-2.5 flex items-center gap-1.5">
                    <FlaskConical size={13} className="text-purple-400" />
                    <span className="text-xs text-purple-400 font-medium">Estoque Tester</span>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <label className="text-[11px] text-muted-foreground mb-2 block uppercase tracking-wider font-medium">Depósito</label>
                <select value={form.deposito} onChange={(e) => setForm({ ...form, deposito: e.target.value as Deposito })}
                  className="input-premium px-3 py-2.5 text-sm" disabled={!!userLoja}>
                  <option value="">Selecione...</option>
                  {depositos.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            )}

            {form.tipo === "Saída Tester" && form.perfumeId && form.depositoOrigem && (
              <div className="bg-purple-400/8 border-l-4 border border-purple-400/20 rounded-xl p-3" style={{ borderLeftColor: "rgb(192 132 252)" }}>
                <p className="text-xs text-purple-400">
                  ⚠️ Será baixado do estoque de <strong>{form.depositoOrigem}</strong> e adicionado ao estoque de testers.
                </p>
              </div>
            )}

            {form.tipo === "Ajuste" && form.perfumeId && form.deposito && (() => {
              const pf = perfumes.find((x) => x.id === form.perfumeId);
              const estoqueAtual = pf ? pf.estoques[form.deposito as Deposito] : 0;
              return (
                <div className="bg-blue-400/8 border-l-4 border border-blue-400/20 rounded-xl p-3" style={{ borderLeftColor: "rgb(96 165 250)" }}>
                  <p className="text-xs text-blue-400">
                    📦 Estoque atual em <strong>{form.deposito}</strong>: <strong>{estoqueAtual}</strong> un.
                    <br />
                    <span className="text-[10px] opacity-80">Digite a quantidade correta. Use 0 para zerar o estoque.</span>
                  </p>
                </div>
              );
            })()}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-muted-foreground mb-2 block uppercase tracking-wider font-medium">
                  {form.tipo === "Ajuste" ? "Qtd. Correta" : "Quantidade"}
                </label>
                <input type="number" min={form.tipo === "Ajuste" ? 0 : 1}
                  value={form.quantidade}
                  onChange={(e) => setForm({ ...form, quantidade: e.target.value === "" ? 0 : parseInt(e.target.value) || 0 })}
                  className="input-premium px-3 py-2.5 text-sm" />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground mb-2 block uppercase tracking-wider font-medium">Observação</label>
                <input type="text" value={form.observacao}
                  onChange={(e) => setForm({ ...form, observacao: e.target.value })}
                  placeholder="Opcional"
                  className="input-premium px-3 py-2.5 text-sm" />
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowForm(false)} className="btn-secondary flex-1 py-2.5">
                Cancelar
              </button>
              <button onClick={handleSalvar} disabled={!form.perfumeId} className="btn-primary flex-1 py-2.5">
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      <div className="px-4 space-y-2.5">
        {filtradas.map((m) => {
          const cfg = tipoConfig[m.tipo];
          const Icon = cfg.icon;
          const pf = perfumes.find((p) => p.id === m.perfumeId);
          return (
            <div key={m.id} className="card-premium p-4 flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 mt-0.5 ${cfg.bg}`}>
                <Icon size={16} className={cfg.color} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground truncate">{m.perfumeNome}</p>
                  <p className={`text-sm font-bold flex-shrink-0 ${cfg.color}`}>
                    {m.tipo === "Ajuste" ? (m.quantidade > 0 ? "+" : "") : m.tipo === "Entrada" ? "+" : "-"}{Math.abs(m.quantidade)}
                  </p>
                </div>
                {pf && (
                  <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                    {pf.marca} · {pf.concentracao} · {pf.volume}ml
                  </p>
                )}
                <p className="text-[11px] text-muted-foreground mt-1">
                  {formatDate(m.data)} · {m.tipo}
                  {m.tipo === "Saída Tester" && m.deposito && ` · ${m.deposito} → Tester`}
                  {m.tipo === "Transferência" && m.depositoOrigem && ` · ${m.depositoOrigem} → ${m.depositoDestino}`}
                  {m.tipo !== "Saída Tester" && m.tipo !== "Transferência" && m.deposito && ` · ${m.deposito}`}
                </p>
                {m.observacao && (
                  <p className="text-[11px] text-muted-foreground italic mt-0.5">"{m.observacao}"</p>
                )}
                {m.registradoPor && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    por {m.registradoPor}{m.criadoEm ? ` às ${formatHoraManaus(m.criadoEm)}` : ""}
                  </p>
                )}
              </div>
            </div>
          );
        })}
        {filtradas.length === 0 && (
          <div className="text-center py-20">
            <ArrowLeftRight size={40} className="text-muted-foreground mx-auto mb-4 opacity-40" />
            <p className="text-muted-foreground text-sm">Nenhuma movimentação encontrada</p>
          </div>
        )}
      </div>
    </div>
  );
}
