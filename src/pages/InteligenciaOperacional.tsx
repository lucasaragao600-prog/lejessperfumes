import { useMemo, useState } from "react";
import { useApp } from "@/context/AppContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Crown,
  Download,
  PackageSearch,
  ShoppingBag,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import * as XLSX from "xlsx";
import type { Deposito, Perfume } from "@/data/mockData";
import { toast } from "sonner";

const DEPOSITOS: ("todos" | Deposito)[] = ["todos", "Casa", "Sumaúma", "Amazonas"];
const TIPOS_BASE = ["todos", "Árabe", "Importado", "Nicho", "Nacional", "Kit"];

/* ====== Taxas padrão (editáveis pelo usuário) ====== */
const TAXAS_PADRAO = {
  credito: 3.5, // %
  debito: 1.5,
  pix: 0,
  dinheiro: 0,
  contaAssinada: 0,
};

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const fmtPct = (v: number) => `${v.toFixed(1)}%`;

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
  if (!rows.length) {
    toast.error("Sem dados para exportar");
    return;
  }
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Dados");
  XLSX.writeFile(wb, `${filename}.xlsx`);
  toast.success("Excel gerado com sucesso");
}

/** Estima taxa de cartão sobre uma venda de acordo com o tipo de pagamento */
function taxaSobreVenda(tipoPagamento: string, taxas: typeof TAXAS_PADRAO): number {
  const t = (tipoPagamento || "").toLowerCase();
  if (t.includes("crédito") || t.includes("credito")) return taxas.credito / 100;
  if (t.includes("débito") || t.includes("debito")) return taxas.debito / 100;
  if (t.includes("pix")) return taxas.pix / 100;
  if (t.includes("dinheiro")) return taxas.dinheiro / 100;
  if (t.includes("assinada") || t.includes("crediário") || t.includes("crediario")) return taxas.contaAssinada / 100;
  return 0;
}

