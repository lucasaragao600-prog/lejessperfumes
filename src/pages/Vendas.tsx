import { useState, useMemo } from "react";
import { ShoppingCart, Plus, Calendar } from "lucide-react";
import { vendas as vendasIniciais, perfumes, formatCurrency, formatDate, type Deposito, type Venda } from "@/data/mockData";

const depositos: Deposito[] = ["Casa", "Sumaúma", "Amazonas"];
const hoje = "2026-02-18";

export default function Vendas() {
  const [vendas, setVendas] = useState(vendasIniciais);
  const [filtroData, setFiltroData] = useState("");
  const [filtroDeposito, setFiltroDeposito] = useState<Deposito | "Todos">("Todos");
  const [showForm, setShowForm] = useState(false);

  // Form
  const [form, setForm] = useState({
    perfumeId: "",
    deposito: "" as Deposito | "",
    quantidade: 1,
  });

  const perfumeSelecionado = perfumes.find((p) => p.id === form.perfumeId);

  const filtradas = useMemo(() => {
    return vendas.filter((v) => {
      const matchData = filtroData ? v.data === filtroData : true;
      const matchDeposito = filtroDeposito === "Todos" || v.deposito === filtroDeposito;
      return matchData && matchDeposito;
    });
  }, [vendas, filtroData, filtroDeposito]);

  const totalHoje = useMemo(() => {
    const vendasHoje = vendas.filter((v) => v.data === hoje);
    return {
      valor: vendasHoje.reduce((a, v) => a + v.total, 0),
      itens: vendasHoje.reduce((a, v) => a + v.quantidade, 0),
      qtd: vendasHoje.length,
    };
  }, [vendas]);

  const totalFiltrado = useMemo(() => {
    return {
      valor: filtradas.reduce((a, v) => a + v.total, 0),
      itens: filtradas.reduce((a, v) => a + v.quantidade, 0),
    };
  }, [filtradas]);

  const handleLancar = () => {
    if (!form.perfumeId || !form.deposito || form.quantidade < 1) return;
    const p = perfumes.find((x) => x.id === form.perfumeId)!;
    const novaVenda: Venda = {
      id: `v${Date.now()}`,
      data: hoje,
      perfumeId: form.perfumeId,
      perfumeNome: p.nome,
      deposito: form.deposito as Deposito,
      quantidade: form.quantidade,
      precoUnitario: p.precoVenda,
      total: p.precoVenda * form.quantidade,
    };
    setVendas([novaVenda, ...vendas]);
    setForm({ perfumeId: "", deposito: "", quantidade: 1 });
    setShowForm(false);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 pt-12 pb-4"
        style={{ background: "linear-gradient(180deg, hsl(0 0% 7%) 80%, transparent)" }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="font-display text-2xl text-gold">Vendas</h1>
            <p className="text-muted-foreground text-xs mt-0.5">Hoje: {totalHoje.qtd} vendas · {totalHoje.itens} itens</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-primary-foreground shadow-gold transition-all active:scale-95"
            style={{ background: "var(--gradient-gold)" }}
          >
            <Plus size={16} />
            Lançar
          </button>
        </div>

        {/* Cards resumo hoje */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-surface border border-gold-muted rounded-xl p-3">
            <p className="text-[10px] text-muted-foreground mb-1">Faturado hoje</p>
            <p className="text-base font-bold text-gold">{formatCurrency(totalHoje.valor)}</p>
          </div>
          <div className="bg-surface border border-border rounded-xl p-3">
            <p className="text-[10px] text-muted-foreground mb-1">Itens vendidos</p>
            <p className="text-base font-bold text-foreground">{totalHoje.itens} unid.</p>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Calendar size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="date"
              value={filtroData}
              onChange={(e) => setFiltroData(e.target.value)}
              className="w-full bg-surface border border-border rounded-xl pl-8 pr-3 py-2 text-xs text-foreground focus:outline-none focus:border-gold-muted [color-scheme:dark]"
            />
          </div>
          <select
            value={filtroDeposito}
            onChange={(e) => setFiltroDeposito(e.target.value as Deposito | "Todos")}
            className="bg-surface border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-gold-muted"
          >
            <option value="Todos">Todos</option>
            {depositos.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      {/* Formulário lançar venda */}
      {showForm && (
        <div className="mx-4 mb-4 bg-surface border border-gold-muted rounded-xl p-4 animate-fade-in"
          style={{ boxShadow: "var(--shadow-gold)" }}>
          <h3 className="font-display text-base text-gold mb-3">Nova Venda</h3>
          <div className="space-y-3">
            <div>
              <label className="text-[11px] text-muted-foreground mb-1 block">Perfume</label>
              <select
                value={form.perfumeId}
                onChange={(e) => setForm({ ...form, perfumeId: e.target.value })}
                className="w-full bg-surface-overlay border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-gold-muted"
              >
                <option value="">Selecione...</option>
                {perfumes.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome} - {p.marca}</option>
                ))}
              </select>
            </div>
            {perfumeSelecionado && (
              <div className="bg-gold/10 border border-gold-muted rounded-lg p-2.5">
                <p className="text-xs text-gold">Preço: {formatCurrency(perfumeSelecionado.precoVenda)} · Total: {formatCurrency(perfumeSelecionado.precoVenda * form.quantidade)}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">Depósito</label>
                <select
                  value={form.deposito}
                  onChange={(e) => setForm({ ...form, deposito: e.target.value as Deposito })}
                  className="w-full bg-surface-overlay border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-gold-muted"
                >
                  <option value="">Selecione...</option>
                  {depositos.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">Quantidade</label>
                <input
                  type="number"
                  min={1}
                  value={form.quantidade}
                  onChange={(e) => setForm({ ...form, quantidade: parseInt(e.target.value) || 1 })}
                  className="w-full bg-surface-overlay border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-gold-muted"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 rounded-xl text-sm border border-border text-muted-foreground"
              >
                Cancelar
              </button>
              <button
                onClick={handleLancar}
                disabled={!form.perfumeId || !form.deposito}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground disabled:opacity-40 transition-all"
                style={{ background: "var(--gradient-gold)" }}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Total filtrado */}
      {(filtroData || filtroDeposito !== "Todos") && (
        <div className="mx-4 mb-3 bg-surface border border-border rounded-xl p-3 flex justify-between items-center">
          <p className="text-xs text-muted-foreground">Total filtrado ({filtradas.length} vendas)</p>
          <p className="text-sm font-bold text-gold">{formatCurrency(totalFiltrado.valor)}</p>
        </div>
      )}

      {/* Lista */}
      <div className="px-4 space-y-2">
        {filtradas.map((v) => (
          <div key={v.id} className="bg-surface border border-border rounded-xl p-3.5 flex items-center gap-3"
            style={{ boxShadow: "0 2px 8px hsl(0 0% 0% / 0.3)" }}>
            <div className="w-10 h-10 rounded-xl bg-gold/10 border border-gold-muted flex items-center justify-center flex-shrink-0">
              <ShoppingCart size={18} className="text-gold" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{v.perfumeNome}</p>
              <p className="text-[11px] text-muted-foreground">{formatDate(v.data)} · {v.deposito} · {v.quantidade} unid.</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-gold">{formatCurrency(v.total)}</p>
              <p className="text-[10px] text-muted-foreground">{formatCurrency(v.precoUnitario)}/un</p>
            </div>
          </div>
        ))}
        {filtradas.length === 0 && (
          <div className="text-center py-16">
            <ShoppingCart size={40} className="text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground text-sm">Nenhuma venda encontrada</p>
          </div>
        )}
      </div>
    </div>
  );
}
