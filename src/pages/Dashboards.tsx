import { useMemo } from "react";
import { BarChart3, TrendingUp, Package, ShoppingCart } from "lucide-react";
import { vendas, perfumes, formatCurrency } from "@/data/mockData";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";

const GOLD = "hsl(43, 74%, 49%)";
const GOLD_LIGHT = "hsl(43, 80%, 65%)";

export default function Dashboards() {
  const hoje = "2026-02-18";

  const faturamentoDiario = useMemo(() => {
    const mapa: Record<string, number> = {};
    vendas.forEach((v) => {
      mapa[v.data] = (mapa[v.data] || 0) + v.total;
    });
    return Object.entries(mapa)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-7)
      .map(([data, total]) => ({
        data: data.slice(5).replace("-", "/"),
        total,
      }));
  }, []);

  const topVendidos = useMemo(() => {
    const mapa: Record<string, { nome: string; quantidade: number; valor: number }> = {};
    vendas.forEach((v) => {
      if (!mapa[v.perfumeId]) mapa[v.perfumeId] = { nome: v.perfumeNome, quantidade: 0, valor: 0 };
      mapa[v.perfumeId].quantidade += v.quantidade;
      mapa[v.perfumeId].valor += v.total;
    });
    return Object.values(mapa)
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 5);
  }, []);

  const porDeposito = useMemo(() => {
    const mapa: Record<string, number> = {};
    vendas.forEach((v) => {
      mapa[v.deposito] = (mapa[v.deposito] || 0) + v.total;
    });
    return Object.entries(mapa).map(([dep, total]) => ({ dep, total }));
  }, []);

  const totalGeral = vendas.reduce((a, v) => a + v.total, 0);
  const totalHoje = vendas.filter((v) => v.data === hoje).reduce((a, v) => a + v.total, 0);
  const totalEstoque = perfumes.reduce((acc, p) => {
    const qtd = Object.values(p.estoques).reduce((a, b) => a + b, 0);
    return acc + qtd * p.precoVenda;
  }, 0);

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ value: number }> }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-surface border border-gold-muted rounded-lg px-3 py-2">
          <p className="text-xs text-gold font-semibold">{formatCurrency(payload[0].value)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="px-4 pt-12 pb-4">
        <h1 className="font-display text-2xl text-gold">Dashboard</h1>
        <p className="text-muted-foreground text-xs mt-0.5">Visão geral do negócio</p>
      </div>

      <div className="px-4 space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Faturado hoje", value: formatCurrency(totalHoje), icon: TrendingUp, sub: "18/02/2026" },
            { label: "Total histórico", value: formatCurrency(totalGeral), icon: ShoppingCart, sub: `${vendas.length} vendas` },
            { label: "Estoque (venda)", value: formatCurrency(totalEstoque), icon: Package, sub: `${perfumes.length} produtos` },
            { label: "Ticket médio", value: formatCurrency(totalGeral / vendas.length), icon: BarChart3, sub: "por venda" },
          ].map(({ label, value, icon: Icon, sub }) => (
            <div key={label} className="bg-surface border border-border rounded-xl p-4"
              style={{ boxShadow: "0 2px 12px hsl(0 0% 0% / 0.3)" }}>
              <div className="flex items-center gap-2 mb-2">
                <Icon size={14} className="text-gold" />
                <p className="text-[10px] text-muted-foreground">{label}</p>
              </div>
              <p className="text-base font-bold text-foreground">{value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
            </div>
          ))}
        </div>

        {/* Gráfico faturamento diário */}
        <div className="bg-surface border border-border rounded-xl p-4"
          style={{ boxShadow: "0 2px 12px hsl(0 0% 0% / 0.3)" }}>
          <h3 className="font-display text-sm text-foreground mb-4">Faturamento por dia</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={faturamentoDiario} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="data" tick={{ fontSize: 10, fill: "hsl(0 0% 55%)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "hsl(0 0% 55%)" }} axisLine={false} tickLine={false}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(0 0% 100% / 0.03)" }} />
              <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                {faturamentoDiario.map((entry, index) => (
                  <Cell key={index} fill={entry.data === "02/18" ? GOLD_LIGHT : GOLD} fillOpacity={entry.data === "02/18" ? 1 : 0.7} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top Vendidos */}
        <div className="bg-surface border border-border rounded-xl p-4"
          style={{ boxShadow: "0 2px 12px hsl(0 0% 0% / 0.3)" }}>
          <h3 className="font-display text-sm text-foreground mb-3">Top 5 Mais Vendidos</h3>
          <div className="space-y-2.5">
            {topVendidos.map((item, index) => {
              const maxQtd = topVendidos[0].quantidade;
              const pct = (item.quantidade / maxQtd) * 100;
              return (
                <div key={item.nome}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-gold w-4">{index + 1}</span>
                      <p className="text-xs text-foreground truncate max-w-[140px]">{item.nome}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-gold">{item.quantidade} un.</p>
                    </div>
                  </div>
                  <div className="h-1.5 bg-surface-overlay rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: "var(--gradient-gold)" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Por depósito */}
        <div className="bg-surface border border-border rounded-xl p-4"
          style={{ boxShadow: "0 2px 12px hsl(0 0% 0% / 0.3)" }}>
          <h3 className="font-display text-sm text-foreground mb-3">Faturamento por Depósito</h3>
          <div className="space-y-2">
            {porDeposito.map((d) => {
              const pct = (d.total / totalGeral) * 100;
              return (
                <div key={d.dep}>
                  <div className="flex justify-between mb-1">
                    <p className="text-xs text-foreground">{d.dep}</p>
                    <div className="flex gap-2">
                      <p className="text-[10px] text-muted-foreground">{pct.toFixed(0)}%</p>
                      <p className="text-xs font-semibold text-gold">{formatCurrency(d.total)}</p>
                    </div>
                  </div>
                  <div className="h-2 bg-surface-overlay rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--gradient-gold)" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
