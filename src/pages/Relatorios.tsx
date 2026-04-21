import { useMemo, useState } from "react";
import { useApp } from "@/context/AppContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Download,
  Layers,
  PieChart as PieIcon,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import * as XLSX from "xlsx";
import type { Deposito, Perfume } from "@/data/mockData";

const DEPOSITOS: ("todos" | Deposito)[] = ["todos", "Casa", "Sumaúma", "Amazonas"];
const TIPOS = ["todos", "Árabe", "Importado", "Nicho", "Nacional", "Kit"];

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

function todayStr() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Manaus" }).format(new Date());
}
function daysAgoStr(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Manaus" }).format(d);
}
function diffDays(a: string, b: string) {
  return Math.round((new Date(a).getTime() - new Date(b).getTime()) / 86400000);
}

function exportXlsx(rows: any[], filename: string) {
  if (!rows.length) return;
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Dados");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export default function Relatorios() {
  const { perfumes, vendas } = useApp();
  const hoje = todayStr();
  const [dataInicio, setDataInicio] = useState(daysAgoStr(30));
  const [dataFim, setDataFim] = useState(hoje);
  const [deposito, setDeposito] = useState<"todos" | Deposito>("todos");
  const [tipo, setTipo] = useState<string>("todos");

  const periodoDias = Math.max(1, diffDays(dataFim, dataInicio) + 1);

  // Vendas filtradas
  const vendasFiltradas = useMemo(() => {
    return vendas.filter((v) => {
      if (v.data < dataInicio || v.data > dataFim) return false;
      if (deposito !== "todos" && v.deposito !== deposito) return false;
      return true;
    });
  }, [vendas, dataInicio, dataFim, deposito]);

  // Helpers de estoque
  const estoqueAtualPerfume = (p: Perfume) => {
    if (deposito === "todos") return p.estoques.Casa + p.estoques.Sumaúma + p.estoques.Amazonas;
    return p.estoques[deposito];
  };

  // Indicadores principais por produto
  const analise = useMemo(() => {
    const map = new Map<string, {
      perfume: Perfume;
      qtdVendida: number;
      receita: number;
      custoTotal: number;
      ultimaVenda: string | null;
      estoqueAtual: number;
    }>();

    for (const p of perfumes) {
      if (tipo !== "todos" && p.tipo !== tipo) continue;
      map.set(p.id, {
        perfume: p,
        qtdVendida: 0,
        receita: 0,
        custoTotal: 0,
        ultimaVenda: null,
        estoqueAtual: estoqueAtualPerfume(p),
      });
    }

    for (const v of vendasFiltradas) {
      const item = map.get(v.perfumeId);
      if (!item) continue;
      item.qtdVendida += v.quantidade;
      item.receita += v.total;
      item.custoTotal += (item.perfume.custoMedio || item.perfume.custo || 0) * v.quantidade;
      if (!item.ultimaVenda || v.data > item.ultimaVenda) item.ultimaVenda = v.data;
    }

    return Array.from(map.values()).map((it) => {
      const mediaDiaria = it.qtdVendida / periodoDias;
      const diasEstoque = mediaDiaria > 0 ? it.estoqueAtual / mediaDiaria : it.estoqueAtual > 0 ? Infinity : 0;
      const giro = it.estoqueAtual > 0 ? it.qtdVendida / it.estoqueAtual : it.qtdVendida > 0 ? Infinity : 0;
      const diasSemVenda = it.ultimaVenda ? diffDays(hoje, it.ultimaVenda) : null;
      const lucro = it.receita - it.custoTotal;
      const margemPct = it.receita > 0 ? (lucro / it.receita) * 100 : 0;

      let classe: "parado" | "lento" | "saudavel" | "sem_estoque" = "saudavel";
      if (it.estoqueAtual === 0 && it.qtdVendida === 0) classe = "sem_estoque";
      else if (diasSemVenda === null || diasSemVenda > 30) classe = "parado";
      else if (diasEstoque > 90 || giro < 0.5) classe = "lento";

      return { ...it, mediaDiaria, diasEstoque, giro, diasSemVenda, lucro, margemPct, classe };
    });
  }, [perfumes, vendasFiltradas, tipo, deposito, periodoDias, hoje]);

  // KPIs
  const totalReceita = analise.reduce((s, x) => s + x.receita, 0);
  const totalLucro = analise.reduce((s, x) => s + x.lucro, 0);
  const totalParados = analise.filter((x) => x.classe === "parado" && x.estoqueAtual > 0).length;
  const totalCriticos = analise.filter((x) => x.estoqueAtual === 0 || x.estoqueAtual <= x.perfume.estoqueMinimo).length;

  return (
    <div className="px-4 md:px-0 pt-4 pb-24 md:pb-10 animate-page-enter">
      <div className="mb-6">
        <p className="page-subtitle mb-1">Inteligência</p>
        <h1 className="page-title">Relatórios</h1>
        <p className="text-sm text-muted-foreground mt-1">Análises automáticas de giro, margem, ABC e alertas</p>
      </div>

      {/* Filtros globais */}
      <Card className="p-4 mb-6 bg-card border-border">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Início</label>
            <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="bg-surface" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Fim</label>
            <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="bg-surface" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Depósito</label>
            <Select value={deposito} onValueChange={(v) => setDeposito(v as any)}>
              <SelectTrigger className="bg-surface"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DEPOSITOS.map((d) => (
                  <SelectItem key={d} value={d}>{d === "todos" ? "Todos" : d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Categoria</label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
              <SelectTrigger className="bg-surface"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS.map((t) => (
                  <SelectItem key={t} value={t}>{t === "todos" ? "Todas" : t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KpiCard icon={<TrendingUp size={16} />} label="Receita período" value={fmtBRL(totalReceita)} accent="success" />
        <KpiCard icon={<Activity size={16} />} label="Lucro estimado" value={fmtBRL(totalLucro)} accent="gold" />
        <KpiCard icon={<TrendingDown size={16} />} label="Produtos parados" value={String(totalParados)} accent="warning" />
        <KpiCard icon={<AlertTriangle size={16} />} label="Estoque crítico" value={String(totalCriticos)} accent="destructive" />
      </div>

      <Tabs defaultValue="giro" className="w-full">
        <TabsList className="grid grid-cols-5 w-full bg-surface mb-4 h-auto">
          <TabsTrigger value="giro" className="text-xs py-2"><Activity size={14} className="mr-1.5 hidden md:inline" />Giro</TabsTrigger>
          <TabsTrigger value="margem" className="text-xs py-2"><TrendingUp size={14} className="mr-1.5 hidden md:inline" />Margem</TabsTrigger>
          <TabsTrigger value="problemas" className="text-xs py-2"><AlertTriangle size={14} className="mr-1.5 hidden md:inline" />Problemáticos</TabsTrigger>
          <TabsTrigger value="abc" className="text-xs py-2"><Layers size={14} className="mr-1.5 hidden md:inline" />Curva ABC</TabsTrigger>
          <TabsTrigger value="alertas" className="text-xs py-2"><Zap size={14} className="mr-1.5 hidden md:inline" />Alertas</TabsTrigger>
        </TabsList>

        <TabsContent value="giro"><GiroTab analise={analise} /></TabsContent>
        <TabsContent value="margem"><MargemTab analise={analise} /></TabsContent>
        <TabsContent value="problemas"><ProblematicosTab analise={analise} /></TabsContent>
        <TabsContent value="abc"><CurvaAbcTab analise={analise} /></TabsContent>
        <TabsContent value="alertas"><AlertasTab analise={analise} /></TabsContent>
      </Tabs>
    </div>
  );
}

function KpiCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: "gold" | "success" | "warning" | "destructive" }) {
  const accentColor = {
    gold: "text-gold",
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
  }[accent];
  return (
    <Card className="p-4 bg-card border-border">
      <div className={`flex items-center gap-2 mb-2 ${accentColor}`}>{icon}<span className="text-[10px] uppercase tracking-wider">{label}</span></div>
      <p className="text-xl md:text-2xl font-display font-semibold text-foreground">{value}</p>
    </Card>
  );
}

function ClasseBadge({ classe }: { classe: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    parado: { label: "🔴 Parado", cls: "bg-destructive/15 text-destructive border-destructive/30" },
    lento: { label: "🟡 Lento", cls: "bg-warning/15 text-warning border-warning/30" },
    saudavel: { label: "🟢 Saudável", cls: "bg-success/15 text-success border-success/30" },
    sem_estoque: { label: "⚪ Sem estoque", cls: "bg-muted text-muted-foreground border-border" },
  };
  const m = map[classe] || map.saudavel;
  return <Badge variant="outline" className={`${m.cls} text-[10px]`}>{m.label}</Badge>;
}

/* ============= GIRO ============= */
function GiroTab({ analise }: { analise: any[] }) {
  const ordenado = [...analise].filter((x) => x.estoqueAtual > 0 || x.qtdVendida > 0).sort((a, b) => b.giro - a.giro);
  const top = ordenado.slice(0, 10);
  const bottom = [...ordenado].reverse().slice(0, 10);

  const exportar = () => exportXlsx(
    ordenado.map((x) => ({
      Código: x.perfume.codigo,
      Produto: x.perfume.nome,
      Marca: x.perfume.marca,
      Tipo: x.perfume.tipo,
      Vendido: x.qtdVendida,
      Estoque: x.estoqueAtual,
      "Média/dia": x.mediaDiaria.toFixed(2),
      "Dias estoque": isFinite(x.diasEstoque) ? x.diasEstoque.toFixed(0) : "∞",
      Giro: isFinite(x.giro) ? x.giro.toFixed(2) : "∞",
      Classe: x.classe,
    })),
    "giro_estoque",
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-xs text-muted-foreground">{ordenado.length} produtos analisados</p>
        <Button size="sm" variant="outline" onClick={exportar} className="gap-2"><Download size={14} />Excel</Button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-4 bg-card border-border">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><ArrowUpRight size={16} className="text-success" />Maior giro</h3>
          <RankingList items={top} metric="giro" />
        </Card>
        <Card className="p-4 bg-card border-border">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><ArrowDownRight size={16} className="text-destructive" />Menor giro</h3>
          <RankingList items={bottom} metric="giro" />
        </Card>
      </div>

      <Card className="bg-card border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-surface border-b border-border">
              <tr>
                <th className="text-left p-3 font-medium">Produto</th>
                <th className="text-right p-3 font-medium">Vendido</th>
                <th className="text-right p-3 font-medium">Estoque</th>
                <th className="text-right p-3 font-medium">Dias estoque</th>
                <th className="text-right p-3 font-medium">Giro</th>
                <th className="text-center p-3 font-medium">Classe</th>
              </tr>
            </thead>
            <tbody>
              {ordenado.slice(0, 100).map((x) => (
                <tr key={x.perfume.id} className="border-b border-border/50 hover:bg-surface/50">
                  <td className="p-3">
                    <p className="font-medium text-foreground">{x.perfume.nome}</p>
                    <p className="text-[10px] text-muted-foreground">{x.perfume.marca} · {x.perfume.codigo}</p>
                  </td>
                  <td className="text-right p-3">{x.qtdVendida}</td>
                  <td className="text-right p-3">{x.estoqueAtual}</td>
                  <td className="text-right p-3">{isFinite(x.diasEstoque) ? x.diasEstoque.toFixed(0) : "∞"}</td>
                  <td className="text-right p-3 font-medium">{isFinite(x.giro) ? x.giro.toFixed(2) : "∞"}</td>
                  <td className="text-center p-3"><ClasseBadge classe={x.classe} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function RankingList({ items, metric }: { items: any[]; metric: "giro" | "margem" | "receita" }) {
  return (
    <ul className="space-y-2">
      {items.map((x, i) => {
        const val = metric === "giro" ? (isFinite(x.giro) ? x.giro.toFixed(2) : "∞")
          : metric === "margem" ? `${x.margemPct.toFixed(1)}%`
          : fmtBRL(x.receita);
        return (
          <li key={x.perfume.id} className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-muted-foreground w-5">{i + 1}.</span>
              <span className="truncate">{x.perfume.nome}</span>
            </div>
            <span className="font-medium text-gold">{val}</span>
          </li>
        );
      })}
      {!items.length && <li className="text-xs text-muted-foreground">Sem dados</li>}
    </ul>
  );
}

/* ============= MARGEM ============= */
function MargemTab({ analise }: { analise: any[] }) {
  const comVenda = analise.filter((x) => x.qtdVendida > 0);
  const topMargem = [...comVenda].sort((a, b) => b.margemPct - a.margemPct).slice(0, 10);
  const baixaMargem = [...comVenda].sort((a, b) => a.margemPct - b.margemPct).slice(0, 10);

  const porCategoria = useMemo(() => {
    const map = new Map<string, { receita: number; lucro: number }>();
    for (const x of comVenda) {
      const k = x.perfume.tipo;
      const cur = map.get(k) || { receita: 0, lucro: 0 };
      cur.receita += x.receita;
      cur.lucro += x.lucro;
      map.set(k, cur);
    }
    return Array.from(map.entries()).map(([categoria, v]) => ({
      categoria,
      receita: v.receita,
      lucro: v.lucro,
      margemPct: v.receita > 0 ? (v.lucro / v.receita) * 100 : 0,
    }));
  }, [comVenda]);

  const exportar = () => exportXlsx(
    comVenda.map((x) => ({
      Código: x.perfume.codigo,
      Produto: x.perfume.nome,
      Categoria: x.perfume.tipo,
      Vendido: x.qtdVendida,
      Receita: x.receita.toFixed(2),
      Custo: x.custoTotal.toFixed(2),
      Lucro: x.lucro.toFixed(2),
      "Margem %": x.margemPct.toFixed(2),
    })),
    "margem_real",
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={exportar} className="gap-2"><Download size={14} />Excel</Button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-4 bg-card border-border">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><TrendingUp size={16} className="text-success" />Mais lucrativos</h3>
          <RankingList items={topMargem} metric="margem" />
        </Card>
        <Card className="p-4 bg-card border-border">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><TrendingDown size={16} className="text-destructive" />Menor margem</h3>
          <RankingList items={baixaMargem} metric="margem" />
        </Card>
      </div>

      <Card className="p-4 bg-card border-border">
        <h3 className="text-sm font-semibold mb-4">Margem por categoria</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={porCategoria}>
              <XAxis dataKey="categoria" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} formatter={(v: any, name) => name === "margemPct" ? `${Number(v).toFixed(1)}%` : fmtBRL(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="receita" fill="hsl(var(--gold))" name="Receita" radius={[6, 6, 0, 0]} />
              <Bar dataKey="lucro" fill="hsl(var(--success))" name="Lucro" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

/* ============= PROBLEMÁTICOS ============= */
function ProblematicosTab({ analise }: { analise: any[] }) {
  const problemas = useMemo(() => {
    return analise.map((x) => {
      const flags: string[] = [];
      const sugestoes: string[] = [];
      let score = 0;

      if (x.estoqueAtual > 0 && (x.diasSemVenda === null || x.diasSemVenda > 60)) {
        flags.push("Risco de encalhe");
        sugestoes.push("Aplicar promoção");
        score += 50;
      }
      if (x.estoqueAtual > 10 && x.qtdVendida < 2) {
        flags.push("Estoque excessivo");
        sugestoes.push("Reduzir próxima compra");
        sugestoes.push("Transferir para outra loja");
        score += 30;
      }
      if (isFinite(x.diasEstoque) && x.diasEstoque > 120) {
        flags.push("Baixa performance");
        score += 20;
      }
      if (x.diasSemVenda !== null && x.diasSemVenda > 90) {
        score += 30;
      }
      return { ...x, flags, sugestoes, score };
    }).filter((x) => x.flags.length > 0).sort((a, b) => b.score - a.score);
  }, [analise]);

  const exportar = () => exportXlsx(
    problemas.map((x) => ({
      Código: x.perfume.codigo,
      Produto: x.perfume.nome,
      Estoque: x.estoqueAtual,
      Vendido: x.qtdVendida,
      "Dias sem venda": x.diasSemVenda ?? "Nunca",
      Indicadores: x.flags.join(" + "),
      Sugestões: x.sugestoes.join("; "),
    })),
    "produtos_problematicos",
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-xs text-muted-foreground">{problemas.length} produtos requerem atenção</p>
        <Button size="sm" variant="outline" onClick={exportar} className="gap-2"><Download size={14} />Excel</Button>
      </div>

      {problemas.length === 0 ? (
        <Card className="p-8 text-center bg-card border-border">
          <p className="text-sm text-muted-foreground">🎉 Nenhum produto problemático encontrado no período</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {problemas.slice(0, 50).map((x) => (
            <Card key={x.perfume.id} className="p-4 bg-card border-border border-l-4 border-l-destructive">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">{x.perfume.nome}</p>
                  <p className="text-[11px] text-muted-foreground mb-2">{x.perfume.marca} · {x.perfume.codigo} · Estoque: {x.estoqueAtual} · Vendidos: {x.qtdVendida} · {x.diasSemVenda !== null ? `${x.diasSemVenda}d sem venda` : "Nunca vendido"}</p>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {x.flags.map((f: string) => (
                      <Badge key={f} variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/30">{f}</Badge>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {x.sugestoes.map((s: string) => (
                      <Badge key={s} variant="outline" className="text-[10px] bg-gold/10 text-gold border-gold/30">💡 {s}</Badge>
                    ))}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase text-muted-foreground">Risco</p>
                  <p className="text-2xl font-display font-semibold text-destructive">{x.score}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============= CURVA ABC ============= */
function CurvaAbcTab({ analise }: { analise: any[] }) {
  const { ranked, distribuicao } = useMemo(() => {
    const ranked = analise.filter((x) => x.receita > 0).sort((a, b) => b.receita - a.receita);
    const total = ranked.reduce((s, x) => s + x.receita, 0);
    let acc = 0;
    const out = ranked.map((x) => {
      acc += x.receita;
      const pctAcum = total > 0 ? (acc / total) * 100 : 0;
      const pct = total > 0 ? (x.receita / total) * 100 : 0;
      let classe: "A" | "B" | "C" = "C";
      if (pctAcum <= 80) classe = "A";
      else if (pctAcum <= 95) classe = "B";
      return { ...x, pct, pctAcum, classe };
    });
    const distribuicao = ["A", "B", "C"].map((c) => {
      const itens = out.filter((x) => x.classe === c);
      return {
        classe: `Classe ${c}`,
        produtos: itens.length,
        receita: itens.reduce((s, x) => s + x.receita, 0),
      };
    });
    return { ranked: out, distribuicao };
  }, [analise]);

  const COLORS = ["hsl(var(--gold))", "hsl(var(--success))", "hsl(var(--muted-foreground))"];

  const exportar = () => exportXlsx(
    ranked.map((x) => ({
      Classe: x.classe,
      Código: x.perfume.codigo,
      Produto: x.perfume.nome,
      Receita: x.receita.toFixed(2),
      "Participação %": x.pct.toFixed(2),
      "Acumulado %": x.pctAcum.toFixed(2),
    })),
    "curva_abc",
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={exportar} className="gap-2"><Download size={14} />Excel</Button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-4 bg-card border-border">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><PieIcon size={16} className="text-gold" />Distribuição</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={distribuicao} dataKey="receita" nameKey="classe" cx="50%" cy="50%" outerRadius={70} label={(e) => `${e.classe}`}>
                  {distribuicao.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} formatter={(v: any) => fmtBRL(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4 bg-card border-border">
          <h3 className="text-sm font-semibold mb-3">Resumo por classe</h3>
          <div className="space-y-3">
            {distribuicao.map((d, i) => (
              <div key={d.classe} className="p-3 rounded-lg bg-surface">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium" style={{ color: COLORS[i] }}>{d.classe}</span>
                  <span className="text-xs text-muted-foreground">{d.produtos} produtos</span>
                </div>
                <p className="text-lg font-display font-semibold text-foreground">{fmtBRL(d.receita)}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="bg-card border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-surface border-b border-border">
              <tr>
                <th className="text-center p-3 font-medium">Classe</th>
                <th className="text-left p-3 font-medium">Produto</th>
                <th className="text-right p-3 font-medium">Receita</th>
                <th className="text-right p-3 font-medium">Particip.</th>
                <th className="text-right p-3 font-medium">Acumulado</th>
              </tr>
            </thead>
            <tbody>
              {ranked.slice(0, 100).map((x) => (
                <tr key={x.perfume.id} className="border-b border-border/50 hover:bg-surface/50">
                  <td className="text-center p-3">
                    <Badge variant="outline" className={
                      x.classe === "A" ? "bg-gold/15 text-gold border-gold/30" :
                      x.classe === "B" ? "bg-success/15 text-success border-success/30" :
                      "bg-muted text-muted-foreground"
                    }>{x.classe}</Badge>
                  </td>
                  <td className="p-3">
                    <p className="font-medium text-foreground">{x.perfume.nome}</p>
                    <p className="text-[10px] text-muted-foreground">{x.perfume.marca}</p>
                  </td>
                  <td className="text-right p-3">{fmtBRL(x.receita)}</td>
                  <td className="text-right p-3">{x.pct.toFixed(1)}%</td>
                  <td className="text-right p-3 text-muted-foreground">{x.pctAcum.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ============= ALERTAS ============= */
function AlertasTab({ analise }: { analise: any[] }) {
  const alertas = useMemo(() => {
    const list: { nivel: "critico" | "atencao" | "ok"; titulo: string; produto: string; descricao: string }[] = [];
    for (const x of analise) {
      if (x.estoqueAtual === 0) {
        list.push({ nivel: "critico", titulo: "Produto zerado", produto: x.perfume.nome, descricao: `${x.perfume.codigo} sem estoque em todos os depósitos filtrados` });
      } else if (x.estoqueAtual <= x.perfume.estoqueMinimo && x.perfume.estoqueMinimo > 0) {
        list.push({ nivel: "critico", titulo: "Abaixo do mínimo", produto: x.perfume.nome, descricao: `${x.estoqueAtual} un / mínimo ${x.perfume.estoqueMinimo}` });
      }
      if (x.diasSemVenda !== null && x.diasSemVenda > 30 && x.estoqueAtual > 0) {
        list.push({ nivel: x.diasSemVenda > 60 ? "critico" : "atencao", titulo: "Produto parado", produto: x.perfume.nome, descricao: `${x.diasSemVenda} dias sem venda · ${x.estoqueAtual} un em estoque` });
      }
      if (x.estoqueAtual > 20 && x.qtdVendida === 0) {
        list.push({ nivel: "atencao", titulo: "Excesso de estoque", produto: x.perfume.nome, descricao: `${x.estoqueAtual} un parados sem venda no período` });
      }
    }
    return list.sort((a, b) => (a.nivel === "critico" ? -1 : 1) - (b.nivel === "critico" ? -1 : 1));
  }, [analise]);

  const criticos = alertas.filter((a) => a.nivel === "critico");
  const atencao = alertas.filter((a) => a.nivel === "atencao");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4 bg-card border-border border-l-4 border-l-destructive">
          <p className="text-[10px] uppercase tracking-wider text-destructive mb-1">Críticos</p>
          <p className="text-3xl font-display font-semibold text-destructive">{criticos.length}</p>
        </Card>
        <Card className="p-4 bg-card border-border border-l-4 border-l-warning">
          <p className="text-[10px] uppercase tracking-wider text-warning mb-1">Atenção</p>
          <p className="text-3xl font-display font-semibold text-warning">{atencao.length}</p>
        </Card>
      </div>

      {alertas.length === 0 ? (
        <Card className="p-8 text-center bg-card border-border">
          <p className="text-sm text-success">✅ Nenhum alerta no período</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {alertas.slice(0, 100).map((a, i) => {
            const cls = a.nivel === "critico"
              ? "border-l-destructive bg-destructive/5"
              : a.nivel === "atencao"
              ? "border-l-warning bg-warning/5"
              : "border-l-success bg-success/5";
            const dot = a.nivel === "critico" ? "bg-destructive" : a.nivel === "atencao" ? "bg-warning" : "bg-success";
            return (
              <Card key={i} className={`p-3 border-l-4 ${cls} border-border`}>
                <div className="flex items-start gap-3">
                  <div className={`w-2 h-2 rounded-full mt-1.5 ${dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-xs font-semibold uppercase tracking-wider">{a.titulo}</p>
                      <Badge variant="outline" className="text-[10px]">{a.nivel}</Badge>
                    </div>
                    <p className="text-sm font-medium text-foreground mt-0.5">{a.produto}</p>
                    <p className="text-[11px] text-muted-foreground">{a.descricao}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
