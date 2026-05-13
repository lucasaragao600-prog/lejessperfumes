import { useMemo, useState } from "react";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useConfiguracoesFiscais } from "@/hooks/useConfiguracoesFiscais";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Download,
  FileText,
  Layers,
  PieChart as PieIcon,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import {
  gerarFluxoCaixaDiario,
  gerarFluxoCaixaQuinzenal,
  gerarFluxoCaixaMensal,
  gerarFluxoCaixaPersonalizado,
} from "@/lib/pdf/fluxoCaixa";
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
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return 0;
  return Math.round((ta - tb) / 86400000);
}

function exportXlsx(rows: any[], filename: string) {
  if (!rows.length) return;
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Dados");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export default function Relatorios() {
  const { perfumes, vendas, concentracoesConfig, tiposPerfumeConfig } = useApp();
  const hoje = todayStr();
  const [dataInicio, setDataInicio] = useState(daysAgoStr(30));
  const [dataFim, setDataFim] = useState(hoje);
  const [deposito, setDeposito] = useState<"todos" | Deposito>("todos");
  const [tipo, setTipo] = useState<string>("todos");

  // Datas efetivas (evita crash quando o usuário limpa o input)
  const isValidDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(new Date(s).getTime());
  const dInicio = isValidDate(dataInicio) ? dataInicio : daysAgoStr(30);
  const dFim = isValidDate(dataFim) ? dataFim : hoje;

  const concNome = (sigla: string) => concentracoesConfig?.[sigla] || sigla;
  const tipoNome = (sigla: string) => tiposPerfumeConfig?.[sigla] || sigla;

  const periodoDias = Math.max(1, diffDays(dFim, dInicio) + 1);

  // Vendas filtradas
  const vendasFiltradas = useMemo(() => {
    return vendas.filter((v) => {
      if (v.data < dInicio || v.data > dFim) return false;
      if (deposito !== "todos" && v.deposito !== deposito) return false;
      return true;
    });
  }, [vendas, dInicio, dFim, deposito]);

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

      <Tabs defaultValue="fluxo" className="w-full">
        <TabsList className="grid grid-cols-3 md:grid-cols-7 w-full bg-surface mb-4 h-auto">
          <TabsTrigger value="fluxo" className="text-xs py-2"><Wallet size={14} className="mr-1.5 hidden md:inline" />Fluxo de Caixa</TabsTrigger>
          <TabsTrigger value="giro" className="text-xs py-2"><Activity size={14} className="mr-1.5 hidden md:inline" />Giro</TabsTrigger>
          <TabsTrigger value="margem" className="text-xs py-2"><TrendingUp size={14} className="mr-1.5 hidden md:inline" />Margem</TabsTrigger>
          <TabsTrigger value="problemas" className="text-xs py-2"><AlertTriangle size={14} className="mr-1.5 hidden md:inline" />Problemáticos</TabsTrigger>
          <TabsTrigger value="abc" className="text-xs py-2"><Layers size={14} className="mr-1.5 hidden md:inline" />Curva ABC</TabsTrigger>
          <TabsTrigger value="alertas" className="text-xs py-2"><Zap size={14} className="mr-1.5 hidden md:inline" />Alertas</TabsTrigger>
          <TabsTrigger value="classificacao" className="text-xs py-2"><Users size={14} className="mr-1.5 hidden md:inline" />Classificação</TabsTrigger>
        </TabsList>

        <TabsContent value="fluxo"><FluxoCaixaTab concNome={concNome} /></TabsContent>
        <TabsContent value="giro"><GiroTab analise={analise} concNome={concNome} tipoNome={tipoNome} /></TabsContent>
        <TabsContent value="margem"><MargemTab analise={analise} concNome={concNome} tipoNome={tipoNome} /></TabsContent>
        <TabsContent value="problemas"><ProblematicosTab analise={analise} concNome={concNome} /></TabsContent>
        <TabsContent value="abc"><CurvaAbcTab analise={analise} concNome={concNome} /></TabsContent>
        <TabsContent value="alertas"><AlertasTab analise={analise} concNome={concNome} /></TabsContent>
        <TabsContent value="classificacao"><ClassificacaoTab analise={analise} concNome={concNome} tipoNome={tipoNome} /></TabsContent>
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
function GiroTab({ analise, concNome, tipoNome }: { analise: any[]; concNome: (s: string) => string; tipoNome: (s: string) => string }) {
  const ordenado = [...analise].filter((x) => x.estoqueAtual > 0 || x.qtdVendida > 0).sort((a, b) => b.giro - a.giro);
  const top = ordenado.slice(0, 10);
  const bottom = [...ordenado].reverse().slice(0, 10);

  const exportar = () => exportXlsx(
    ordenado.map((x) => ({
      Código: x.perfume.codigo,
      Produto: x.perfume.nome,
      Marca: x.perfume.marca,
      Tipo: tipoNome(x.perfume.tipo),
      Concentração: concNome(x.perfume.concentracao),
      Volume: x.perfume.volume,
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
          <RankingList items={top} metric="giro" concNome={concNome} />
        </Card>
        <Card className="p-4 bg-card border-border">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><ArrowDownRight size={16} className="text-destructive" />Menor giro</h3>
          <RankingList items={bottom} metric="giro" concNome={concNome} />
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

function RankingList({ items, metric, concNome }: { items: any[]; metric: "giro" | "margem" | "receita"; concNome?: (s: string) => string }) {
  return (
    <ul className="space-y-3">
      {items.map((x, i) => {
        const val = metric === "giro" ? (isFinite(x.giro) ? x.giro.toFixed(2) : "∞")
          : metric === "margem" ? `${x.margemPct.toFixed(1)}%`
          : fmtBRL(x.receita);
        return (
          <li key={x.perfume.id} className="flex items-start justify-between gap-3 text-xs">
            <div className="flex items-start gap-2 min-w-0 flex-1">
              <span className="text-muted-foreground w-5 shrink-0">{i + 1}.</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-foreground font-medium">{x.perfume.nome}</p>
                <p className="truncate text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">
                  {x.perfume.marca} · {concNome ? concNome(x.perfume.concentracao) : x.perfume.concentracao} · {x.perfume.volume}ml
                </p>
              </div>
            </div>
            <span className="font-medium text-gold shrink-0">{val}</span>
          </li>
        );
      })}
      {!items.length && <li className="text-xs text-muted-foreground">Sem dados</li>}
    </ul>
  );
}

/* ============= MARGEM ============= */
function MargemTab({ analise, concNome, tipoNome }: { analise: any[]; concNome: (s: string) => string; tipoNome: (s: string) => string }) {
  // Apenas produtos com vendas E custo cadastrado (>0) entram no ranking de margem
  // — caso contrário a margem aparece como 100% e distorce a análise.
  const comVenda = analise.filter((x) => x.qtdVendida > 0 && x.custoTotal > 0);
  const topMargem = [...comVenda].sort((a, b) => b.margemPct - a.margemPct).slice(0, 10);
  const baixaMargem = [...comVenda].sort((a, b) => a.margemPct - b.margemPct).slice(0, 10);

  const porCategoria = useMemo(() => {
    const map = new Map<string, { receita: number; lucro: number }>();
    for (const x of comVenda) {
      const k = tipoNome(x.perfume.tipo);
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
  }, [comVenda, tipoNome]);

  const exportar = () => exportXlsx(
    comVenda.map((x) => ({
      Código: x.perfume.codigo,
      Produto: x.perfume.nome,
      Marca: x.perfume.marca,
      Categoria: tipoNome(x.perfume.tipo),
      Concentração: concNome(x.perfume.concentracao),
      Volume: x.perfume.volume,
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
          <RankingList items={topMargem} metric="margem" concNome={concNome} />
        </Card>
        <Card className="p-4 bg-card border-border">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><TrendingDown size={16} className="text-destructive" />Menor margem</h3>
          <RankingList items={baixaMargem} metric="margem" concNome={concNome} />
        </Card>
      </div>

      <Card className="p-4 bg-card border-border">
        <h3 className="text-sm font-semibold mb-4">Margem por categoria</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
          <BarChart data={porCategoria} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
              <XAxis
                dataKey="categoria"
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                interval={0}
                tick={{ fill: "hsl(var(--foreground))" }}
              />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                labelFormatter={(label) => `Categoria: ${label}`}
                formatter={(v: any, name) => name === "Margem %" ? `${Number(v).toFixed(1)}%` : fmtBRL(Number(v))}
              />
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
function ProblematicosTab({ analise, concNome }: { analise: any[]; concNome: (s: string) => string }) {
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
function CurvaAbcTab({ analise, concNome }: { analise: any[]; concNome: (s: string) => string }) {
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
function AlertasTab({ analise, concNome }: { analise: any[]; concNome: (s: string) => string }) {
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

/* ============= CLASSIFICAÇÃO (Gênero) ============= */
const CLASSES_GENERO = ["Masculino", "Feminino", "Compartilhável"] as const;
const CORES_CLASSE: Record<string, string> = {
  Masculino: "hsl(217 91% 60%)",
  Feminino: "hsl(330 81% 60%)",
  Compartilhável: "hsl(160 84% 39%)",
};

function ClassificacaoTab({ analise, concNome, tipoNome }: { analise: any[]; concNome: (s: string) => string; tipoNome: (s: string) => string }) {
  const porClasse = useMemo(() => {
    const map = new Map<string, { qtd: number; receita: number; lucro: number; produtos: number }>();
    for (const c of CLASSES_GENERO) map.set(c, { qtd: 0, receita: 0, lucro: 0, produtos: 0 });
    for (const x of analise) {
      const c = (x.perfume.classificacao || "Compartilhável") as string;
      if (!map.has(c)) map.set(c, { qtd: 0, receita: 0, lucro: 0, produtos: 0 });
      const cur = map.get(c)!;
      cur.qtd += x.qtdVendida;
      cur.receita += x.receita;
      cur.lucro += x.lucro;
      if (x.qtdVendida > 0) cur.produtos += 1;
    }
    return Array.from(map.entries()).map(([classe, v]) => ({ classe, ...v }));
  }, [analise]);

  const totalReceita = porClasse.reduce((s, x) => s + x.receita, 0);

  const exportar = (filtro?: string) => {
    const lista = analise
      .filter((x) => x.qtdVendida > 0)
      .filter((x) => !filtro || (x.perfume.classificacao || "Compartilhável") === filtro)
      .sort((a, b) => b.receita - a.receita)
      .map((x) => ({
        Código: x.perfume.codigo,
        Produto: x.perfume.nome,
        Marca: x.perfume.marca,
        Classificação: x.perfume.classificacao || "Compartilhável",
        Tipo: tipoNome(x.perfume.tipo),
        Concentração: concNome(x.perfume.concentracao),
        Volume: x.perfume.volume,
        Vendido: x.qtdVendida,
        Receita: x.receita.toFixed(2),
        Lucro: x.lucro.toFixed(2),
        "Margem %": x.margemPct.toFixed(2),
      }));
    exportXlsx(lista, filtro ? `vendas_${filtro.toLowerCase()}` : "vendas_por_classificacao");
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <p className="text-xs text-muted-foreground">Vendas agrupadas por classificação de gênero</p>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => exportar()} className="gap-2"><Download size={14} />Geral</Button>
          {CLASSES_GENERO.map((c) => (
            <Button key={c} size="sm" variant="outline" onClick={() => exportar(c)} className="gap-2">
              <Download size={14} />{c}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {porClasse.map((p) => (
          <Card key={p.classe} className="p-4 bg-card border-border border-l-4" style={{ borderLeftColor: CORES_CLASSE[p.classe] }}>
            <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: CORES_CLASSE[p.classe] }}>{p.classe}</p>
            <p className="text-2xl font-display font-semibold text-foreground">{fmtBRL(p.receita)}</p>
            <p className="text-[11px] text-muted-foreground mt-1">{p.qtd} un · {p.produtos} produtos · Lucro {fmtBRL(p.lucro)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{totalReceita > 0 ? ((p.receita / totalReceita) * 100).toFixed(1) : "0"}% da receita</p>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-4 bg-card border-border">
          <h3 className="text-sm font-semibold mb-3">Receita por classificação</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={porClasse} dataKey="receita" nameKey="classe" cx="50%" cy="50%" outerRadius={80} label={(e) => e.classe}>
                  {porClasse.map((p) => <Cell key={p.classe} fill={CORES_CLASSE[p.classe]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} formatter={(v: any) => fmtBRL(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-4 bg-card border-border">
          <h3 className="text-sm font-semibold mb-3">Quantidade vendida</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={porClasse} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                <XAxis dataKey="classe" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Bar dataKey="qtd" name="Unidades" radius={[6, 6, 0, 0]}>
                  {porClasse.map((p) => <Cell key={p.classe} fill={CORES_CLASSE[p.classe]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {CLASSES_GENERO.map((classe) => {
        const itens = analise
          .filter((x) => (x.perfume.classificacao || "Compartilhável") === classe && x.qtdVendida > 0)
          .sort((a, b) => b.receita - a.receita)
          .slice(0, 20);
        if (!itens.length) return null;
        return (
          <Card key={classe} className="bg-card border-border overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: CORES_CLASSE[classe] }} />
                Top {classe}
              </h3>
              <Badge variant="outline" className="text-[10px]">{itens.length} produtos</Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-surface border-b border-border">
                  <tr>
                    <th className="text-left p-3 font-medium">Produto</th>
                    <th className="text-right p-3 font-medium">Vendido</th>
                    <th className="text-right p-3 font-medium">Receita</th>
                    <th className="text-right p-3 font-medium">Lucro</th>
                    <th className="text-right p-3 font-medium">Margem</th>
                  </tr>
                </thead>
                <tbody>
                  {itens.map((x) => (
                    <tr key={x.perfume.id} className="border-b border-border/50 hover:bg-surface/50">
                      <td className="p-3">
                        <p className="font-medium text-foreground">{x.perfume.nome}</p>
                        <p className="text-[10px] text-muted-foreground">{x.perfume.marca} · {tipoNome(x.perfume.tipo)} · {concNome(x.perfume.concentracao)} · {x.perfume.volume}ml</p>
                      </td>
                      <td className="text-right p-3">{x.qtdVendida}</td>
                      <td className="text-right p-3 font-medium">{fmtBRL(x.receita)}</td>
                      <td className="text-right p-3">{fmtBRL(x.lucro)}</td>
                      <td className="text-right p-3 text-muted-foreground">{x.margemPct.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/* ============= FLUXO DE CAIXA ============= */
function isDateValid(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(new Date(s).getTime());
}
function fmtDataBr(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function FluxoCaixaTab({ concNome }: { concNome: (s: string) => string }) {
  const { perfumes, vendas, pagamentos } = useApp();
  const { role, profile } = useAuth();
  const { configFiscal } = useConfiguracoesFiscais();

  const lojasDisponiveis: Deposito[] = ["Casa", "Sumaúma", "Amazonas"];
  const lojaInicial: Deposito =
    role === "vendedor" && profile?.loja && (lojasDisponiveis as string[]).includes(profile.loja)
      ? (profile.loja as Deposito)
      : "Casa";

  const [loja, setLoja] = useState<Deposito>(lojaInicial);
  const hoje = todayStr();
  const [periodo, setPeriodo] = useState<"diario" | "quinzenal" | "mensal" | "personalizado">("diario");
  const [dataDiario, setDataDiario] = useState(hoje);
  const [mes, setMes] = useState(hoje.slice(0, 7));
  const [quinzena, setQuinzena] = useState<"1" | "2">("1");
  const [dataPersonalizadoInicio, setDataPersonalizadoInicio] = useState(daysAgoStr(7));
  const [dataPersonalizadoFim, setDataPersonalizadoFim] = useState(hoje);
  const [gerando, setGerando] = useState(false);

  const podeMudarLoja = role !== "vendedor";

  const intervaloPeriodo = (): { inicio: string; fim: string; label: string } => {
    const [y, m] = mes.split("-").map(Number);
    const ultimo = new Date(y, m, 0).getDate(); // último dia do mês
    if (periodo === "quinzenal") {
      if (quinzena === "1") {
        return { inicio: `${mes}-01`, fim: `${mes}-15`, label: "1ª quinzena" };
      }
      return { inicio: `${mes}-16`, fim: `${mes}-${String(ultimo).padStart(2, "0")}`, label: "2ª quinzena" };
    }
    if (periodo === "personalizado") {
      const inicio = isValidDate(dataPersonalizadoInicio) ? dataPersonalizadoInicio : daysAgoStr(7);
      const fim = isValidDate(dataPersonalizadoFim) ? dataPersonalizadoFim : hoje;
      return { inicio, fim, label: `${fmtDataBr(inicio)} a ${fmtDataBr(fim)}` };
    }
    return { inicio: `${mes}-01`, fim: `${mes}-${String(ultimo).padStart(2, "0")}`, label: "Mensal" };
  };

  const gerar = async () => {
    setGerando(true);
    try {
      let doc;
      let nomeArquivo = "";
      if (periodo === "diario") {
        doc = gerarFluxoCaixaDiario({
          loja,
          vendas,
          pagamentos,
          perfumes,
          config: configFiscal,
          concNome,
          data: dataDiario,
        });
        nomeArquivo = `fluxo-caixa-diario-${loja}-${dataDiario}.pdf`;
      } else if (periodo === "quinzenal") {
        const { inicio, fim } = intervaloPeriodo();
        doc = gerarFluxoCaixaQuinzenal({
          loja,
          vendas,
          pagamentos,
          perfumes,
          config: configFiscal,
          concNome,
          dataInicio: inicio,
          dataFim: fim,
        });
        nomeArquivo = `fluxo-caixa-quinzenal-${loja}-${mes}-Q${quinzena}.pdf`;
      } else if (periodo === "personalizado") {
        const { inicio, fim } = intervaloPeriodo();
        doc = gerarFluxoCaixaPersonalizado({
          loja,
          vendas,
          pagamentos,
          perfumes,
          config: configFiscal,
          concNome,
          dataInicio: inicio,
          dataFim: fim,
        });
        nomeArquivo = `fluxo-caixa-personalizado-${loja}-${inicio}-a-${fim}.pdf`;
      } else {
        const { inicio, fim } = intervaloPeriodo();
        doc = gerarFluxoCaixaMensal({
          loja,
          vendas,
          pagamentos,
          perfumes,
          config: configFiscal,
          concNome,
          dataInicio: inicio,
          dataFim: fim,
        });
        nomeArquivo = `fluxo-caixa-mensal-${loja}-${mes}.pdf`;
      }
      doc.save(nomeArquivo);
      toast.success("Relatório gerado com sucesso");
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao gerar relatório", { description: e?.message });
    } finally {
      setGerando(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-card border-border">
        <div className="flex items-center gap-2 mb-4">
          <Wallet size={16} className="text-gold" />
          <h3 className="text-sm font-semibold">Relatório de Fluxo de Caixa em PDF</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Loja</label>
            <Select value={loja} onValueChange={(v) => setLoja(v as Deposito)} disabled={!podeMudarLoja}>
              <SelectTrigger className="bg-surface"><SelectValue /></SelectTrigger>
              <SelectContent>
                {lojasDisponiveis.map((l) => (
                  <SelectItem key={l} value={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Período</label>
            <Select value={periodo} onValueChange={(v) => setPeriodo(v as any)}>
              <SelectTrigger className="bg-surface"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="diario">Diário</SelectItem>
                <SelectItem value="quinzenal">Quinzenal</SelectItem>
                <SelectItem value="mensal">Mensal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {periodo === "diario" ? (
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Data</label>
              <Input type="date" value={dataDiario} onChange={(e) => setDataDiario(e.target.value)} className="bg-surface" />
            </div>
          ) : (
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Mês</label>
              <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="bg-surface" />
            </div>
          )}

          {periodo === "quinzenal" && (
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Quinzena</label>
              <Select value={quinzena} onValueChange={(v) => setQuinzena(v as "1" | "2")}>
                <SelectTrigger className="bg-surface"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1ª (dias 1–15)</SelectItem>
                  <SelectItem value="2">2ª (dia 16 ao fim)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <Button onClick={gerar} disabled={gerando} className="gap-2">
          <FileText size={16} />
          {gerando ? "Gerando..." : "Gerar PDF"}
        </Button>

        <div className="mt-4 text-xs text-muted-foreground space-y-1">
          <p>• <strong>Diário</strong>: pagamentos por modalidade (com gráfico de pizza), vendas por vendedor, perfumes vendidos e reposição de estoque.</p>
          <p>• <strong>Quinzenal</strong>: faturamento, top produtos, ranking de vendedoras por quantidade e valor.</p>
          <p>• <strong>Mensal</strong>: vendedora destaque, comparativo, produtos mais vendidos e maior giro.</p>
        </div>
      </Card>
    </div>
  );
}
