import { useState, useMemo } from "react";
import { ArrowLeftRight, ArrowDown, RefreshCw, FlaskConical, Plus, Search, ArrowUpDown } from "lucide-react";
import { formatDate, type Deposito, type Movimentacao } from "@/data/mockData";
import { useApp } from "@/context/AppContext";

const depositos: Deposito[] = ["Casa", "Sumaúma", "Amazonas"];
const hoje = "2026-02-18";
const tipos = ["Entrada", "Ajuste", "Transferência", "Saída Tester"] as const;

const tipoConfig = {
  "Entrada": { icon: ArrowDown, color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/30" },
  "Ajuste": { icon: RefreshCw, color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/30" },
  "Transferência": { icon: ArrowLeftRight, color: "text-gold", bg: "bg-gold/10 border-gold-muted" },
  "Saída Tester": { icon: FlaskConical, color: "text-purple-400", bg: "bg-purple-400/10 border-purple-400/30" },
};

export default function Movimentacoes() {
  const { movimentacoes, setMovimentacoes, perfumes, baixarEstoque, adicionarEstoque, transferirEstoque, adicionarTester } = useApp();
  const [filtroTipo, setFiltroTipo] = useState<string>("Todos");
  const [busca, setBusca] = useState("");
  const [ordenacao, setOrdenacao] = useState<"recente" | "antiga">("recente");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    tipo: "Entrada" as typeof tipos[number],
    perfumeId: "",
    deposito: "" as Deposito | "",
    depositoOrigem: "" as Deposito | "",
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
      ordenacao === "recente"
        ? b.data.localeCompare(a.data)
        : a.data.localeCompare(b.data)
    );
    return result;
  }, [movimentacoes, filtroTipo, busca, ordenacao]);

  const handleSalvar = () => {
    if (!form.perfumeId || form.quantidade < 1) return;
    if (form.tipo === "Saída Tester" && !form.depositoOrigem) return;
    if (form.tipo === "Transferência" && (!form.depositoOrigem || !form.depositoDestino)) return;
    if (form.tipo !== "Transferência" && form.tipo !== "Saída Tester" && !form.deposito) return;

    const p = perfumes.find((x) => x.id === form.perfumeId)!;

    // Bloquear se estoque insuficiente para operações que reduzem
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
    } else if (form.tipo === "Ajuste" && form.quantidade < 0) {
      const est = p.estoques[form.deposito as Deposito];
      if (est < Math.abs(form.quantidade)) {
        alert(`Estoque insuficiente em ${form.deposito}. Disponível: ${est}`);
        return;
      }
    }

    const nova: Movimentacao = {
      id: `m${Date.now()}`,
      data: hoje,
      tipo: form.tipo,
      perfumeId: form.perfumeId,
      perfumeNome: p.nome,
      quantidade: form.tipo === "Ajuste" ? form.quantidade : Math.abs(form.quantidade),
      observacao: form.observacao || undefined,
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
      // Ajuste pode ser positivo ou negativo
      if (form.quantidade > 0) {
        adicionarEstoque(form.perfumeId, form.deposito as Deposito, form.quantidade);
      } else {
        baixarEstoque(form.perfumeId, form.deposito as Deposito, Math.abs(form.quantidade));
      }
    }

    setMovimentacoes([nova, ...movimentacoes]);
    setForm({ tipo: "Entrada", perfumeId: "", deposito: "", depositoOrigem: "", depositoDestino: "", quantidade: 1, observacao: "" });
    setShowForm(false);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 pt-12 pb-4"
        style={{ background: "linear-gradient(180deg, hsl(0 0% 7%) 80%, transparent)" }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="font-display text-2xl text-gold">Movimentações</h1>
            <p className="text-muted-foreground text-xs mt-0.5">{filtradas.length} registros</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-primary-foreground shadow-gold transition-all active:scale-95"
            style={{ background: "var(--gradient-gold)" }}
          >
            <Plus size={16} />
            Nova
          </button>
        </div>

        {/* Barra de busca */}
        <div className="relative mb-2">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por perfume..."
            className="w-full bg-surface border border-border rounded-xl pl-8 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold-muted"
          />
        </div>

        {/* Filtro tipo + ordenação */}
        <div className="flex gap-2 items-center">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide flex-1">
            {["Todos", ...tipos].map((t) => (
              <button
                key={t}
                onClick={() => setFiltroTipo(t)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  filtroTipo === t
                    ? "bg-gold text-primary-foreground border-gold shadow-gold"
                    : "bg-surface border-border text-muted-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <button
            onClick={() => setOrdenacao(o => o === "recente" ? "antiga" : "recente")}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all flex-shrink-0 ${ordenacao === "antiga" ? "border-gold-muted bg-gold/10 text-gold" : "border-border bg-surface text-muted-foreground"}`}
          >
            <ArrowUpDown size={13} />
          </button>
        </div>
      </div>

      {/* Formulário */}
      {showForm && (
        <div className="mx-4 mb-4 bg-surface border border-gold-muted rounded-xl p-4 animate-fade-in"
          style={{ boxShadow: "var(--shadow-gold)" }}>
          <h3 className="font-display text-base text-gold mb-3">Nova Movimentação</h3>
          <div className="space-y-3">
            {/* Tipo */}
            <div>
              <label className="text-[11px] text-muted-foreground mb-1.5 block">Tipo</label>
              <div className="grid grid-cols-2 gap-1.5">
                {tipos.map((t) => (
                  <button
                    key={t}
                    onClick={() => setForm({ ...form, tipo: t, depositoOrigem: "", depositoDestino: "", deposito: "" })}
                    className={`py-2 rounded-lg text-xs font-medium border transition-all ${
                      form.tipo === t
                        ? "border-gold bg-gold/15 text-gold"
                        : "border-border bg-surface-overlay text-muted-foreground"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Perfume */}
            <div>
              <label className="text-[11px] text-muted-foreground mb-1 block">Perfume</label>
              <select
                value={form.perfumeId}
                onChange={(e) => setForm({ ...form, perfumeId: e.target.value })}
                className="w-full bg-surface-overlay border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-gold-muted"
              >
                <option value="">Selecione...</option>
                {perfumes.map((p) => <option key={p.id} value={p.id}>{p.nome} — {p.marca}</option>)}
              </select>
              {(() => {
                const pf = perfumes.find((p) => p.id === form.perfumeId);
                return pf ? (
                  <div className="flex gap-2 mt-1.5">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-surface-overlay border border-border text-muted-foreground">{pf.concentracao}</span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-surface-overlay border border-border text-muted-foreground">{pf.volume} ml</span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-surface-overlay border border-border text-muted-foreground">{pf.marca}</span>
                  </div>
                ) : null;
              })()}
            </div>

            {/* Depósito(s) */}
            {form.tipo === "Transferência" ? (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block">Origem</label>
                  <select value={form.depositoOrigem} onChange={(e) => setForm({ ...form, depositoOrigem: e.target.value as Deposito })}
                    className="w-full bg-surface-overlay border border-border rounded-lg px-2 py-2.5 text-xs text-foreground focus:outline-none focus:border-gold-muted">
                    <option value="">Selecione</option>
                    {depositos.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block">Destino</label>
                  <select value={form.depositoDestino} onChange={(e) => setForm({ ...form, depositoDestino: e.target.value as Deposito })}
                    className="w-full bg-surface-overlay border border-border rounded-lg px-2 py-2.5 text-xs text-foreground focus:outline-none focus:border-gold-muted">
                    <option value="">Selecione</option>
                    {depositos.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
            ) : form.tipo === "Saída Tester" ? (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block">Depósito Origem</label>
                  <select value={form.depositoOrigem} onChange={(e) => setForm({ ...form, depositoOrigem: e.target.value as Deposito })}
                    className="w-full bg-surface-overlay border border-border rounded-lg px-2 py-2.5 text-xs text-foreground focus:outline-none focus:border-gold-muted">
                    <option value="">Selecione</option>
                    {depositos.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block">Destino</label>
                  <div className="bg-surface-overlay border border-purple-400/30 rounded-lg px-2 py-2.5 flex items-center gap-1.5">
                    <FlaskConical size={13} className="text-purple-400" />
                    <span className="text-xs text-purple-400 font-medium">Estoque Tester</span>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">Depósito</label>
                <select value={form.deposito} onChange={(e) => setForm({ ...form, deposito: e.target.value as Deposito })}
                  className="w-full bg-surface-overlay border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-gold-muted">
                  <option value="">Selecione...</option>
                  {depositos.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            )}

            {form.tipo === "Saída Tester" && form.perfumeId && form.depositoOrigem && (
              <div className="bg-purple-400/10 border border-purple-400/30 rounded-lg p-2.5">
                <p className="text-xs text-purple-400">
                  ⚠️ Será baixado do estoque de <strong>{form.depositoOrigem}</strong> e adicionado ao estoque de testers.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">Quantidade</label>
                <input type="number" value={form.quantidade}
                  onChange={(e) => setForm({ ...form, quantidade: parseInt(e.target.value) || 1 })}
                  className="w-full bg-surface-overlay border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-gold-muted" />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">Observação</label>
                <input type="text" value={form.observacao}
                  onChange={(e) => setForm({ ...form, observacao: e.target.value })}
                  placeholder="Opcional"
                  className="w-full bg-surface-overlay border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold-muted" />
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 rounded-xl text-sm border border-border text-muted-foreground">
                Cancelar
              </button>
              <button onClick={handleSalvar} disabled={!form.perfumeId}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground disabled:opacity-40"
                style={{ background: "var(--gradient-gold)" }}>
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lista */}
      <div className="px-4 space-y-2">
        {filtradas.map((m) => {
          const cfg = tipoConfig[m.tipo];
          const Icon = cfg.icon;
          const pf = perfumes.find((p) => p.id === m.perfumeId);
          return (
            <div key={m.id} className="bg-surface border border-border rounded-xl p-3.5 flex items-start gap-3"
              style={{ boxShadow: "0 2px 8px hsl(0 0% 0% / 0.3)" }}>
              <div className={`w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 mt-0.5 ${cfg.bg}`}>
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
                  <p className="text-[10px] text-muted-foreground truncate">
                    {pf.marca} · {pf.concentracao} · {pf.volume}ml
                  </p>
                )}
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {formatDate(m.data)} · {m.tipo}
                  {m.tipo === "Saída Tester" && m.deposito && ` · ${m.deposito} → Tester`}
                  {m.tipo === "Transferência" && m.depositoOrigem && ` · ${m.depositoOrigem} → ${m.depositoDestino}`}
                  {m.tipo !== "Saída Tester" && m.tipo !== "Transferência" && m.deposito && ` · ${m.deposito}`}
                </p>
                {m.observacao && (
                  <p className="text-[11px] text-muted-foreground italic mt-0.5">"{m.observacao}"</p>
                )}
              </div>
            </div>
          );
        })}
        {filtradas.length === 0 && (
          <div className="text-center py-16">
            <ArrowLeftRight size={40} className="text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground text-sm">Nenhuma movimentação encontrada</p>
          </div>
        )}
      </div>
    </div>
  );
}
