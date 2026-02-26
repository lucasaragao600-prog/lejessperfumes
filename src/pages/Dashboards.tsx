import { useMemo, useState } from "react";
import { BarChart3, TrendingUp, Package, ShoppingCart } from "lucide-react";
import { formatCurrency, type TipoPerfume } from "@/data/mockData";
import { useApp } from "@/context/AppContext";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";

const GOLD = "hsl(43, 74%, 49%)";
const GOLD_LIGHT = "hsl(43, 80%, 65%)";

export default function Dashboards() {
  const { vendas, perfumes, tiposPerfumeConfig } = useApp();
  const [segmento, setSegmento] = useState<string>("geral");

  const SEGMENTOS = useMemo(() => [
    { key: "geral", label: "Geral" },
    ...Object.entries(tiposPerfumeConfig).map(([key, label]) => ({ key, label: String(label) })),
  ], [tiposPerfumeConfig]);
  const hoje = new Date().toISOString().slice(0, 10);

  // Mapa perfumeId → tipo
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
    vendasFiltradas.forEach((v) => {
      mapa[v.data] = (mapa[v.data] || 0) + v.total;
    });
    return Object.entries(mapa)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-7)
      .map(([data, total]) => ({
        data: data.slice(5).replace("-", "/"),
        total,
      }));
  }, [vendasFiltradas]);

  const topVendidos = useMemo(() => {
    const mapa: Record<string, { nome: string; quantidade: number; valor: number }> = {};
    vendasFiltradas.forEach((v) => {
      if (!mapa[v.perfumeId]) mapa[v.perfumeId] = { nome: v.perfumeNome, quantidade: 0, valor: 0 };
      mapa[v.perfumeId].quantidade += v.quantidade;
      mapa[v.perfumeId].valor += v.total;
    });
    const limite = segmento === "geral" ? 10 : 5;
    return Object.values(mapa)
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, limite);
  }, [vendasFiltradas, segmento]);

  const porDeposito = useMemo(() => {
    const mapa: Record<string, number> = {};
    vendasFiltradas.forEach((v) => {
      mapa[v.deposito] = (mapa[v.deposito] || 0) + v.total;
    });
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

  // Ticket médio por vendedora
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
        {/* KPIs — sempre gerais */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Faturado hoje", value: formatCurrency(totalHoje), icon: TrendingUp, sub: hoje.split("-").reverse().join("/") },
            { label: "Total histórico", value: formatCurrency(totalGeral), icon: ShoppingCart, sub: `${vendas.length} vendas` },
            { label: "Estoque (venda)", value: formatCurrency(totalEstoqueVenda), icon: Package, sub: `${perfumes.length} produtos` },
            { label: "Estoque (custo)", value: formatCurrency(totalEstoqueCusto), icon: Package, sub: "valor investido" },
            { label: "Ticket médio", value: formatCurrency(totalGeral / (vendas.length || 1)), icon: BarChart3, sub: "por venda" },
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

        {/* Ticket médio por vendedora */}
        {ticketPorVendedora.length > 0 && (
          <div className="bg-surface border border-border rounded-xl p-4"
            style={{ boxShadow: "0 2px 12px hsl(0 0% 0% / 0.3)" }}>
            <h3 className="font-display text-sm text-foreground mb-3 flex items-center gap-2">
              <BarChart3 size={14} className="text-gold" />
              Ticket Médio por Vendedora
            </h3>
            <div className="space-y-2">
              {ticketPorVendedora.map((v) => (
                <div key={v.nome} className="flex items-center justify-between bg-surface-overlay rounded-lg px-3 py-2">
                  <div>
                    <p className="text-xs font-medium text-foreground">{v.nome}</p>
                    <p className="text-[10px] text-muted-foreground">{v.qtd} venda(s) · {formatCurrency(v.total)}</p>
                  </div>
                  <p className="text-sm font-bold text-gold">{formatCurrency(v.ticket)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Abas de segmento */}
        <div className="bg-surface border border-border rounded-xl overflow-hidden"
          style={{ boxShadow: "0 2px 12px hsl(0 0% 0% / 0.3)" }}>
          <div className="flex border-b border-border">
            {SEGMENTOS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setSegmento(key)}
                className={`flex-1 py-2.5 text-xs font-medium transition-colors border-b-2 ${
                  segmento === key
                    ? "text-gold border-gold"
                    : "text-muted-foreground border-transparent"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="p-4 space-y-5">
            {/* Faturamento por segmento */}
            {segmento !== "geral" && (
              <div className="flex items-center justify-between py-2 border-b border-border">
                <p className="text-xs text-muted-foreground">Total {tiposPerfumeConfig[segmento] || segmento}</p>
                <p className="text-sm font-bold text-gold">{formatCurrency(totalSegmento)}</p>
              </div>
            )}

            {/* Gráfico faturamento diário */}
            <div>
              <h3 className="font-display text-sm text-foreground mb-3">Faturamento por dia</h3>
              {faturamentoDiario.length > 0 ? (
                <ResponsiveContainer width="100%" height={150}>
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
              ) : (
                <p className="text-xs text-muted-foreground text-center py-8">Sem vendas neste segmento</p>
              )}
            </div>

            {/* Top vendidos — 10 geral, 5 por segmento */}
            <div>
              <h3 className="font-display text-sm text-foreground mb-3">
                Top {segmento === "geral" ? "10" : "5"} Mais Vendidos
                {segmento !== "geral" && (
                  <span className="ml-2 text-[10px] font-mono text-gold bg-gold/10 px-1.5 py-0.5 rounded">
                    {segmento}
                  </span>
                )}
              </h3>
              {topVendidos.length > 0 ? (
                <div className="space-y-2.5">
                  {topVendidos.map((item, index) => {
                    const maxQtd = topVendidos[0].quantidade;
                    const pct = (item.quantidade / maxQtd) * 100;
                    return (
                      <div key={item.nome}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-gold w-4">{index + 1}</span>
                            <p className="text-xs text-foreground truncate max-w-[150px]">{item.nome}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <p className="text-[10px] text-muted-foreground">{formatCurrency(item.valor)}</p>
                            <p className="text-xs font-semibold text-gold w-12 text-right">{item.quantidade} un.</p>
                          </div>
                        </div>
                        <div className="h-1.5 bg-surface-overlay rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: "var(--gradient-gold)" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-6">Sem vendas neste segmento</p>
              )}
            </div>

            {/* Por depósito */}
            {porDeposito.length > 0 && (
              <div>
                <h3 className="font-display text-sm text-foreground mb-3">Faturamento por Loja</h3>
                <div className="space-y-2">
                  {porDeposito.map((d) => {
                    const pct = totalSegmento > 0 ? (d.total / totalSegmento) * 100 : 0;
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
