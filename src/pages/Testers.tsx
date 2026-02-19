import { useState, useMemo } from "react";
import { FlaskConical, Search, Plus, Trash2 } from "lucide-react";
import { formatCurrency, type Deposito } from "@/data/mockData";
import { useApp } from "@/context/AppContext";

const depositos: Deposito[] = ["Casa", "Sumaúma", "Amazonas"];

export default function Testers() {
  const { testers, setTesters, perfumes } = useApp();
  const [busca, setBusca] = useState("");
  const [filtroDeposito, setFiltroDeposito] = useState<Deposito | "Todos">("Todos");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ perfumeId: "", deposito: "" as Deposito | "", quantidade: 1 });

  const filtrados = useMemo(() => {
    const q = busca.toLowerCase();
    return testers.filter((t) => {
      const matchBusca = t.perfumeNome.toLowerCase().includes(q) || t.marca.toLowerCase().includes(q);
      const matchDeposito = filtroDeposito === "Todos" || t.deposito === filtroDeposito;
      return matchBusca && matchDeposito;
    });
  }, [testers, busca, filtroDeposito]);

  // Resumo por depósito
  const resumoPorDeposito = useMemo(() => {
    const mapa: Record<string, { qtd: number; custo: number }> = {};
    depositos.forEach((d) => { mapa[d] = { qtd: 0, custo: 0 }; });
    testers.forEach((t) => {
      if (mapa[t.deposito]) {
        mapa[t.deposito].qtd += t.quantidade;
        mapa[t.deposito].custo += t.quantidade * t.custo;
      }
    });
    return mapa;
  }, [testers]);

  const totalCusto = useMemo(
    () => testers.reduce((acc, t) => acc + t.quantidade * t.custo, 0),
    [testers]
  );

  const handleAdicionar = () => {
    if (!form.perfumeId || !form.deposito || form.quantidade < 1) return;
    const deposito = form.deposito as Deposito;
    const p = perfumes.find((x) => x.id === form.perfumeId)!;
    const existente = testers.find((t) => t.perfumeId === form.perfumeId && t.deposito === deposito);
    if (existente) {
      setTesters(testers.map((t) =>
        t.perfumeId === form.perfumeId && t.deposito === deposito
          ? { ...t, quantidade: t.quantidade + form.quantidade }
          : t
      ));
    } else {
      setTesters([...testers, {
        id: `t${Date.now()}`,
        perfumeId: p.id,
        perfumeNome: p.nome,
        marca: p.marca,
        deposito,
        quantidade: form.quantidade,
        custo: p.custo,
      }]);
    }
    setForm({ perfumeId: "", deposito: "", quantidade: 1 });
    setShowForm(false);
  };

  const handleRemover = (id: string) => {
    setTesters(testers.filter((t) => t.id !== id));
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 pt-12 pb-4"
        style={{ background: "linear-gradient(180deg, hsl(0 0% 7%) 80%, transparent)" }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="font-display text-2xl text-gold">Testers</h1>
            <p className="text-muted-foreground text-xs mt-0.5">{testers.length} perfumes em teste</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-primary-foreground shadow-gold transition-all active:scale-95"
            style={{ background: "var(--gradient-gold)" }}
          >
            <Plus size={16} />
            Adicionar
          </button>
        </div>

        {/* Cards por depósito */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {depositos.map((d) => (
            <button
              key={d}
              onClick={() => setFiltroDeposito(filtroDeposito === d ? "Todos" : d)}
              className={`rounded-xl p-2.5 border text-left transition-all ${
                filtroDeposito === d
                  ? "border-gold bg-gold/10"
                  : "border-border bg-surface"
              }`}
            >
              <p className={`text-[9px] mb-0.5 ${filtroDeposito === d ? "text-gold" : "text-muted-foreground"}`}>{d}</p>
              <p className={`text-sm font-bold ${filtroDeposito === d ? "text-gold" : "text-foreground"}`}>
                {resumoPorDeposito[d]?.qtd ?? 0} <span className="text-[9px] font-normal">un.</span>
              </p>
              <p className="text-[9px] text-muted-foreground">{formatCurrency(resumoPorDeposito[d]?.custo ?? 0)}</p>
            </button>
          ))}
        </div>

        {/* Card total */}
        <div className="bg-surface border border-gold-muted rounded-xl p-3 mb-3 flex justify-between items-center"
          style={{ background: "var(--gradient-gold-subtle)", boxShadow: "var(--shadow-gold)" }}>
          <div>
            <p className="text-xs text-muted-foreground">Total geral em custo</p>
            <p className="font-display text-xl text-gold">{formatCurrency(totalCusto)}</p>
          </div>
          <p className="text-sm text-muted-foreground">{testers.reduce((a, t) => a + t.quantidade, 0)} unid.</p>
        </div>

        {/* Busca */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar perfume ou marca..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full bg-surface border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold-muted"
          />
        </div>
      </div>

      {/* Formulário */}
      {showForm && (
        <div className="mx-4 mb-4 bg-surface border border-gold-muted rounded-xl p-4 animate-fade-in"
          style={{ boxShadow: "var(--shadow-gold)" }}>
          <h3 className="font-display text-base text-gold mb-3">Adicionar Tester</h3>
          <div className="space-y-3">
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
              {(() => { const pf = perfumes.find((p) => p.id === form.perfumeId); return pf ? (
                <div className="flex gap-2 mt-1.5">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-surface-overlay border border-border text-muted-foreground">
                    {pf.concentracao}
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-surface-overlay border border-border text-muted-foreground">
                    {pf.volume} ml
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-surface-overlay border border-border text-muted-foreground">
                    {pf.marca}
                  </span>
                </div>
              ) : null; })()}
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground mb-1 block">Depósito de origem</label>
              <div className="grid grid-cols-3 gap-1.5">
                {depositos.map((d) => (
                  <button
                    key={d}
                    onClick={() => setForm({ ...form, deposito: d })}
                    className={`py-2 rounded-lg text-xs font-medium border transition-all ${
                      form.deposito === d
                        ? "border-gold bg-gold/15 text-gold"
                        : "border-border bg-surface-overlay text-muted-foreground"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground mb-1 block">Quantidade</label>
              <input
                type="number" min={1} value={form.quantidade}
                onChange={(e) => setForm({ ...form, quantidade: parseInt(e.target.value) || 1 })}
                className="w-full bg-surface-overlay border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-gold-muted"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 rounded-xl text-sm border border-border text-muted-foreground">
                Cancelar
              </button>
              <button onClick={handleAdicionar} disabled={!form.perfumeId || !form.deposito}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground disabled:opacity-40"
                style={{ background: "var(--gradient-gold)" }}>
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lista */}
      <div className="px-4 space-y-3">
        {filtrados.map((t) => (
          <div key={t.id} className="bg-surface border border-border rounded-xl p-4"
            style={{ boxShadow: "0 2px 12px hsl(0 0% 0% / 0.3)" }}>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center flex-shrink-0">
                <FlaskConical size={20} className="text-purple-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display text-sm text-foreground truncate">{t.perfumeNome}</p>
                <p className="text-[11px] text-muted-foreground">{t.marca}</p>
              </div>
              <button onClick={() => handleRemover(t.id)}
                className="p-2 rounded-lg text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 size={15} />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2 mt-3 border-t border-border pt-3">
              <div>
                <p className="text-[9px] text-muted-foreground">Depósito</p>
                <p className="text-xs font-semibold text-purple-400">{t.deposito}</p>
              </div>
              <div>
                <p className="text-[9px] text-muted-foreground">Quantidade</p>
                <p className="text-sm font-bold text-purple-400">{t.quantidade} un.</p>
              </div>
              <div>
                <p className="text-[9px] text-muted-foreground">Custo unit.</p>
                <p className="text-sm font-semibold text-foreground">{formatCurrency(t.custo)}</p>
              </div>
              <div>
                <p className="text-[9px] text-muted-foreground">Total custo</p>
                <p className="text-sm font-bold text-gold">{formatCurrency(t.quantidade * t.custo)}</p>
              </div>
            </div>
          </div>
        ))}
        {filtrados.length === 0 && (
          <div className="text-center py-16">
            <FlaskConical size={40} className="text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground text-sm">Nenhum tester encontrado</p>
          </div>
        )}
      </div>
    </div>
  );
}
