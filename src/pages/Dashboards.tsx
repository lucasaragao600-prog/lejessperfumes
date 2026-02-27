import { useMemo, useState } from "react";
import { BarChart3, TrendingUp, Package, ShoppingCart, DollarSign } from "lucide-react";
import { formatCurrency, type TipoPerfume } from "@/data/mockData";
import { useApp } from "@/context/AppContext";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";

const GOLD = "hsl(43, 74%, 49%)";
const GOLD_DIM = "hsl(43, 50%, 38%)";

export default function Dashboards() {
  const { vendas, perfumes, tiposPerfumeConfig } = useApp();
  const [segmento, setSegmento] = useState<string>("geral");

  const SEGMENTOS = useMemo(() => [
    { key: "geral", label: "Geral" },
    ...Object.entries(tiposPerfumeConfig).map(([key, label]) => ({ key, label: String(label) })),
  ], [tiposPerfumeConfig]);

  const hoje = new Date().toISOString().slice(0, 10);

  const tipoMap = useMemo(() => {
    const m: Record<string, TipoPerfume> = {};
    perfumes.forEach((p) => { m[p.id] = p.tipo; });
    return m;
  }, [perfumes]);

  const vendasFiltradas = useMemo(() => {
    if (segmento === "geral") return vendas;
    return vendas.filter((v) => tipoMap[v.perfumeId] === segmento);
  }, [vendas, segmento, tipoMap]);

  const faturamentoDiario = useMemo(() => {
    const mapa: Record<string, number> = {};
    vendasFiltradas.forEach((v) => { mapa[v.data] = (mapa[v.data] || 0) + v.total; });
    return Object.entries(mapa)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-7)
      .map(([data, total]) => ({ data: data.slice(5).replace("-", "/"), total }));
  }, [vendasFiltradas]);

  const topVendidos = useMemo(() => {
    const mapa: Record<string, { nome: string; quantidade: number; valor: number }> = {};
    vendasFiltradas.forEach((v) => {
      if (!mapa[v.perfumeId]) mapa[v.perfumeId] = { nome: v.perfumeNome, quantidade: 0, valor: 0 };
      mapa[v.perfumeId].quantidade += v.quantidade;
      mapa[v.perfumeId].valor += v.total;
    });
    const limite = segmento === "geral" ? 10 : 5;
    return Object.values(mapa).sort((a, b) => b.quantidade - a.quantidade).slice(0, limite);
  }, [vendasFiltradas, segmento]);

  const porDeposito = useMemo(() => {
    const mapa: Record<string, number> = {};
    vendasFiltradas.forEach((v) => { mapa[v.deposito] = (mapa[v.deposito] || 0) + v.total; });
    return Object.entries(mapa).map(([dep, total]) => ({ dep, total }));
  }, [vendasFiltradas]);

  const totalGeral = vendas.reduce((a, v) => a + v.total, 0);
  const totalSegmento = vendasFiltradas.reduce((a, v) => a + v.total, 0);
  const totalHoje = vendas.filter((v) => v.data === hoje).reduce((a, v) => a + v.total, 0);
  const totalEstoqueVenda = perfumes.reduce((acc, p) => {
    const qtd = Object.values(p.estoques).reduce((a, b) => a + b, 0);
    return acc + qtd * p.precoVenda;
  }, 0);
  const totalEstoqueCusto = perfumes.reduce((acc, p) => {
    const qtd = Object.values(p.estoques).reduce((a, b) => a + b, 0);
    return acc + qtd * p.custo;
  }, 0);

  const ticketPorVendedora = useMemo(() => {
    const mapa: Record<string, { total: number; qtd: number }> = {};
    vendas.forEach((v) => {
      if (!mapa[v.vendedora]) mapa[v.vendedora] = { total: 0, qtd: 0 };
      mapa[v.vendedora].total += v.total;
      mapa[v.vendedora].qtd += 1;
    });
    return Object.entries(mapa)
      .map(([nome, d]) => ({ nome, ticket: d.qtd > 0 ? d.total / d.qtd : 0, total: d.total, qtd: d.qtd }))
      .sort((a, b) => b.ticket - a.ticket);
  }, [vendas]);

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ value: number }> }) => {
    if (active && payload && payload.length) {
      return (
        <div className="card-premium px-3 py-2">
          <p className="text-xs text-gold font-semibold">{formatCurrency(payload[0].value)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="px-4 pt-12 pb-6">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle mt-1">Visão geral do negócio</p>
      </div>

      <div className="px-4 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Faturado hoje", value: formatCurrency(totalHoje), icon: TrendingUp, sub: hoje.split("-").reverse().join("/") },
            { label: "Total histórico", value: formatCurrency(totalGeral), icon: ShoppingCart, sub: `${vendas.length} vendas` },
            { label: "Estoque (venda)", value: formatCurrency(totalEstoqueVenda), icon: Package, sub: `${perfumes.length} produtos` },
            { label: "Estoque (custo)", value: formatCurrency(totalEstoqueCusto), icon: DollarSign, sub: "valor investido" },
            { label: "Ticket médio", value: formatCurrency(totalGeral / (vendas.length || 1)), icon: BarChart3, sub: "por venda" },
          ].map(({ label, value, icon: Icon, sub }) => (
            <div key={label} className="kpi-card">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "hsl(43 74% 49% / 0.1)" }}>
                  <Icon size={14} className="text-gold" />
                </div>
                <p className="text-[11px] text-muted-foreground font-medium">{label}</p>
              </div>
              <p className="text-lg font-bold text-foreground tracking-tight">{value}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>
            </div>
          ))}
        </div>

        {/* Ticket médio por vendedora */}
        {ticketPorVendedora.length > 0 && (
          <div className="card-premium p-5">
            <h3 className="font-display text-base text-foreground mb-4 flex items-center gap-2">
              <BarChart3 size={16} className="text-gold" />
              Ticket Médio por Vendedora
            </h3>
            <div className="space-y-2">
              {ticketPorVendedora.map((v) => (
                <div key={v.nome} className="flex items-center justify-between bg-surface-overlay rounded-xl px-4 py-3 transition-colors duration-150 hover:bg-surface-raised">
                  <div>
                    <p className="text-sm font-medium text-foreground">{v.nome}</p>
                    <p className="text-[11px] text-muted-foreground">{v.qtd} venda(s) · {formatCurrency(v.total)}</p>
                  </div>
                  <p className="text-base font-bold text-gold">{formatCurrency(v.ticket)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Abas de segmento */}
        <div className="card-premium overflow-hidden">
          <div className="flex border-b border-border">
            {SEGMENTOS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setSegmento(key)}
                className={`flex-1 py-3 text-xs font-medium transition-all duration-150 border-b-2 ${
                  segmento === key
                    ? "text-gold border-gold"
                    : "text-muted-foreground border-transparent hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="p-5 space-y-6">
            {segmento !== "geral" && (
              <div className="flex items-center justify-between py-3 border-b border-border">
                <p className="text-xs text-muted-foreground">Total {tiposPerfumeConfig[segmento] || segmento}</p>
                <p className="text-lg font-bold text-gold">{formatCurrency(totalSegmento)}</p>
              </div>
            )}

            {/* Chart */}
            <div>
              <h3 className="font-display text-base text-foreground mb-4">Faturamento por dia</h3>
              {faturamentoDiario.length > 0 ? (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={faturamentoDiario} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <XAxis dataKey="data" tick={{ fontSize: 10, fill: "hsl(0 0% 45%)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: "hsl(0 0% 45%)" }} axisLine={false} tickLine={false}
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(0 0% 100% / 0.02)" }} />
                    <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                      {faturamentoDiario.map((_, index) => (
                        <Cell key={index} fill={index === faturamentoDiario.length - 1 ? GOLD : GOLD_DIM} fillOpacity={index === faturamentoDiario.length - 1 ? 0.9 : 0.5} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-10">Sem vendas neste segmento</p>
              )}
            </div>

            {/* Top vendidos */}
            <div>
              <h3 className="font-display text-base text-foreground mb-4">
                Top {segmento === "geral" ? "10" : "5"} Mais Vendidos
                {segmento !== "geral" && (
                  <span className="ml-2 text-[10px] font-mono text-gold bg-primary/10 px-2 py-0.5 rounded-full">
                    {segmento}
                  </span>
                )}
              </h3>
              {topVendidos.length > 0 ? (
                <div className="space-y-3">
                  {topVendidos.map((item, index) => {
                    const maxQtd = topVendidos[0].quantidade;
                    const pct = (item.quantidade / maxQtd) * 100;
                    return (
                      <div key={item.nome}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2.5">
                            <span className="text-[11px] font-bold text-gold w-5 text-center">{index + 1}</span>
                            <p className="text-xs text-foreground truncate max-w-[160px]">{item.nome}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <p className="text-[11px] text-muted-foreground">{formatCurrency(item.valor)}</p>
                            <p className="text-xs font-semibold text-gold w-12 text-right">{item.quantidade} un.</p>
                          </div>
                        </div>
                        <div className="h-1.5 bg-surface-overlay rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: "var(--gradient-gold)", opacity: 0.7 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-8">Sem vendas neste segmento</p>
              )}
            </div>

            {/* Por depósito */}
            {porDeposito.length > 0 && (
              <div>
                <h3 className="font-display text-base text-foreground mb-4">Faturamento por Loja</h3>
                <div className="space-y-3">
                  {porDeposito.map((d) => {
                    const pct = totalSegmento > 0 ? (d.total / totalSegmento) * 100 : 0;
                    return (
                      <div key={d.dep}>
                        <div className="flex justify-between mb-1.5">
                          <p className="text-xs text-foreground font-medium">{d.dep}</p>
                          <div className="flex gap-3">
                            <p className="text-[11px] text-muted-foreground">{pct.toFixed(0)}%</p>
                            <p className="text-xs font-semibold text-gold">{formatCurrency(d.total)}</p>
                          </div>
                        </div>
                        <div className="h-2 bg-surface-overlay rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: "var(--gradient-gold)", opacity: 0.6 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
