import { useState, useMemo } from "react";
import { ShoppingCart, Plus, Calendar, User, Tag } from "lucide-react";
import { perfumes, formatCurrency, formatDate, type Deposito, type Venda } from "@/data/mockData";
import { useApp } from "@/context/AppContext";

const depositos: Deposito[] = ["Casa", "Sumaúma", "Amazonas"];
const hoje = "2026-02-18";
const vendedoras = ["Ana", "Julia", "Carla", "Outra"];

export default function Vendas() {
  const { vendas, setVendas } = useApp();
  const [filtroData, setFiltroData] = useState("");
  const [filtroDeposito, setFiltroDeposito] = useState<Deposito | "Todos">("Todos");
  const [filtroVendedora, setFiltroVendedora] = useState("Todas");
  const [showForm, setShowForm] = useState(false);

  // Form
  const [form, setForm] = useState({
    perfumeId: "",
    deposito: "" as Deposito | "",
    quantidade: 1,
    desconto: 0,
    vendedora: "",
    tipoDesconto: "valor" as "valor" | "percent",
  });

  const perfumeSelecionado = perfumes.find((p) => p.id === form.perfumeId);

  const subtotal = perfumeSelecionado ? perfumeSelecionado.precoVenda * form.quantidade : 0;
  const descontoCalculado =
    form.tipoDesconto === "percent"
      ? (subtotal * form.desconto) / 100
      : form.desconto;
  const totalComDesconto = Math.max(0, subtotal - descontoCalculado);

  const filtradas = useMemo(() => {
    return vendas.filter((v) => {
      const matchData = filtroData ? v.data === filtroData : true;
      const matchDeposito = filtroDeposito === "Todos" || v.deposito === filtroDeposito;
      const matchVendedora = filtroVendedora === "Todas" || v.vendedora === filtroVendedora;
      return matchData && matchDeposito && matchVendedora;
    });
  }, [vendas, filtroData, filtroDeposito, filtroVendedora]);

  const totalHoje = useMemo(() => {
    const vendasHoje = vendas.filter((v) => v.data === hoje);
    return {
      valor: vendasHoje.reduce((a, v) => a + v.total, 0),
      itens: vendasHoje.reduce((a, v) => a + v.quantidade, 0),
      qtd: vendasHoje.length,
    };
  }, [vendas]);

  const totalFiltrado = useMemo(() => ({
    valor: filtradas.reduce((a, v) => a + v.total, 0),
    itens: filtradas.reduce((a, v) => a + v.quantidade, 0),
  }), [filtradas]);

  const handleLancar = () => {
    if (!form.perfumeId || !form.deposito || form.quantidade < 1 || !form.vendedora) return;
    const p = perfumes.find((x) => x.id === form.perfumeId)!;
    const novaVenda: Venda = {
      id: `v${Date.now()}`,
      data: hoje,
      perfumeId: form.perfumeId,
      perfumeNome: p.nome,
      deposito: form.deposito as Deposito,
      quantidade: form.quantidade,
      precoUnitario: p.precoVenda,
      desconto: descontoCalculado,
      total: totalComDesconto,
      vendedora: form.vendedora,
    };
    setVendas([novaVenda, ...vendas]);
    setForm({ perfumeId: "", deposito: "", quantidade: 1, desconto: 0, vendedora: "", tipoDesconto: "valor" });
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
        <div className="flex gap-2 mb-2">
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
            <option value="Todos">Depósito</option>
            {depositos.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select
            value={filtroVendedora}
            onChange={(e) => setFiltroVendedora(e.target.value)}
            className="bg-surface border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-gold-muted"
          >
            <option value="Todas">Vendedora</option>
            {vendedoras.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      </div>

      {/* Formulário lançar venda */}
      {showForm && (
        <div className="mx-4 mb-4 bg-surface border border-gold-muted rounded-xl p-4 animate-fade-in"
          style={{ boxShadow: "var(--shadow-gold)" }}>
          <h3 className="font-display text-base text-gold mb-3">Nova Venda</h3>
          <div className="space-y-3">
            {/* Perfume */}
            <div>
              <label className="text-[11px] text-muted-foreground mb-1 block">Perfume</label>
              <select
                value={form.perfumeId}
                onChange={(e) => setForm({ ...form, perfumeId: e.target.value, desconto: 0 })}
                className="w-full bg-surface-overlay border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-gold-muted"
              >
                <option value="">Selecione...</option>
                {perfumes.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome} - {p.marca}</option>
                ))}
              </select>
            </div>

            {/* Vendedora */}
            <div>
              <label className="text-[11px] text-muted-foreground mb-1 block flex items-center gap-1">
                <User size={10} />
                Vendedora
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {vendedoras.map((v) => (
                  <button
                    key={v}
                    onClick={() => setForm({ ...form, vendedora: v })}
                    className={`py-2 rounded-lg text-xs font-medium border transition-all ${
                      form.vendedora === v
                        ? "border-gold bg-gold/15 text-gold"
                        : "border-border bg-surface-overlay text-muted-foreground"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Depósito + Quantidade */}
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

            {/* Desconto */}
            <div>
              <label className="text-[11px] text-muted-foreground mb-1 block flex items-center gap-1">
                <Tag size={10} />
                Desconto
              </label>
              <div className="flex gap-2">
                <div className="flex rounded-lg overflow-hidden border border-border">
                  <button
                    onClick={() => setForm({ ...form, tipoDesconto: "valor", desconto: 0 })}
                    className={`px-3 py-2 text-xs font-medium transition-all ${
                      form.tipoDesconto === "valor"
                        ? "bg-gold/20 text-gold"
                        : "bg-surface-overlay text-muted-foreground"
                    }`}
                  >
                    R$
                  </button>
                  <button
                    onClick={() => setForm({ ...form, tipoDesconto: "percent", desconto: 0 })}
                    className={`px-3 py-2 text-xs font-medium transition-all ${
                      form.tipoDesconto === "percent"
                        ? "bg-gold/20 text-gold"
                        : "bg-surface-overlay text-muted-foreground"
                    }`}
                  >
                    %
                  </button>
                </div>
                <input
                  type="number"
                  min={0}
                  max={form.tipoDesconto === "percent" ? 100 : subtotal}
                  value={form.desconto}
                  onChange={(e) => setForm({ ...form, desconto: parseFloat(e.target.value) || 0 })}
                  placeholder={form.tipoDesconto === "percent" ? "Ex: 10" : "Ex: 50"}
                  className="flex-1 bg-surface-overlay border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold-muted"
                />
              </div>
            </div>

            {/* Preview preço */}
            {perfumeSelecionado && (
              <div className="bg-gold/10 border border-gold-muted rounded-lg p-3 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="text-foreground">{formatCurrency(subtotal)}</span>
                </div>
                {descontoCalculado > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Desconto</span>
                    <span className="text-red-400">- {formatCurrency(descontoCalculado)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold border-t border-gold-muted pt-1 mt-1">
                  <span className="text-gold">Total</span>
                  <span className="text-gold">{formatCurrency(totalComDesconto)}</span>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 rounded-xl text-sm border border-border text-muted-foreground"
              >
                Cancelar
              </button>
              <button
                onClick={handleLancar}
                disabled={!form.perfumeId || !form.deposito || !form.vendedora}
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
      {(filtroData || filtroDeposito !== "Todos" || filtroVendedora !== "Todas") && (
        <div className="mx-4 mb-3 bg-surface border border-border rounded-xl p-3 flex justify-between items-center">
          <p className="text-xs text-muted-foreground">Total filtrado ({filtradas.length} vendas)</p>
          <p className="text-sm font-bold text-gold">{formatCurrency(totalFiltrado.valor)}</p>
        </div>
      )}

      {/* Lista */}
      <div className="px-4 space-y-2">
        {filtradas.map((v) => (
          <div key={v.id} className="bg-surface border border-border rounded-xl p-3.5"
            style={{ boxShadow: "0 2px 8px hsl(0 0% 0% / 0.3)" }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gold/10 border border-gold-muted flex items-center justify-center flex-shrink-0">
                <ShoppingCart size={18} className="text-gold" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{v.perfumeNome}</p>
                <p className="text-[11px] text-muted-foreground">
                  {formatDate(v.data)} · {v.deposito} · {v.quantidade} unid.
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-gold">{formatCurrency(v.total)}</p>
                <p className="text-[10px] text-muted-foreground">{formatCurrency(v.precoUnitario)}/un</p>
              </div>
            </div>
            {/* Linha vendedora + desconto */}
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
              <div className="flex items-center gap-1">
                <User size={10} className="text-muted-foreground" />
                <p className="text-[11px] text-muted-foreground">{v.vendedora}</p>
              </div>
              {v.desconto > 0 && (
                <div className="flex items-center gap-1">
                  <Tag size={10} className="text-red-400" />
                  <p className="text-[11px] text-red-400">-{formatCurrency(v.desconto)}</p>
                </div>
              )}
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
