import { useMemo, useState } from "react";
import { useVendas } from "@/hooks/useVendas";
import { usePerfumes } from "@/hooks/usePerfumes";
import { useCasas } from "@/hooks/useCasas";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  CalendarIcon,
  Download,
  FileText,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingBag,
  Percent,
  Target,
  Package,
  X,
  Search,
  Sparkles,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { format, subDays, startOfMonth, endOfMonth, subMonths, differenceInDays, parseISO, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { getHojeManaus } from "@/lib/dateUtils";

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;

type Preset = "hoje" | "ontem" | "7d" | "30d" | "mes" | "mes-passado" | "custom";

const PRESETS: { id: Preset; label: string }[] = [
  { id: "hoje", label: "Hoje" },
  { id: "ontem", label: "Ontem" },
  { id: "7d", label: "Últimos 7 dias" },
  { id: "30d", label: "Últimos 30 dias" },
  { id: "mes", label: "Este mês" },
  { id: "mes-passado", label: "Mês passado" },
  { id: "custom", label: "Personalizado" },
];

const COLORS = [
  "hsl(43 74% 49%)",
  "hsl(220 70% 55%)",
  "hsl(160 60% 45%)",
  "hsl(340 70% 55%)",
  "hsl(280 60% 55%)",
  "hsl(20 80% 55%)",
  "hsl(195 70% 50%)",
  "hsl(0 70% 55%)",
];

function getPresetRange(preset: Preset): { from: string; to: string } {
  const hoje = getHojeManaus();
  const today = parseISO(hoje);
  const fmt = (d: Date) => format(d, "yyyy-MM-dd");
  switch (preset) {
    case "hoje":
      return { from: hoje, to: hoje };
    case "ontem": {
      const y = fmt(subDays(today, 1));
      return { from: y, to: y };
    }
    case "7d":
      return { from: fmt(subDays(today, 6)), to: hoje };
    case "30d":
      return { from: fmt(subDays(today, 29)), to: hoje };
    case "mes":
      return { from: fmt(startOfMonth(today)), to: hoje };
    case "mes-passado": {
      const lm = subMonths(today, 1);
      return { from: fmt(startOfMonth(lm)), to: fmt(endOfMonth(lm)) };
    }
    default:
      return { from: hoje, to: hoje };
  }
}

export default function RelatoriosInteligentes() {
  const { vendas, isLoading: loadingV } = useVendas();
  const { perfumes, isLoading: loadingP } = usePerfumes();
  const { casas } = useCasas();

  const [preset, setPreset] = useState<Preset>("30d");
  const [customRange, setCustomRange] = useState<{ from: string; to: string }>(getPresetRange("30d"));
  const [pickerRange, setPickerRange] = useState<{ from?: Date; to?: Date }>({
    from: parseISO(getPresetRange("30d").from),
    to: parseISO(getPresetRange("30d").to),
  });
  const [marcas, setMarcas] = useState<string[]>([]);
  const [depositos, setDepositos] = useState<string[]>([]);
  const [tipos, setTipos] = useState<string[]>([]);
  const [produtosIds, setProdutosIds] = useState<string[]>([]);
  const [produtoSearch, setProdutoSearch] = useState("");
  const [produtoOpen, setProdutoOpen] = useState(false);
  const [somenteSemVenda, setSomenteSemVenda] = useState(false);
  const [somenteEstoqueBaixo, setSomenteEstoqueBaixo] = useState(false);

  const range = preset === "custom" ? customRange : getPresetRange(preset);
  const dias = Math.max(1, differenceInDays(parseISO(range.to), parseISO(range.from)) + 1);

  // Período anterior (mesmo tamanho)
  const prevRange = useMemo(() => {
    const fromD = parseISO(range.from);
    const prevTo = format(subDays(fromD, 1), "yyyy-MM-dd");
    const prevFrom = format(subDays(fromD, dias), "yyyy-MM-dd");
    return { from: prevFrom, to: prevTo };
  }, [range.from, dias]);

  const perfumeMap = useMemo(() => new Map(perfumes.map((p) => [p.id, p])), [perfumes]);

  const marcasUnicas = useMemo(() => Array.from(new Set(perfumes.map((p) => p.marca))).sort(), [perfumes]);
  const tiposUnicos = useMemo(() => Array.from(new Set(perfumes.map((p) => p.tipo))).sort(), [perfumes]);
  const depositosUnicos = useMemo(() => casas.map((c) => c.sigla), [casas]);

  // Produtos filtrados pelos filtros gerais (para a busca de produtos)
  const produtosFiltrados = useMemo(() => {
    return perfumes.filter((p) => {
      if (marcas.length && !marcas.includes(p.marca)) return false;
      if (tipos.length && !tipos.includes(p.tipo)) return false;
      if (somenteEstoqueBaixo) {
        const total = (p.estoques.Casa || 0) + (p.estoques.Sumaúma || 0) + (p.estoques.Amazonas || 0);
        if (total > p.estoqueMinimo) return false;
      }
      const q = produtoSearch.toLowerCase();
      if (q && !`${p.codigo} ${p.marca} ${p.nome}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [perfumes, marcas, tipos, somenteEstoqueBaixo, produtoSearch]);

  // Vendas do período principal
  const vendasPeriodo = useMemo(() => {
    return vendas.filter((v) => {
      if (v.data < range.from || v.data > range.to) return false;
      if (depositos.length && !depositos.includes(v.deposito)) return false;
      if (produtosIds.length && !produtosIds.includes(v.perfumeId)) return false;
      const p = perfumeMap.get(v.perfumeId);
      if (marcas.length && (!p || !marcas.includes(p.marca))) return false;
      if (tipos.length && (!p || !tipos.includes(p.tipo))) return false;
      return true;
    });
  }, [vendas, range, depositos, produtosIds, marcas, tipos, perfumeMap]);

  const vendasAnterior = useMemo(() => {
    return vendas.filter((v) => {
      if (v.data < prevRange.from || v.data > prevRange.to) return false;
      if (depositos.length && !depositos.includes(v.deposito)) return false;
      if (produtosIds.length && !produtosIds.includes(v.perfumeId)) return false;
      const p = perfumeMap.get(v.perfumeId);
      if (marcas.length && (!p || !marcas.includes(p.marca))) return false;
      if (tipos.length && (!p || !tipos.includes(p.tipo))) return false;
      return true;
    });
  }, [vendas, prevRange, depositos, produtosIds, marcas, tipos, perfumeMap]);

  // KPIs
  const kpis = useMemo(() => {
    const faturamento = vendasPeriodo.reduce((s, v) => s + v.total, 0);
    const descontos = vendasPeriodo.reduce((s, v) => s + (v.desconto || 0), 0);
    const cmv = vendasPeriodo.reduce((s, v) => {
      const p = perfumeMap.get(v.perfumeId);
      const custo = p?.custoMedio || p?.custo || 0;
      return s + custo * v.quantidade;
    }, 0);
    const lucro = faturamento - cmv;
    const margem = faturamento > 0 ? lucro / faturamento : 0;
    const pedidos = new Set(vendasPeriodo.map((v) => v.grupoVenda || v.id)).size;
    const ticketMedio = pedidos > 0 ? faturamento / pedidos : 0;
    const qtdItens = vendasPeriodo.reduce((s, v) => s + v.quantidade, 0);
    const mediaDiaria = faturamento / dias;

    const fatAnterior = vendasAnterior.reduce((s, v) => s + v.total, 0);
    const variacao = fatAnterior > 0 ? (faturamento - fatAnterior) / fatAnterior : 0;

    return { faturamento, descontos, cmv, lucro, margem, pedidos, ticketMedio, qtdItens, mediaDiaria, fatAnterior, variacao };
  }, [vendasPeriodo, vendasAnterior, perfumeMap, dias]);

  // Evolução diária
  const evolucao = useMemo(() => {
    const dataMap = new Map<string, { data: string; faturamento: number; lucro: number; pedidos: Set<string> }>();
    eachDayOfInterval({ start: parseISO(range.from), end: parseISO(range.to) }).forEach((d) => {
      const key = format(d, "yyyy-MM-dd");
      dataMap.set(key, { data: key, faturamento: 0, lucro: 0, pedidos: new Set() });
    });
    vendasPeriodo.forEach((v) => {
      const slot = dataMap.get(v.data);
      if (!slot) return;
      slot.faturamento += v.total;
      const p = perfumeMap.get(v.perfumeId);
      const custo = p?.custoMedio || p?.custo || 0;
      slot.lucro += v.total - custo * v.quantidade;
      slot.pedidos.add(v.grupoVenda || v.id);
    });
    return Array.from(dataMap.values()).map((s) => ({
      data: format(parseISO(s.data), "dd/MM"),
      faturamento: Number(s.faturamento.toFixed(2)),
      lucro: Number(s.lucro.toFixed(2)),
      pedidos: s.pedidos.size,
    }));
  }, [vendasPeriodo, range, perfumeMap]);

  // Rankings
  const ranking = useMemo(() => {
    const map = new Map<string, { id: string; nome: string; marca: string; qtd: number; faturamento: number; desconto: number; cmv: number }>();
    vendasPeriodo.forEach((v) => {
      const p = perfumeMap.get(v.perfumeId);
      const cur = map.get(v.perfumeId) || {
        id: v.perfumeId,
        nome: p ? `${p.codigo} - ${p.marca} - ${p.nome}` : v.perfumeNome,
        marca: p?.marca || "—",
        qtd: 0,
        faturamento: 0,
        desconto: 0,
        cmv: 0,
      };
      cur.qtd += v.quantidade;
      cur.faturamento += v.total;
      cur.desconto += v.desconto || 0;
      const custo = p?.custoMedio || p?.custo || 0;
      cur.cmv += custo * v.quantidade;
      map.set(v.perfumeId, cur);
    });
    const arr = Array.from(map.values()).map((r) => ({
      ...r,
      lucro: r.faturamento - r.cmv,
      margem: r.faturamento > 0 ? (r.faturamento - r.cmv) / r.faturamento : 0,
    }));
    return arr;
  }, [vendasPeriodo, perfumeMap]);

  const topQtd = useMemo(() => [...ranking].sort((a, b) => b.qtd - a.qtd).slice(0, 10), [ranking]);
  const topFat = useMemo(() => [...ranking].sort((a, b) => b.faturamento - a.faturamento).slice(0, 10), [ranking]);
  const topLucro = useMemo(() => [...ranking].sort((a, b) => b.lucro - a.lucro).slice(0, 10), [ranking]);
  const topDesc = useMemo(() => [...ranking].sort((a, b) => b.desconto - a.desconto).slice(0, 10), [ranking]);
  const parados = useMemo(() => {
    const vendidos = new Set(ranking.map((r) => r.id));
    return produtosFiltrados.filter((p) => !vendidos.has(p.id)).slice(0, 30);
  }, [ranking, produtosFiltrados]);

  // Por marca (pizza)
  const porMarca = useMemo(() => {
    const map = new Map<string, number>();
    ranking.forEach((r) => map.set(r.marca, (map.get(r.marca) || 0) + r.faturamento));
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [ranking]);

  // Por loja
  const porLoja = useMemo(() => {
    const map = new Map<string, number>();
    vendasPeriodo.forEach((v) => map.set(v.deposito, (map.get(v.deposito) || 0) + v.total));
    return Array.from(map.entries()).map(([name, faturamento]) => ({ name, faturamento: Number(faturamento.toFixed(2)) }));
  }, [vendasPeriodo]);

  // Exportar
  const exportarExcel = () => {
    const wb = XLSX.utils.book_new();
    const resumo = [
      ["Período", `${range.from} a ${range.to}`],
      ["Faturamento", kpis.faturamento],
      ["Descontos", kpis.descontos],
      ["CMV", kpis.cmv],
      ["Lucro Bruto", kpis.lucro],
      ["Margem", fmtPct(kpis.margem)],
      ["Pedidos", kpis.pedidos],
      ["Ticket Médio", kpis.ticketMedio],
      ["Itens Vendidos", kpis.qtdItens],
      ["Média Diária", kpis.mediaDiaria],
      ["Variação vs período anterior", fmtPct(kpis.variacao)],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumo), "Resumo");
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        ranking.map((r) => ({
          Produto: r.nome,
          Marca: r.marca,
          Quantidade: r.qtd,
          Faturamento: r.faturamento,
          Desconto: r.desconto,
          CMV: r.cmv,
          Lucro: r.lucro,
          Margem: fmtPct(r.margem),
        })),
      ),
      "Produtos",
    );
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(evolucao), "Evolução");
    XLSX.writeFile(wb, `relatorio_${range.from}_${range.to}.xlsx`);
    toast.success("Excel exportado");
  };

  const exportarPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Relatório Inteligente — Le Jess", 14, 18);
    doc.setFontSize(10);
    doc.text(`Período: ${range.from} a ${range.to} (${dias} dias)`, 14, 25);

    autoTable(doc, {
      startY: 32,
      head: [["Indicador", "Valor"]],
      body: [
        ["Faturamento", fmtBRL(kpis.faturamento)],
        ["Descontos", fmtBRL(kpis.descontos)],
        ["CMV", fmtBRL(kpis.cmv)],
        ["Lucro Bruto", fmtBRL(kpis.lucro)],
        ["Margem", fmtPct(kpis.margem)],
        ["Pedidos", String(kpis.pedidos)],
        ["Ticket Médio", fmtBRL(kpis.ticketMedio)],
        ["Itens Vendidos", String(kpis.qtdItens)],
        ["Média Diária", fmtBRL(kpis.mediaDiaria)],
        ["vs Período Anterior", fmtPct(kpis.variacao)],
      ],
    });

    autoTable(doc, {
      head: [["Top 10 — Mais Vendidos", "Qtd", "Faturamento", "Lucro"]],
      body: topQtd.map((r) => [r.nome, r.qtd, fmtBRL(r.faturamento), fmtBRL(r.lucro)]),
    });

    doc.save(`relatorio_${range.from}_${range.to}.pdf`);
    toast.success("PDF exportado");
  };

  const limparFiltros = () => {
    setMarcas([]);
    setDepositos([]);
    setTipos([]);
    setProdutosIds([]);
    setSomenteSemVenda(false);
    setSomenteEstoqueBaixo(false);
  };

  if (loadingV || loadingP) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 md:pb-8 md:pl-60">
      <div className="px-4 md:px-8 pt-4 md:pt-8 max-w-[1600px] mx-auto space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold flex items-center gap-2">
              <Sparkles className="text-gold" size={26} />
              Relatórios Inteligentes
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Análise completa de vendas, lucro e desempenho — {range.from} a {range.to}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportarExcel}>
              <Download size={16} className="mr-2" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={exportarPDF}>
              <FileText size={16} className="mr-2" /> PDF
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <Card className="p-4 space-y-4">
          {/* Presets período */}
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPreset(p.id)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                  preset === p.id
                    ? "bg-gold/15 text-gold border border-gold/40"
                    : "bg-surface-raised text-muted-foreground border border-transparent hover:text-foreground"
                }`}
              >
                {p.label}
              </button>
            ))}
            {preset === "custom" && (
              <div className="flex gap-2 items-center">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                      <CalendarIcon size={14} className="mr-2" />
                      {format(parseISO(customRange.from), "dd/MM/yy")} →{" "}
                      {format(parseISO(customRange.to), "dd/MM/yy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="range"
                      selected={pickerRange as any}
                      onSelect={(r: any) => {
                        setPickerRange(r || {});
                        if (r?.from && r?.to) {
                          setCustomRange({
                            from: format(r.from, "yyyy-MM-dd"),
                            to: format(r.to, "yyyy-MM-dd"),
                          });
                        }
                      }}
                      numberOfMonths={2}
                      defaultMonth={pickerRange.from}
                      locale={ptBR}
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>

          {/* Filtros multi-pill */}
          <div className="grid md:grid-cols-3 gap-3">
            <FilterMulti label="Marcas" options={marcasUnicas} selected={marcas} onChange={setMarcas} />
            <FilterMulti label="Lojas / Depósitos" options={depositosUnicos} selected={depositos} onChange={setDepositos} />
            <FilterMulti label="Tipos" options={tiposUnicos} selected={tipos} onChange={setTipos} />
          </div>

          {/* Seleção de produtos */}
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">
              Selecione os produtos para visualizar as vendas no período
            </label>
            <Popover open={produtoOpen} onOpenChange={setProdutoOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start font-normal">
                  <Search size={14} className="mr-2" />
                  {produtosIds.length === 0
                    ? "Todos os produtos (busque por nome ou código)"
                    : `${produtosIds.length} produto(s) selecionado(s)`}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[min(600px,90vw)] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput placeholder="Buscar por código, marca ou nome..." value={produtoSearch} onValueChange={setProdutoSearch} />
                  <div className="flex gap-2 p-2 border-b">
                    <Button size="sm" variant="ghost" onClick={() => setProdutosIds(produtosFiltrados.map((p) => p.id))}>
                      Selecionar todos
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setProdutosIds([])}>
                      Limpar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const ids = topQtd.map((r) => r.id);
                        setProdutosIds(ids);
                        setProdutoOpen(false);
                      }}
                    >
                      Mais vendidos
                    </Button>
                  </div>
                  <CommandList className="max-h-[320px]">
                    <CommandEmpty>Nenhum produto.</CommandEmpty>
                    <CommandGroup>
                      {produtosFiltrados.slice(0, 200).map((p) => {
                        const checked = produtosIds.includes(p.id);
                        return (
                          <CommandItem
                            key={p.id}
                            onSelect={() => {
                              setProdutosIds((cur) =>
                                checked ? cur.filter((x) => x !== p.id) : [...cur, p.id],
                              );
                            }}
                          >
                            <input type="checkbox" checked={checked} readOnly className="mr-2 accent-gold" />
                            <span className="text-sm">
                              {p.codigo} — {p.marca} — {p.nome}
                            </span>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {produtosIds.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {produtosIds.slice(0, 8).map((id) => {
                  const p = perfumeMap.get(id);
                  return (
                    <Badge key={id} variant="outline" className="gap-1">
                      {p ? `${p.codigo}` : id.slice(0, 6)}
                      <button onClick={() => setProdutosIds((cur) => cur.filter((x) => x !== id))}>
                        <X size={10} />
                      </button>
                    </Badge>
                  );
                })}
                {produtosIds.length > 8 && <Badge variant="outline">+{produtosIds.length - 8}</Badge>}
              </div>
            )}
          </div>

          {/* Toggles extra */}
          <div className="flex flex-wrap gap-3 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={somenteEstoqueBaixo} onChange={(e) => setSomenteEstoqueBaixo(e.target.checked)} className="accent-gold" />
              Somente estoque baixo
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={somenteSemVenda} onChange={(e) => setSomenteSemVenda(e.target.checked)} className="accent-gold" />
              Somente sem venda no período
            </label>
            <Button variant="ghost" size="sm" onClick={limparFiltros} className="ml-auto">
              <X size={14} className="mr-1" /> Limpar filtros
            </Button>
          </div>
        </Card>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard icon={DollarSign} label="Faturamento" value={fmtBRL(kpis.faturamento)} delta={kpis.variacao} />
          <KpiCard icon={Target} label="Lucro Bruto" value={fmtBRL(kpis.lucro)} sub={`Margem ${fmtPct(kpis.margem)}`} />
          <KpiCard icon={Percent} label="Descontos" value={fmtBRL(kpis.descontos)} />
          <KpiCard icon={ShoppingBag} label="Pedidos" value={String(kpis.pedidos)} sub={`Ticket ${fmtBRL(kpis.ticketMedio)}`} />
          <KpiCard icon={Package} label="Itens Vendidos" value={String(kpis.qtdItens)} />
          <KpiCard icon={TrendingUp} label="Média Diária" value={fmtBRL(kpis.mediaDiaria)} sub={`${dias} dias`} />
          <KpiCard icon={DollarSign} label="CMV" value={fmtBRL(kpis.cmv)} />
          <KpiCard icon={TrendingDown} label="Período Anterior" value={fmtBRL(kpis.fatAnterior)} sub={`${prevRange.from} a ${prevRange.to}`} />
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-3 gap-3">
          <Card className="p-4 lg:col-span-2">
            <h3 className="font-medium mb-3">Evolução de Vendas</h3>
            <div className="h-72">
              <ResponsiveContainer>
                <LineChart data={evolucao}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="data" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: any) => fmtBRL(Number(v))} />
                  <Legend />
                  <Line type="monotone" dataKey="faturamento" stroke="hsl(43 74% 49%)" strokeWidth={2} name="Faturamento" />
                  <Line type="monotone" dataKey="lucro" stroke="hsl(160 60% 45%)" strokeWidth={2} name="Lucro" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card className="p-4">
            <h3 className="font-medium mb-3">Faturamento por Marca</h3>
            <div className="h-72">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={porMarca} dataKey="value" nameKey="name" outerRadius={90} label={(e: any) => e.name}>
                    {porMarca.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => fmtBRL(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {porLoja.length > 0 && (
          <Card className="p-4">
            <h3 className="font-medium mb-3">Comparativo entre Lojas</h3>
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={porLoja}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: any) => fmtBRL(Number(v))} />
                  <Bar dataKey="faturamento" fill="hsl(43 74% 49%)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {/* Rankings */}
        <Card className="p-4">
          <Tabs defaultValue="qtd">
            <TabsList>
              <TabsTrigger value="qtd">Mais vendidos</TabsTrigger>
              <TabsTrigger value="fat">Maior faturamento</TabsTrigger>
              <TabsTrigger value="lucro">Mais lucrativos</TabsTrigger>
              <TabsTrigger value="desc">Maior desconto</TabsTrigger>
              <TabsTrigger value="parados">Parados</TabsTrigger>
            </TabsList>
            <TabsContent value="qtd"><RankingTable items={topQtd} sortBy="qtd" /></TabsContent>
            <TabsContent value="fat"><RankingTable items={topFat} sortBy="faturamento" /></TabsContent>
            <TabsContent value="lucro"><RankingTable items={topLucro} sortBy="lucro" /></TabsContent>
            <TabsContent value="desc"><RankingTable items={topDesc} sortBy="desconto" /></TabsContent>
            <TabsContent value="parados">
              {parados.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Nenhum produto parado nesse filtro.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-muted-foreground border-b">
                        <th className="py-2">Produto</th>
                        <th className="py-2">Marca</th>
                        <th className="py-2 text-right">Estoque Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parados.map((p) => {
                        const total = (p.estoques.Casa || 0) + (p.estoques.Sumaúma || 0) + (p.estoques.Amazonas || 0);
                        return (
                          <tr key={p.id} className="border-b border-border/50">
                            <td className="py-2">{p.codigo} — {p.marca} — {p.nome}</td>
                            <td className="py-2">{p.marca}</td>
                            <td className="py-2 text-right">{total}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  delta,
}: {
  icon: any;
  label: string;
  value: string;
  sub?: string;
  delta?: number;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold mt-1">{value}</p>
          {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
          {delta !== undefined && (
            <p className={`text-[11px] mt-0.5 flex items-center gap-1 ${delta >= 0 ? "text-emerald-500" : "text-red-500"}`}>
              {delta >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
              {fmtPct(delta)} vs anterior
            </p>
          )}
        </div>
        <Icon className="text-gold/70" size={18} />
      </div>
    </Card>
  );
}

function FilterMulti({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1.5">{label}</p>
      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
        {options.map((o) => {
          const active = selected.includes(o);
          return (
            <button
              key={o}
              onClick={() => onChange(active ? selected.filter((x) => x !== o) : [...selected, o])}
              className={`px-2.5 py-1 rounded-md text-xs transition-all ${
                active ? "bg-gold/15 text-gold border border-gold/40" : "bg-surface-raised text-muted-foreground border border-transparent"
              }`}
            >
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RankingTable({
  items,
  sortBy,
}: {
  items: { id: string; nome: string; marca: string; qtd: number; faturamento: number; desconto: number; lucro: number; margem: number }[];
  sortBy: "qtd" | "faturamento" | "lucro" | "desconto";
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">Sem dados no período.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted-foreground border-b">
            <th className="py-2 w-8">#</th>
            <th className="py-2">Produto</th>
            <th className="py-2 text-right">Qtd</th>
            <th className="py-2 text-right">Faturamento</th>
            <th className="py-2 text-right">Desconto</th>
            <th className="py-2 text-right">Lucro</th>
            <th className="py-2 text-right">Margem</th>
          </tr>
        </thead>
        <tbody>
          {items.map((r, i) => (
            <tr key={r.id} className="border-b border-border/50">
              <td className="py-2 text-muted-foreground">{i + 1}</td>
              <td className="py-2">{r.nome}</td>
              <td className={`py-2 text-right ${sortBy === "qtd" ? "font-semibold text-gold" : ""}`}>{r.qtd}</td>
              <td className={`py-2 text-right ${sortBy === "faturamento" ? "font-semibold text-gold" : ""}`}>{fmtBRL(r.faturamento)}</td>
              <td className={`py-2 text-right ${sortBy === "desconto" ? "font-semibold text-gold" : ""}`}>{fmtBRL(r.desconto)}</td>
              <td className={`py-2 text-right ${sortBy === "lucro" ? "font-semibold text-gold" : ""}`}>{fmtBRL(r.lucro)}</td>
              <td className="py-2 text-right">{fmtPct(r.margem)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
