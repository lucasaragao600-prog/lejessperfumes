import { useState, useMemo } from "react";
import { FlaskConical, Search, Plus, Trash2 } from "lucide-react";
import { testers as testersIniciais, perfumes, formatCurrency } from "@/data/mockData";
import type { Tester } from "@/data/mockData";

export default function Testers() {
  const [testers, setTesters] = useState(testersIniciais);
  const [busca, setBusca] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ perfumeId: "", quantidade: 1 });

  const filtrados = useMemo(() => {
    const q = busca.toLowerCase();
    return testers.filter(
      (t) =>
        t.perfumeNome.toLowerCase().includes(q) ||
        t.marca.toLowerCase().includes(q)
    );
  }, [testers, busca]);

  const totalCusto = useMemo(
    () => testers.reduce((acc, t) => acc + t.quantidade * t.custo, 0),
    [testers]
  );

  const handleAdicionar = () => {
    if (!form.perfumeId || form.quantidade < 1) return;
    const p = perfumes.find((x) => x.id === form.perfumeId)!;
    const existente = testers.find((t) => t.perfumeId === form.perfumeId);
    if (existente) {
      setTesters(testers.map((t) =>
        t.perfumeId === form.perfumeId
          ? { ...t, quantidade: t.quantidade + form.quantidade }
          : t
      ));
    } else {
      const novo: Tester = {
        id: `t${Date.now()}`,
        perfumeId: p.id,
        perfumeNome: p.nome,
        marca: p.marca,
        quantidade: form.quantidade,
        custo: p.custo,
      };
      setTesters([...testers, novo]);
    }
    setForm({ perfumeId: "", quantidade: 1 });
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

        {/* Card total */}
        <div className="bg-surface border border-gold-muted rounded-xl p-4 mb-3"
          style={{ background: "var(--gradient-gold-subtle)", boxShadow: "var(--shadow-gold)" }}>
          <p className="text-xs text-muted-foreground mb-1">Valor total em custo (testers)</p>
          <p className="font-display text-2xl text-gold">{formatCurrency(totalCusto)}</p>
          <p className="text-[11px] text-muted-foreground mt-1">
            {testers.reduce((a, t) => a + t.quantidade, 0)} unidades no total
          </p>
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
                {perfumes.map((p) => <option key={p.id} value={p.id}>{p.nome} - {p.marca}</option>)}
              </select>
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
              <button onClick={handleAdicionar} disabled={!form.perfumeId}
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
            <div className="grid grid-cols-3 gap-2 mt-3 border-t border-border pt-3">
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