export default function InteligenciaOperacional() {
  const { perfumes, vendas, tiposPerfumeConfig } = useApp();
  const hoje = todayStr();
  const [dataInicio, setDataInicio] = useState(daysAgoStr(30));
  const [dataFim, setDataFim] = useState(hoje);
  const [deposito, setDeposito] = useState<"todos" | Deposito>("todos");
  const [tipo, setTipo] = useState<string>("todos");

  /* Configurações editáveis */
  const [taxas, setTaxas] = useState(TAXAS_PADRAO);
  const [diasReposicao, setDiasReposicao] = useState(15);
  const [diasParado, setDiasParado] = useState(30);

  const tipoNome = (s: string) => tiposPerfumeConfig?.[s] || s;
  const tiposDinamicos = useMemo(() => {
    const s = new Set<string>(["todos"]);
    perfumes.forEach((p) => s.add(p.tipo));
    return Array.from(s).length > 1 ? Array.from(s) : TIPOS_BASE;
  }, [perfumes]);

  // Datas efetivas (evita crash quando o usuário limpa o input)
  const isValidDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(new Date(s).getTime());
  const dInicio = isValidDate(dataInicio) ? dataInicio : daysAgoStr(30);
  const dFim = isValidDate(dataFim) ? dataFim : hoje;

  const periodoDias = Math.max(1, diffDays(dFim, dInicio) + 1);
  // Para sugestão de compra usamos histórico maior — últimos 60 dias se possível
  const periodoCompraDias = 60;
  const dataInicioCompra = daysAgoStr(periodoCompraDias);

  const vendasFiltradas = useMemo(
    () =>
      vendas.filter((v) => {
        if (v.data < dInicio || v.data > dFim) return false;
        if (deposito !== "todos" && v.deposito !== deposito) return false;
        return true;
      }),
    [vendas, dInicio, dFim, deposito],
  );

  const vendasCompra = useMemo(
    () =>
      vendas.filter((v) => {
        if (v.data < dataInicioCompra || v.data > hoje) return false;
        if (deposito !== "todos" && v.deposito !== deposito) return false;
        return true;
      }),
    [vendas, dataInicioCompra, hoje, deposito],
  );

  const estoqueAtualPerfume = (p: Perfume) => {
    if (deposito === "todos") return p.estoques.Casa + p.estoques.Sumaúma + p.estoques.Amazonas;
    return p.estoques[deposito];
  };

  /* ============ ANÁLISE PRINCIPAL ============ */
  const analise = useMemo(() => {
    const map = new Map<string, {
      perfume: Perfume;
      qtdVendida: number;
      receita: number;
      descontoTotal: number;
      taxasTotal: number;
      custoTotal: number;
      ultimaVenda: string | null;
      estoqueAtual: number;
      // Auxiliares para tendência
      qtdVendidaPrimeiraMetade: number;
      qtdVendidaSegundaMetade: number;
    }>();

    for (const p of perfumes) {
      if (tipo !== "todos" && p.tipo !== tipo) continue;
      map.set(p.id, {
        perfume: p,
        qtdVendida: 0,
        receita: 0,
        descontoTotal: 0,
        taxasTotal: 0,
        custoTotal: 0,
        ultimaVenda: null,
        estoqueAtual: estoqueAtualPerfume(p),
        qtdVendidaPrimeiraMetade: 0,
        qtdVendidaSegundaMetade: 0,
      });
    }

    const meioPeriodo = daysAgoStr(Math.floor(periodoDias / 2));

    for (const v of vendasFiltradas) {
      const item = map.get(v.perfumeId);
      if (!item) continue;
      const custoUn = item.perfume.custoMedio || item.perfume.custo || 0;
      const custoLinha = custoUn * v.quantidade;
      const taxaPct = taxaSobreVenda(v.tipoPagamento, taxas);
      const taxaLinha = v.total * taxaPct;
      item.qtdVendida += v.quantidade;
      item.receita += v.total;
      item.descontoTotal += v.desconto || 0;
      item.taxasTotal += taxaLinha;
      item.custoTotal += custoLinha;
      if (!item.ultimaVenda || v.data > item.ultimaVenda) item.ultimaVenda = v.data;
      if (v.data >= meioPeriodo) item.qtdVendidaSegundaMetade += v.quantidade;
      else item.qtdVendidaPrimeiraMetade += v.quantidade;
    }

    return Array.from(map.values()).map((it) => {
      const mediaDiaria = it.qtdVendida / periodoDias;
      const lucroBruto = it.receita - it.custoTotal;
      const lucroReal = it.receita - it.custoTotal - it.taxasTotal; // descontos já reduzem o "total"
      const margemPct = it.receita > 0 ? (lucroReal / it.receita) * 100 : 0;
      const diasSemVenda = it.ultimaVenda ? diffDays(hoje, it.ultimaVenda) : null;
      const diasEstoque = mediaDiaria > 0 ? it.estoqueAtual / mediaDiaria : it.estoqueAtual > 0 ? Infinity : 0;

      // Classificação de margem
      let nivelMargem: "negativa" | "baixa" | "saudavel" = "saudavel";
      if (margemPct < 0) nivelMargem = "negativa";
      else if (margemPct < 15) nivelMargem = "baixa";

      // Tendência
      const tendencia = it.qtdVendidaSegundaMetade - it.qtdVendidaPrimeiraMetade;

      return {
        ...it,
        mediaDiaria,
        diasEstoque,
        diasSemVenda,
        lucroBruto,
        lucroReal,
        margemPct,
        nivelMargem,
        tendencia,
      };
    });
  }, [perfumes, vendasFiltradas, tipo, deposito, periodoDias, hoje, taxas]);

  /* ============ KPIs EXECUTIVO ============ */
  const kpis = useMemo(() => {
    const totalReceita = analise.reduce((s, x) => s + x.receita, 0);
    const totalLucro = analise.reduce((s, x) => s + x.lucroReal, 0);
    const totalCusto = analise.reduce((s, x) => s + x.custoTotal, 0);
    const margemMedia = totalReceita > 0 ? (totalLucro / totalReceita) * 100 : 0;
    const totalEstoqueCusto = perfumes.reduce(
      (s, p) =>
        s +
        (deposito === "todos"
          ? p.estoques.Casa + p.estoques.Sumaúma + p.estoques.Amazonas
          : p.estoques[deposito]) *
          (p.custoMedio || p.custo || 0),
      0,
    );
    const totalEstoqueVenda = perfumes.reduce(
      (s, p) =>
        s +
        (deposito === "todos"
          ? p.estoques.Casa + p.estoques.Sumaúma + p.estoques.Amazonas
          : p.estoques[deposito]) *
          (p.precoVenda || 0),
      0,
    );
    const valorParado = analise
      .filter((x) => x.diasSemVenda === null || x.diasSemVenda > diasParado)
      .reduce((s, x) => s + x.estoqueAtual * (x.perfume.custoMedio || x.perfume.custo || 0), 0);
    return { totalReceita, totalLucro, totalCusto, margemMedia, totalEstoqueCusto, totalEstoqueVenda, valorParado };
  }, [analise, perfumes, deposito, diasParado]);

  /* ============ COMPARATIVO PERÍODO ANTERIOR ============ */
  const periodoAnterior = useMemo(() => {
    const fimAnt = daysAgoStr(periodoDias);
    const inicioAnt = daysAgoStr(periodoDias * 2 - 1);
    const vendasAnt = vendas.filter((v) => v.data >= inicioAnt && v.data <= fimAnt && (deposito === "todos" || v.deposito === deposito));
    const receita = vendasAnt.reduce((s, v) => s + v.total, 0);
    const custo = vendasAnt.reduce((s, v) => {
      const p = perfumes.find((x) => x.id === v.perfumeId);
      const c = p ? p.custoMedio || p.custo : 0;
      return s + c * v.quantidade;
    }, 0);
    const taxas2 = vendasAnt.reduce((s, v) => s + v.total * taxaSobreVenda(v.tipoPagamento, taxas), 0);
    const lucro = receita - custo - taxas2;
    return { receita, lucro };
  }, [vendas, perfumes, periodoDias, deposito, taxas]);

  const variacaoReceita = periodoAnterior.receita > 0 ? ((kpis.totalReceita - periodoAnterior.receita) / periodoAnterior.receita) * 100 : 0;
  const variacaoLucro = periodoAnterior.lucro !== 0 ? ((kpis.totalLucro - periodoAnterior.lucro) / Math.abs(periodoAnterior.lucro)) * 100 : 0;

  /* ============ SUGESTÃO DE COMPRA (baseada em 60d) ============ */
  const sugestoes = useMemo(() => {
    const map = new Map<string, { perfume: Perfume; qtd: number; estoqueAtual: number }>();
    for (const p of perfumes) {
      if (tipo !== "todos" && p.tipo !== tipo) continue;
      map.set(p.id, { perfume: p, qtd: 0, estoqueAtual: estoqueAtualPerfume(p) });
    }
    for (const v of vendasCompra) {
      const it = map.get(v.perfumeId);
      if (it) it.qtd += v.quantidade;
    }
    return Array.from(map.values())
      .map((it) => {
        const mediaDiaria = it.qtd / periodoCompraDias;
        const ideal = mediaDiaria * diasReposicao;
        const sugestao = Math.max(0, Math.ceil(ideal - it.estoqueAtual));
        let prioridade: "urgente" | "moderado" | "baixo" = "baixo";
        if (it.estoqueAtual === 0 && mediaDiaria > 0) prioridade = "urgente";
        else if (mediaDiaria > 0 && it.estoqueAtual / Math.max(mediaDiaria, 0.01) < 7) prioridade = "urgente";
        else if (mediaDiaria > 0 && it.estoqueAtual / Math.max(mediaDiaria, 0.01) < 14) prioridade = "moderado";
        return { ...it, mediaDiaria, ideal, sugestao, prioridade };
      })
      .filter((x) => x.sugestao > 0 && x.mediaDiaria > 0);
  }, [perfumes, vendasCompra, tipo, deposito, diasReposicao]);

  return (
    <div className="px-4 md:px-0 pt-4 pb-24 md:pb-10 animate-page-enter">
      <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="page-subtitle mb-1 flex items-center gap-2">
            <Sparkles size={12} className="text-gold" />
            Inteligência Operacional
          </p>
          <h1 className="page-title">Decisão Automática</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Margem real, alertas, sugestão de compra e visão executiva
          </p>
        </div>
      </div>

      {/* Filtros globais */}
      <Card className="p-4 mb-4 bg-card border-border">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <FilterField label="Início">
            <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="bg-surface" />
          </FilterField>
          <FilterField label="Fim">
            <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="bg-surface" />
          </FilterField>
          <FilterField label="Depósito">
            <Select value={deposito} onValueChange={(v) => setDeposito(v as any)}>
              <SelectTrigger className="bg-surface"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DEPOSITOS.map((d) => (
                  <SelectItem key={d} value={d}>{d === "todos" ? "Todos" : d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label="Categoria">
            <Select value={tipo} onValueChange={(v) => setTipo(v)}>
              <SelectTrigger className="bg-surface"><SelectValue /></SelectTrigger>
              <SelectContent>
                {tiposDinamicos.map((t) => (
                  <SelectItem key={t} value={t}>{t === "todos" ? "Todas" : tipoNome(t)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
        </div>
      </Card>

      <Tabs defaultValue="executivo" className="w-full">
        <TabsList className="grid grid-cols-4 w-full bg-surface mb-4 h-auto">
          <TabsTrigger value="executivo" className="text-xs py-2">
            <Crown size={14} className="mr-1.5 hidden md:inline" />Executivo
          </TabsTrigger>
          <TabsTrigger value="margem" className="text-xs py-2">
            <Wallet size={14} className="mr-1.5 hidden md:inline" />Margem Real
          </TabsTrigger>
          <TabsTrigger value="alertas" className="text-xs py-2">
            <Zap size={14} className="mr-1.5 hidden md:inline" />Alertas
          </TabsTrigger>
          <TabsTrigger value="compra" className="text-xs py-2">
            <ShoppingBag size={14} className="mr-1.5 hidden md:inline" />Sugestão
          </TabsTrigger>
        </TabsList>

        <TabsContent value="executivo">
          <ExecutivoTab kpis={kpis} variacaoReceita={variacaoReceita} variacaoLucro={variacaoLucro} analise={analise} sugestoes={sugestoes} />
        </TabsContent>
        <TabsContent value="margem">
          <MargemTab analise={analise} taxas={taxas} setTaxas={setTaxas} tipoNome={tipoNome} />
        </TabsContent>
        <TabsContent value="alertas">
          <AlertasTab analise={analise} diasParado={diasParado} setDiasParado={setDiasParado} />
        </TabsContent>
        <TabsContent value="compra">
          <CompraTab sugestoes={sugestoes} diasReposicao={diasReposicao} setDiasReposicao={setDiasReposicao} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">{label}</label>
      {children}
    </div>
  );
}

/* ============================== EXECUTIVO ============================== */
function ExecutivoTab({
  kpis, variacaoReceita, variacaoLucro, analise, sugestoes,
}: {
  kpis: any; variacaoReceita: number; variacaoLucro: number; analise: any[]; sugestoes: any[];
}) {
  const topVendidos = [...analise].filter((x) => x.qtdVendida > 0).sort((a, b) => b.qtdVendida - a.qtdVendida).slice(0, 5);
  const topLucrativos = [...analise].filter((x) => x.lucroReal > 0).sort((a, b) => b.lucroReal - a.lucroReal).slice(0, 5);
  const parados = [...analise].filter((x) => (x.diasSemVenda === null || x.diasSemVenda > 30) && x.estoqueAtual > 0).slice(0, 5);
  const margemBaixa = [...analise].filter((x) => x.qtdVendida > 0 && x.custoTotal > 0 && x.margemPct < 15).sort((a, b) => a.margemPct - b.margemPct).slice(0, 5);
  const semEstoque = [...analise].filter((x) => x.estoqueAtual === 0 && x.qtdVendida > 0).slice(0, 5);
  const proximoFim = [...analise].filter((x) => x.estoqueAtual > 0 && x.estoqueAtual <= (x.perfume.estoqueMinimo || 3)).slice(0, 5);

  return (
    <div className="space-y-4">
      {/* KPIs principais */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <KpiCardLarge icon={<TrendingUp size={16} />} label="Faturamento" value={fmtBRL(kpis.totalReceita)} delta={variacaoReceita} accent="success" />
        <KpiCardLarge icon={<Wallet size={16} />} label="Lucro real" value={fmtBRL(kpis.totalLucro)} delta={variacaoLucro} accent="gold" />
        <KpiCardLarge icon={<Sparkles size={16} />} label="Margem média" value={fmtPct(kpis.margemMedia)} accent="gold" />
        <KpiCardLarge icon={<PackageSearch size={16} />} label="Estoque (custo)" value={fmtBRL(kpis.totalEstoqueCusto)} accent="muted" />
        <KpiCardLarge icon={<PackageSearch size={16} />} label="Estoque (venda)" value={fmtBRL(kpis.totalEstoqueVenda)} accent="muted" />
        <KpiCardLarge icon={<AlertTriangle size={16} />} label="Parado em estoque" value={fmtBRL(kpis.valorParado)} accent="destructive" />
      </div>

      {/* Top produtos */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-4 bg-card border-border">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <ArrowUpRight size={16} className="text-success" />Mais vendidos
          </h3>
          <MiniRanking items={topVendidos} render={(x) => `${x.qtdVendida} un`} />
        </Card>
        <Card className="p-4 bg-card border-border">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Wallet size={16} className="text-gold" />Mais lucrativos
          </h3>
          <MiniRanking items={topLucrativos} render={(x) => fmtBRL(x.lucroReal)} />
        </Card>
      </div>

      {/* Problemas */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="p-4 bg-card border-border border-l-4 border-l-warning">
          <h3 className="text-sm font-semibold mb-3 text-warning flex items-center gap-2">
            <TrendingDown size={16} />Produtos parados
          </h3>
          <MiniRanking items={parados} render={(x) => `${x.diasSemVenda ?? "—"}d`} accent="warning" />
        </Card>
        <Card className="p-4 bg-card border-border border-l-4 border-l-destructive">
          <h3 className="text-sm font-semibold mb-3 text-destructive flex items-center gap-2">
            <ArrowDownRight size={16} />Margem baixa
          </h3>
          <MiniRanking items={margemBaixa} render={(x) => fmtPct(x.margemPct)} accent="destructive" />
        </Card>
        <Card className="p-4 bg-card border-border border-l-4 border-l-destructive">
          <h3 className="text-sm font-semibold mb-3 text-destructive flex items-center gap-2">
            <AlertTriangle size={16} />Sem estoque
          </h3>
          <MiniRanking items={semEstoque} render={(x) => `${x.qtdVendida}v`} accent="destructive" />
        </Card>
      </div>

      {/* Operacional */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-4 bg-card border-border">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <PackageSearch size={16} className="text-warning" />Próximos de acabar
          </h3>
          <MiniRanking items={proximoFim} render={(x) => `${x.estoqueAtual} un`} accent="warning" />
        </Card>
        <Card className="p-4 bg-card border-border">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <ShoppingBag size={16} className="text-gold" />Top sugestões de compra
          </h3>
          <ul className="space-y-2">
            {sugestoes.slice(0, 5).map((x) => (
              <li key={x.perfume.id} className="flex justify-between text-xs">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{x.perfume.nome}</p>
                  <p className="text-[10px] text-muted-foreground">{x.perfume.marca}</p>
                </div>
                <span className="text-gold font-semibold ml-2">{x.sugestao} un</span>
              </li>
            ))}
            {!sugestoes.length && <li className="text-xs text-muted-foreground">Nenhuma sugestão no momento</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function KpiCardLarge({
  icon, label, value, delta, accent,
}: { icon: React.ReactNode; label: string; value: string; delta?: number; accent: "gold" | "success" | "destructive" | "muted" }) {
  const colorMap: Record<string, string> = {
    gold: "text-gold",
    success: "text-success",
    destructive: "text-destructive",
    muted: "text-muted-foreground",
  };
  return (
    <Card className="p-4 bg-card border-border">
      <div className={`flex items-center gap-2 mb-2 ${colorMap[accent]}`}>
        {icon}
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-xl md:text-2xl font-display font-semibold text-foreground">{value}</p>
      {delta !== undefined && (
        <p className={`text-[11px] mt-1 flex items-center gap-1 ${delta >= 0 ? "text-success" : "text-destructive"}`}>
          {delta >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          {delta >= 0 ? "+" : ""}{delta.toFixed(1)}% vs anterior
        </p>
      )}
    </Card>
  );
}

function MiniRanking({ items, render, accent }: { items: any[]; render: (x: any) => string; accent?: "warning" | "destructive" }) {
  const valColor = accent === "warning" ? "text-warning" : accent === "destructive" ? "text-destructive" : "text-gold";
  return (
    <ul className="space-y-2">
      {items.map((x, i) => (
        <li key={x.perfume.id} className="flex justify-between items-start gap-2 text-xs">
          <div className="flex items-start gap-2 min-w-0 flex-1">
            <span className="text-muted-foreground w-4 shrink-0">{i + 1}.</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-foreground">{x.perfume.nome}</p>
              <p className="truncate text-[10px] text-muted-foreground uppercase tracking-wide">
                {x.perfume.marca} · {x.perfume.volume}ml
              </p>
            </div>
          </div>
          <span className={`font-semibold shrink-0 ${valColor}`}>{render(x)}</span>
        </li>
      ))}
      {!items.length && <li className="text-xs text-muted-foreground">Sem dados</li>}
    </ul>
  );
}

/* ============================== MARGEM REAL ============================== */
function MargemTab({
  analise, taxas, setTaxas, tipoNome,
}: { analise: any[]; taxas: typeof TAXAS_PADRAO; setTaxas: (t: typeof TAXAS_PADRAO) => void; tipoNome: (s: string) => string }) {
  const comVenda = analise.filter((x) => x.qtdVendida > 0 && x.custoTotal > 0);
  const ordenado = [...comVenda].sort((a, b) => b.lucroReal - a.lucroReal);
  const top = ordenado.slice(0, 10);
  const baixa = [...comVenda].sort((a, b) => a.margemPct - b.margemPct).slice(0, 10);

  const porCategoria = useMemo(() => {
    const map = new Map<string, { receita: number; lucro: number }>();
    for (const x of comVenda) {
      const k = tipoNome(x.perfume.tipo);
      const cur = map.get(k) || { receita: 0, lucro: 0 };
      cur.receita += x.receita;
      cur.lucro += x.lucroReal;
      map.set(k, cur);
    }
    return Array.from(map.entries()).map(([categoria, v]) => ({
      categoria,
      receita: v.receita,
      lucro: v.lucro,
      margemPct: v.receita > 0 ? (v.lucro / v.receita) * 100 : 0,
    }));
  }, [comVenda, tipoNome]);

  const exportar = () =>
    exportXlsx(
      comVenda.map((x) => ({
        Código: x.perfume.codigo,
        Produto: x.perfume.nome,
        Marca: x.perfume.marca,
        Categoria: tipoNome(x.perfume.tipo),
        Vendido: x.qtdVendida,
        Receita: Number(x.receita.toFixed(2)),
        Custo: Number(x.custoTotal.toFixed(2)),
        Descontos: Number(x.descontoTotal.toFixed(2)),
        "Taxas cartão": Number(x.taxasTotal.toFixed(2)),
        "Lucro real": Number(x.lucroReal.toFixed(2)),
        "Margem %": Number(x.margemPct.toFixed(2)),
        Status: x.nivelMargem,
      })),
      "margem_real",
    );

  return (
    <div className="space-y-4">
      {/* Configuração de taxas */}
      <Card className="p-4 bg-card border-border">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-sm font-semibold">Taxas aplicadas (% sobre venda)</h3>
          <Button size="sm" variant="outline" onClick={exportar} className="gap-2"><Download size={14} />Excel</Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {(["credito", "debito", "pix", "dinheiro", "contaAssinada"] as const).map((k) => (
            <FilterField key={k} label={k === "contaAssinada" ? "Conta assinada" : k}>
              <Input
                type="number"
                step="0.1"
                min="0"
                value={taxas[k]}
                onChange={(e) => setTaxas({ ...taxas, [k]: parseFloat(e.target.value) || 0 })}
                className="bg-surface"
              />
            </FilterField>
          ))}
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-4 bg-card border-border">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <TrendingUp size={16} className="text-success" />Mais lucrativos
          </h3>
          <MargemRanking items={top} mode="lucro" />
        </Card>
        <Card className="p-4 bg-card border-border">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <TrendingDown size={16} className="text-destructive" />Menor margem
          </h3>
          <MargemRanking items={baixa} mode="margem" />
        </Card>
      </div>

      <Card className="p-4 bg-card border-border">
        <h3 className="text-sm font-semibold mb-4">Margem por categoria</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={porCategoria} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="categoria" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                formatter={(v: any) => fmtBRL(Number(v))}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="receita" fill="hsl(var(--gold))" name="Receita" radius={[6, 6, 0, 0]} />
              <Bar dataKey="lucro" fill="hsl(var(--success))" name="Lucro" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Tabela detalhada */}
      <Card className="bg-card border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-surface border-b border-border">
              <tr>
                <th className="text-left p-3">Produto</th>
                <th className="text-right p-3">Receita</th>
                <th className="text-right p-3">Custo</th>
                <th className="text-right p-3">Taxas</th>
                <th className="text-right p-3">Lucro real</th>
                <th className="text-right p-3">Margem</th>
                <th className="text-center p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {ordenado.slice(0, 100).map((x) => (
                <tr key={x.perfume.id} className="border-b border-border/50 hover:bg-surface/50">
                  <td className="p-3">
                    <p className="font-medium text-foreground">{x.perfume.nome}</p>
                    <p className="text-[10px] text-muted-foreground">{x.perfume.marca} · {x.perfume.codigo}</p>
                  </td>
                  <td className="text-right p-3">{fmtBRL(x.receita)}</td>
                  <td className="text-right p-3 text-muted-foreground">{fmtBRL(x.custoTotal)}</td>
                  <td className="text-right p-3 text-muted-foreground">{fmtBRL(x.taxasTotal)}</td>
                  <td className="text-right p-3 font-semibold">{fmtBRL(x.lucroReal)}</td>
                  <td className="text-right p-3 font-medium">{fmtPct(x.margemPct)}</td>
                  <td className="text-center p-3"><MargemBadge nivel={x.nivelMargem} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function MargemBadge({ nivel }: { nivel: "negativa" | "baixa" | "saudavel" }) {
  const map = {
    negativa: { label: "🔴 Negativa", cls: "bg-destructive/15 text-destructive border-destructive/30" },
    baixa: { label: "🟡 Baixa", cls: "bg-warning/15 text-warning border-warning/30" },
    saudavel: { label: "🟢 Saudável", cls: "bg-success/15 text-success border-success/30" },
  };
  const m = map[nivel];
  return <Badge variant="outline" className={`${m.cls} text-[10px]`}>{m.label}</Badge>;
}

function MargemRanking({ items, mode }: { items: any[]; mode: "lucro" | "margem" }) {
  return (
    <ul className="space-y-3">
      {items.map((x, i) => (
        <li key={x.perfume.id} className="flex items-start justify-between gap-3 text-xs">
          <div className="flex items-start gap-2 min-w-0 flex-1">
            <span className="text-muted-foreground w-5 shrink-0">{i + 1}.</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-foreground font-medium">{x.perfume.nome}</p>
              <p className="truncate text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">
                {x.perfume.marca} · {x.perfume.volume}ml
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="font-semibold text-gold">{mode === "lucro" ? fmtBRL(x.lucroReal) : fmtPct(x.margemPct)}</p>
            <p className="text-[10px] text-muted-foreground">{mode === "lucro" ? fmtPct(x.margemPct) : fmtBRL(x.lucroReal)}</p>
          </div>
        </li>
      ))}
      {!items.length && <li className="text-xs text-muted-foreground">Sem dados</li>}
    </ul>
  );
}

/* ============================== ALERTAS ============================== */
function AlertasTab({
  analise, diasParado, setDiasParado,
}: { analise: any[]; diasParado: number; setDiasParado: (n: number) => void }) {
  const alertas = useMemo(() => {
    type A = {
      nivel: "critico" | "atencao" | "info";
      titulo: string;
      produto: any;
      descricao: string;
      acao: string;
      score: number;
    };
    const out: A[] = [];
    for (const x of analise) {
      // Críticos
      if (x.estoqueAtual === 0 && x.qtdVendida > 0) {
        out.push({ nivel: "critico", titulo: "Ruptura de estoque", produto: x.perfume, descricao: `Zerado com ${x.qtdVendida} vendas recentes`, acao: "Repor estoque urgente", score: 100 });
      } else if (x.estoqueAtual === 0 && x.perfume.estoqueMinimo > 0) {
        out.push({ nivel: "critico", titulo: "Produto zerado", produto: x.perfume, descricao: `Estoque mínimo: ${x.perfume.estoqueMinimo}`, acao: "Repor estoque", score: 80 });
      } else if (x.estoqueAtual <= x.perfume.estoqueMinimo && x.perfume.estoqueMinimo > 0) {
        out.push({ nivel: "critico", titulo: "Abaixo do mínimo", produto: x.perfume, descricao: `${x.estoqueAtual} un / mínimo ${x.perfume.estoqueMinimo}`, acao: "Repor estoque", score: 70 });
      }
      if (x.qtdVendida > 0 && x.custoTotal > 0 && x.margemPct < 0) {
        out.push({ nivel: "critico", titulo: "Margem negativa", produto: x.perfume, descricao: `${fmtPct(x.margemPct)} · prejuízo ${fmtBRL(Math.abs(x.lucroReal))}`, acao: "Revisar preço de venda", score: 90 });
      }
      if (x.diasSemVenda !== null && x.diasSemVenda > diasParado * 2 && x.estoqueAtual > 0) {
        out.push({ nivel: "critico", titulo: "Sem venda há muito tempo", produto: x.perfume, descricao: `${x.diasSemVenda}d sem vendas · ${x.estoqueAtual} un parados`, acao: "Criar promoção / liquidação", score: 75 });
      }
      if (x.estoqueAtual > 10 && x.qtdVendida === 0) {
        out.push({ nivel: "critico", titulo: "Estoque alto sem giro", produto: x.perfume, descricao: `${x.estoqueAtual} un · 0 vendas no período`, acao: "Reduzir preço / transferir loja", score: 60 });
      }

      // Atenção
      if (x.qtdVendida > 0 && x.custoTotal > 0 && x.margemPct >= 0 && x.margemPct < 15) {
        out.push({ nivel: "atencao", titulo: "Margem baixa", produto: x.perfume, descricao: `Apenas ${fmtPct(x.margemPct)} de lucro`, acao: "Avaliar reajuste de preço", score: 40 });
      }
      if (x.diasSemVenda !== null && x.diasSemVenda > diasParado && x.diasSemVenda <= diasParado * 2 && x.estoqueAtual > 0) {
        out.push({ nivel: "atencao", titulo: "Giro baixo", produto: x.perfume, descricao: `${x.diasSemVenda}d sem venda`, acao: "Destacar na vitrine", score: 35 });
      }
      if (x.tendencia < -3 && x.qtdVendida > 0) {
        out.push({ nivel: "atencao", titulo: "Queda de vendas", produto: x.perfume, descricao: `Venda caiu ${Math.abs(x.tendencia)} un na 2ª metade do período`, acao: "Investigar causa / promover", score: 30 });
      }

      // Informativos
      if (x.qtdVendida >= 10 && x.margemPct >= 25 && x.estoqueAtual > 0) {
        out.push({ nivel: "info", titulo: "Vendendo bem", produto: x.perfume, descricao: `${x.qtdVendida} un · margem ${fmtPct(x.margemPct)}`, acao: "Manter estoque alto", score: 20 });
      }
    }
    return out.sort((a, b) => b.score - a.score);
  }, [analise, diasParado]);

  const criticos = alertas.filter((a) => a.nivel === "critico");
  const atencao = alertas.filter((a) => a.nivel === "atencao");
  const info = alertas.filter((a) => a.nivel === "info");

  const exportar = () =>
    exportXlsx(
      alertas.map((a) => ({
        Nível: a.nivel,
        Tipo: a.titulo,
        Produto: a.produto.nome,
        Marca: a.produto.marca,
        Código: a.produto.codigo,
        Detalhe: a.descricao,
        "Ação sugerida": a.acao,
        Score: a.score,
      })),
      "alertas_inteligentes",
    );

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-card border-border">
        <div className="flex flex-wrap items-end gap-3 justify-between">
          <FilterField label="Dias considerados 'parado'">
            <Input
              type="number"
              min="1"
              value={diasParado}
              onChange={(e) => setDiasParado(Math.max(1, parseInt(e.target.value) || 30))}
              className="bg-surface w-32"
            />
          </FilterField>
          <Button size="sm" variant="outline" onClick={exportar} className="gap-2"><Download size={14} />Excel</Button>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4 bg-card border-border border-l-4 border-l-destructive">
          <p className="text-[10px] uppercase tracking-wider text-destructive mb-1">🔴 Críticos</p>
          <p className="text-3xl font-display font-semibold text-destructive">{criticos.length}</p>
        </Card>
        <Card className="p-4 bg-card border-border border-l-4 border-l-warning">
          <p className="text-[10px] uppercase tracking-wider text-warning mb-1">🟡 Atenção</p>
          <p className="text-3xl font-display font-semibold text-warning">{atencao.length}</p>
        </Card>
        <Card className="p-4 bg-card border-border border-l-4 border-l-success">
          <p className="text-[10px] uppercase tracking-wider text-success mb-1">🟢 Positivos</p>
          <p className="text-3xl font-display font-semibold text-success">{info.length}</p>
        </Card>
      </div>

      {alertas.length === 0 ? (
        <Card className="p-8 text-center bg-card border-border">
          <p className="text-sm text-success">✅ Nenhum alerta no período</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {alertas.slice(0, 200).map((a, i) => {
            const cls = a.nivel === "critico" ? "border-l-destructive bg-destructive/5"
              : a.nivel === "atencao" ? "border-l-warning bg-warning/5"
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
                    <p className="text-sm font-medium text-foreground mt-0.5">{a.produto.nome}</p>
                    <p className="text-[11px] text-muted-foreground">{a.produto.marca} · {a.descricao}</p>
                    <div className="mt-1.5">
                      <Badge variant="outline" className="text-[10px] bg-gold/10 text-gold border-gold/30">
                        💡 Ação: {a.acao}
                      </Badge>
                    </div>
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

/* ============================== SUGESTÃO DE COMPRA ============================== */
function CompraTab({
  sugestoes, diasReposicao, setDiasReposicao,
}: { sugestoes: any[]; diasReposicao: number; setDiasReposicao: (n: number) => void }) {
  const [ajustes, setAjustes] = useState<Record<string, number>>({});
  const [filtroPrior, setFiltroPrior] = useState<"todas" | "urgente" | "moderado" | "baixo">("todas");

  const getQtd = (id: string, padrao: number) => (ajustes[id] !== undefined ? ajustes[id] : padrao);

  const filtradas = useMemo(() => {
    const base = filtroPrior === "todas" ? sugestoes : sugestoes.filter((s) => s.prioridade === filtroPrior);
    return [...base].sort((a, b) => {
      const order = { urgente: 0, moderado: 1, baixo: 2 } as Record<string, number>;
      return order[a.prioridade] - order[b.prioridade];
    });
  }, [sugestoes, filtroPrior]);

  const totalUnidades = filtradas.reduce((s, x) => s + getQtd(x.perfume.id, x.sugestao), 0);
  const totalCusto = filtradas.reduce(
    (s, x) => s + getQtd(x.perfume.id, x.sugestao) * (x.perfume.custoMedio || x.perfume.custo || 0),
    0,
  );

  const exportar = () =>
    exportXlsx(
      filtradas.map((x) => ({
        Prioridade: x.prioridade,
        Código: x.perfume.codigo,
        Produto: x.perfume.nome,
        Marca: x.perfume.marca,
        "Estoque atual": x.estoqueAtual,
        "Média/dia (60d)": Number(x.mediaDiaria.toFixed(2)),
        "Ideal estoque": Math.ceil(x.ideal),
        "Sugestão compra": getQtd(x.perfume.id, x.sugestao),
        "Custo unitário": Number((x.perfume.custoMedio || x.perfume.custo || 0).toFixed(2)),
        "Custo total": Number((getQtd(x.perfume.id, x.sugestao) * (x.perfume.custoMedio || x.perfume.custo || 0)).toFixed(2)),
      })),
      "sugestao_compra",
    );

  const gerarPedido = () => {
    if (!filtradas.length) {
      toast.error("Sem itens para gerar pedido");
      return;
    }
    exportar();
    toast.success(`Pedido com ${filtradas.length} produtos gerado em Excel`);
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-card border-border">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
          <FilterField label="Dias de cobertura desejada">
            <Input
              type="number"
              min="1"
              value={diasReposicao}
              onChange={(e) => setDiasReposicao(Math.max(1, parseInt(e.target.value) || 15))}
              className="bg-surface"
            />
          </FilterField>
          <FilterField label="Prioridade">
            <Select value={filtroPrior} onValueChange={(v: any) => setFiltroPrior(v)}>
              <SelectTrigger className="bg-surface"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="urgente">🔴 Urgente</SelectItem>
                <SelectItem value="moderado">🟡 Moderado</SelectItem>
                <SelectItem value="baixo">🟢 Baixo</SelectItem>
              </SelectContent>
            </Select>
          </FilterField>
          <div className="md:col-span-2 flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={exportar} className="gap-2"><Download size={14} />Excel</Button>
            <Button size="sm" onClick={gerarPedido} className="gap-2 btn-primary">
              <ShoppingBag size={14} />Gerar pedido de compra
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4 bg-card border-border">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Itens sugeridos</p>
          <p className="text-2xl font-display font-semibold text-foreground">{filtradas.length}</p>
        </Card>
        <Card className="p-4 bg-card border-border">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Unidades</p>
          <p className="text-2xl font-display font-semibold text-gold">{totalUnidades}</p>
        </Card>
        <Card className="p-4 bg-card border-border">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Investimento estimado</p>
          <p className="text-2xl font-display font-semibold text-success">{fmtBRL(totalCusto)}</p>
        </Card>
      </div>

      {filtradas.length === 0 ? (
        <Card className="p-8 text-center bg-card border-border">
          <p className="text-sm text-muted-foreground">🎉 Nenhuma reposição sugerida — estoque saudável.</p>
        </Card>
      ) : (
        <Card className="bg-card border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-surface border-b border-border">
                <tr>
                  <th className="text-center p-3">Prior.</th>
                  <th className="text-left p-3">Produto</th>
                  <th className="text-right p-3">Estoque</th>
                  <th className="text-right p-3">Média/dia</th>
                  <th className="text-right p-3">Ideal</th>
                  <th className="text-right p-3">Sugestão</th>
                  <th className="text-right p-3">Custo total</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.slice(0, 200).map((x) => {
                  const qtd = getQtd(x.perfume.id, x.sugestao);
                  const custoUn = x.perfume.custoMedio || x.perfume.custo || 0;
                  return (
                    <tr key={x.perfume.id} className="border-b border-border/50 hover:bg-surface/50">
                      <td className="text-center p-3"><PrioBadge prio={x.prioridade} /></td>
                      <td className="p-3">
                        <p className="font-medium text-foreground">{x.perfume.nome}</p>
                        <p className="text-[10px] text-muted-foreground">{x.perfume.marca} · {x.perfume.codigo}</p>
                      </td>
                      <td className="text-right p-3">{x.estoqueAtual}</td>
                      <td className="text-right p-3">{x.mediaDiaria.toFixed(2)}</td>
                      <td className="text-right p-3 text-muted-foreground">{Math.ceil(x.ideal)}</td>
                      <td className="text-right p-3">
                        <Input
                          type="number"
                          min="0"
                          value={qtd}
                          onChange={(e) => setAjustes({ ...ajustes, [x.perfume.id]: Math.max(0, parseInt(e.target.value) || 0) })}
                          className="bg-surface w-20 ml-auto text-right"
                        />
                      </td>
                      <td className="text-right p-3 font-semibold text-gold">{fmtBRL(qtd * custoUn)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function PrioBadge({ prio }: { prio: "urgente" | "moderado" | "baixo" }) {
  const map = {
    urgente: { label: "🔴 Urgente", cls: "bg-destructive/15 text-destructive border-destructive/30" },
    moderado: { label: "🟡 Moderado", cls: "bg-warning/15 text-warning border-warning/30" },
    baixo: { label: "🟢 Baixo", cls: "bg-success/15 text-success border-success/30" },
  };
  const m = map[prio];
  return <Badge variant="outline" className={`${m.cls} text-[10px]`}>{m.label}</Badge>;
}
