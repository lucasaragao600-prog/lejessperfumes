import { useState, useMemo } from "react";
import { FlaskConical, Search, Plus, Trash2, Pencil, Check, X } from "lucide-react";
import PerfumeSearchSelect from "@/components/PerfumeSearchSelect";
import { formatCurrency, type Deposito } from "@/data/mockData";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";

const depositos: Deposito[] = ["Casa", "Sumaúma", "Amazonas"];

export default function Testers({ isMaster = true }: { isMaster?: boolean }) {
  const { testers, perfumes, baixarEstoque, adicionarTesterDB, removerTesterDB, ajustarTesterDB, concentracoesConfig } = useApp();
  const { profile } = useAuth();
  const [busca, setBusca] = useState("");
  const [filtroDeposito, setFiltroDeposito] = useState<Deposito | "Todos">("Todos");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ perfumeId: "", deposito: "" as Deposito | "", quantidade: 1 });
  const [ajusteId, setAjusteId] = useState<string | null>(null);
  const [ajusteQtd, setAjusteQtd] = useState(0);

  const filtrados = useMemo(() => {
    const q = busca.toLowerCase();
    return testers.filter((t) => {
      const matchBusca = t.perfumeNome.toLowerCase().includes(q) || t.marca.toLowerCase().includes(q);
      const matchDeposito = filtroDeposito === "Todos" || t.deposito === filtroDeposito;
      return matchBusca && matchDeposito;
    });
  }, [testers, busca, filtroDeposito]);

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

  const handleAdicionar = async () => {
    if (!form.perfumeId || !form.deposito || form.quantidade < 1) return;
    const deposito = form.deposito as Deposito;
    const p = perfumes.find((x) => x.id === form.perfumeId)!;
    const estoqueAtual = p.estoques[deposito];
    if (estoqueAtual < form.quantidade) {
      alert(`Estoque insuficiente em ${deposito}. Disponível: ${estoqueAtual}`);
      return;
    }
    baixarEstoque(form.perfumeId, deposito, form.quantidade);
    await adicionarTesterDB({
      perfumeId: p.id,
      perfumeNome: p.nome,
      marca: p.marca,
      deposito,
      quantidade: form.quantidade,
      custo: p.custo,
      registradoPor: profile?.nome || "Desconhecido",
    });
    setForm({ perfumeId: "", deposito: "", quantidade: 1 });
    setShowForm(false);
  };

  const handleRemover = async (id: string) => { await removerTesterDB(id); };
  const handleAjuste = async (id: string) => {
    if (ajusteQtd < 0) return;
    await ajustarTesterDB({ id, novaQuantidade: ajusteQtd });
    setAjusteId(null);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 pt-12 pb-4"
        style={{ background: "var(--gradient-header)" }}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="page-title">Testers</h1>
            <p className="page-subtitle mt-1">{testers.length} perfumes em teste</p>
          </div>
          <button onClick={() => setShowForm(!showForm)} className="btn-primary px-4 py-2">
            <Plus size={16} /> Adicionar
          </button>
        </div>

        {/* Deposit cards */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {depositos.map((d) => (
            <button key={d}
              onClick={() => setFiltroDeposito(filtroDeposito === d ? "Todos" : d)}
              className={`kpi-card p-3 text-left transition-all duration-150 ${
                filtroDeposito === d ? "!border-gold-muted" : ""
              }`}>
              <p className={`text-[9px] mb-1 ${filtroDeposito === d ? "text-gold" : "text-muted-foreground"}`}>{d}</p>
              <p className={`text-sm font-bold ${filtroDeposito === d ? "text-gold" : "text-foreground"}`}>
                {resumoPorDeposito[d]?.qtd ?? 0} <span className="text-[9px] font-normal">un.</span>
              </p>
              {isMaster && <p className="text-[9px] text-muted-foreground mt-0.5">{formatCurrency(resumoPorDeposito[d]?.custo ?? 0)}</p>}
            </button>
          ))}
        </div>

        {/* Total card */}
        {isMaster ? (
          <div className="kpi-card p-4 mb-3 flex justify-between items-center"
            style={{ background: "var(--gradient-gold-subtle)", borderColor: "hsl(var(--gold-muted))" }}>
            <div>
              <p className="text-[11px] text-muted-foreground font-medium">Total geral em custo</p>
              <p className="font-display text-xl text-gold mt-0.5">{formatCurrency(totalCusto)}</p>
            </div>
            <p className="text-sm text-muted-foreground">{testers.reduce((a, t) => a + t.quantidade, 0)} unid.</p>
          </div>
        ) : (
          <div className="kpi-card p-3 mb-3 text-center">
            <p className="text-sm text-foreground font-semibold">{testers.reduce((a, t) => a + t.quantidade, 0)} testers total</p>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="Buscar perfume ou marca..." value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="input-premium pl-10 pr-4 py-2.5 text-sm" />
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="mx-4 mb-5 card-premium p-5 animate-fade-in" style={{ boxShadow: "var(--shadow-gold)" }}>
          <h3 className="font-display text-lg text-foreground mb-4">Adicionar Tester</h3>
          <div className="space-y-4">
            <div>
              <label className="text-[11px] text-muted-foreground mb-2 block uppercase tracking-wider font-medium">Perfume</label>
              <PerfumeSearchSelect perfumes={perfumes} value={form.perfumeId}
                onChange={(id) => setForm({ ...form, perfumeId: id })} concentracoesConfig={concentracoesConfig} />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground mb-2 block uppercase tracking-wider font-medium">Depósito de origem</label>
              <div className="grid grid-cols-3 gap-2">
                {depositos.map((d) => (
                  <button key={d}
                    onClick={() => setForm({ ...form, deposito: d })}
                    className={`py-2.5 rounded-xl text-xs font-medium border transition-all duration-150 ${
                      form.deposito === d
                        ? "border-gold-muted bg-primary/10 text-gold"
                        : "border-border bg-surface-overlay text-muted-foreground hover:text-foreground"
                    }`}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground mb-2 block uppercase tracking-wider font-medium">Quantidade</label>
              <input type="number" min={1} value={form.quantidade === 0 ? "" : form.quantidade}
                onChange={(e) => setForm({ ...form, quantidade: e.target.value === "" ? 0 : parseInt(e.target.value) || 0 })}
                className="input-premium px-3 py-2.5 text-sm" />
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowForm(false)} className="btn-secondary flex-1 py-2.5">Cancelar</button>
              <button onClick={handleAdicionar} disabled={!form.perfumeId || !form.deposito} className="btn-primary flex-1 py-2.5">
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      <div className="px-4 space-y-3">
        {filtrados.map((t) => (
          <div key={t.id} className="card-premium p-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-purple-500/8 border border-purple-500/20 flex items-center justify-center flex-shrink-0">
                <FlaskConical size={20} className="text-purple-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display text-sm text-foreground truncate">{t.marca} · {t.perfumeNome}</p>
                {(() => {
                  const pf = perfumes.find((p) => p.id === t.perfumeId);
                  return pf ? (
                    <p className="text-[11px] text-muted-foreground">{pf.concentracao} · {pf.volume}ml</p>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">{t.marca}</p>
                  );
                })()}
              </div>
              <button onClick={() => handleRemover(t.id)}
                className="p-2 rounded-lg text-muted-foreground hover:text-destructive transition-colors duration-150">
                <Trash2 size={15} />
              </button>
              {isMaster && (
                <button onClick={() => { setAjusteId(ajusteId === t.id ? null : t.id); setAjusteQtd(t.quantidade); }}
                  className="p-2 rounded-lg text-muted-foreground hover:text-gold transition-colors duration-150">
                  <Pencil size={15} />
                </button>
              )}
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
                {isMaster && (
                  <>
                    <p className="text-[9px] text-muted-foreground">Custo unit.</p>
                    <p className="text-sm font-semibold text-foreground">{formatCurrency(t.custo)}</p>
                  </>
                )}
              </div>
              {isMaster && (
                <div>
                  <p className="text-[9px] text-muted-foreground">Total custo</p>
                  <p className="text-sm font-bold text-gold">{formatCurrency(t.quantidade * t.custo)}</p>
                </div>
              )}
            </div>
            {ajusteId === t.id && (
              <div className="mt-3 border-t border-border pt-3 flex items-center gap-2">
                <p className="text-[10px] text-muted-foreground whitespace-nowrap">Nova qtd:</p>
                <input type="number" min={0} value={ajusteQtd === 0 ? "" : ajusteQtd}
                  onChange={(e) => setAjusteQtd(e.target.value === "" ? 0 : parseInt(e.target.value) || 0)}
                  className="input-premium flex-1 px-3 py-1.5 text-sm" />
                <button onClick={() => handleAjuste(t.id)}
                  className="p-1.5 rounded-lg bg-primary/10 text-gold hover:bg-primary/20 transition-colors duration-150">
                  <Check size={16} />
                </button>
                <button onClick={() => setAjusteId(null)}
                  className="p-1.5 rounded-lg bg-surface-overlay text-muted-foreground hover:text-destructive transition-colors duration-150">
                  <X size={16} />
                </button>
              </div>
            )}
          </div>
        ))}
        {filtrados.length === 0 && (
          <div className="text-center py-20">
            <FlaskConical size={40} className="text-muted-foreground mx-auto mb-4 opacity-40" />
            <p className="text-muted-foreground text-sm">Nenhum tester encontrado</p>
          </div>
        )}
      </div>
    </div>
  );
}
