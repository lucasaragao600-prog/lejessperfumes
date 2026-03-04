import { useState, useMemo } from "react";
import {
  ShoppingCart, Plus, Calendar, User, Tag, FileText, CreditCard,
  Search, ArrowUpDown, Store, Trash2, X, Package, Minus, Loader2
} from "lucide-react";
import PerfumeSearchSelect from "@/components/PerfumeSearchSelect";
import {
  formatCurrency, formatDate, type Deposito, type Venda,
  type TipoPagamento, type Bandeira, type TipoAjusteValor
} from "@/data/mockData";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import type { VendaPagamento } from "@/hooks/useVendas";
import { getHojeManaus } from "@/lib/dateUtils";

const depositos: Deposito[] = ["Casa", "Sumaúma", "Amazonas"];
const hoje = getHojeManaus();
const vendedorasFixas = ["Outra"];
const tiposPagamento: TipoPagamento[] = ["Dinheiro", "Pix", "Débito", "Crédito", "Conta Assinada"];
const bandeiras: Bandeira[] = ["Visa", "Mastercard", "Elo", "Amex", "Hipercard"];

interface CarrinhoItem {
  perfumeId: string;
  perfumeNome: string;
  marca: string;
  concentracao: string;
  volume: number;
  deposito: Deposito;
  quantidade: number;
  precoUnitario: number;
  tipoAjuste: TipoAjusteValor;
  ajuste: number;
  tipoCalculo: "valor" | "percent";
  total: number;
  observacao: string;
}

interface PagamentoItem {
  tipoPagamento: TipoPagamento;
  bandeira: Bandeira;
  valor: number;
}

export default function Vendas() {
  const {
    vendas, pagamentos, perfumes, baixarEstoque, adicionarEstoque,
    vendedoras: vendedorasCtx, adicionarVendaMulti, excluirVenda,
    concentracoesConfig
  } = useApp();
  const { role, profile } = useAuth();
  const isVendedor = role === "vendedor";
  const isMaster = role === "master";
  const vendedoras = [...vendedorasCtx, ...vendedorasFixas];

  const [filtroData, setFiltroData] = useState("");
  const [filtroDeposito, setFiltroDeposito] = useState<Deposito | "Todos">("Todos");
  const [filtroVendedora, setFiltroVendedora] = useState("Todas");
  const [busca, setBusca] = useState("");
  const [ordenacao, setOrdenacao] = useState<"recente" | "antiga">("recente");
  const [showForm, setShowForm] = useState(false);
  const [dataVenda, setDataVenda] = useState(hoje);
  const [descontarEstoque, setDescontarEstoque] = useState(true);
  const [showRelatorio, setShowRelatorio] = useState(false);
  const [modoRelatorio, setModoRelatorio] = useState<"dia" | "periodo" | "mes">("dia");
  const [dataRelatorio, setDataRelatorio] = useState(hoje);
  const [periodoInicio, setPeriodoInicio] = useState("");
  const [periodoFim, setPeriodoFim] = useState("");
  const [mesRelatorio, setMesRelatorio] = useState("2026-02");
  const [lojaRelatorio, setLojaRelatorio] = useState<Deposito | "Geral">("Geral");
  const [isLancando, setIsLancando] = useState(false);

  // Cart state
  const [carrinho, setCarrinho] = useState<CarrinhoItem[]>([]);
  const [vendedoraSelecionada, setVendedoraSelecionada] = useState("");
  const [pagamentosForm, setPagamentosForm] = useState<PagamentoItem[]>([]);

  // Item being added to cart
  const [itemForm, setItemForm] = useState({
    perfumeId: "",
    deposito: "" as Deposito | "",
    quantidade: 1,
    ajuste: 0,
    tipoAjuste: "desconto" as TipoAjusteValor,
    tipoCalculo: "valor" as "valor" | "percent",
    observacao: "",
  });

  const perfumeSelecionado = perfumes.find((p) => p.id === itemForm.perfumeId);
  const subtotalItem = perfumeSelecionado ? perfumeSelecionado.precoVenda * itemForm.quantidade : 0;
  const ajusteCalcItem = itemForm.tipoCalculo === "percent" ? (subtotalItem * itemForm.ajuste) / 100 : itemForm.ajuste;
  const totalItem = itemForm.tipoAjuste === "desconto" ? Math.max(0, subtotalItem - ajusteCalcItem) : subtotalItem + ajusteCalcItem;

  const totalCarrinho = carrinho.reduce((a, i) => a + i.total, 0);
  const subtotalCarrinho = carrinho.reduce((a, i) => a + i.precoUnitario * i.quantidade, 0);
  const descontoCarrinho = carrinho.filter(i => i.tipoAjuste === "desconto").reduce((a, i) => a + i.ajuste, 0);
  const acrescimoCarrinho = carrinho.filter(i => i.tipoAjuste === "acrescimo").reduce((a, i) => a + i.ajuste, 0);
  const totalPagamentos = pagamentosForm.reduce((a, p) => a + p.valor, 0);
  const restantePagamento = totalCarrinho - totalPagamentos;

  const isRetroativa = isMaster && dataVenda !== hoje;
  const vaiDescontar = !isRetroativa || descontarEstoque;

  const handleAdicionarAoCarrinho = () => {
    if (!itemForm.perfumeId || !itemForm.deposito || itemForm.quantidade < 1) return;
    const p = perfumes.find((x) => x.id === itemForm.perfumeId)!;

    if (vaiDescontar) {
      const estoqueAtual = p.estoques[itemForm.deposito as Deposito];
      const jaNoCarrinho = carrinho.filter(i => i.perfumeId === p.id && i.deposito === itemForm.deposito).reduce((a, i) => a + i.quantidade, 0);
      if (estoqueAtual < itemForm.quantidade + jaNoCarrinho) {
        alert(`Estoque insuficiente em ${itemForm.deposito}. Disponível: ${estoqueAtual - jaNoCarrinho}`);
        return;
      }
    }

    if (itemForm.ajuste > 0 && !itemForm.observacao.trim()) {
      alert("Preencha a observação para justificar o ajuste de valor.");
      return;
    }

    setCarrinho([...carrinho, {
      perfumeId: p.id,
      perfumeNome: p.nome,
      marca: p.marca,
      concentracao: p.concentracao,
      volume: p.volume,
      deposito: itemForm.deposito as Deposito,
      quantidade: itemForm.quantidade,
      precoUnitario: p.precoVenda,
      tipoAjuste: itemForm.tipoAjuste,
      ajuste: ajusteCalcItem,
      tipoCalculo: itemForm.tipoCalculo,
      total: totalItem,
      observacao: itemForm.observacao,
    }]);
    setItemForm({ perfumeId: "", deposito: "", quantidade: 1, ajuste: 0, tipoAjuste: "desconto", tipoCalculo: "valor", observacao: "" });
  };

  const handleRemoverDoCarrinho = (idx: number) => {
    setCarrinho(carrinho.filter((_, i) => i !== idx));
  };

  const handleAdicionarPagamento = () => {
    if (restantePagamento <= 0) return;
    setPagamentosForm([...pagamentosForm, {
      tipoPagamento: "Pix",
      bandeira: "N/A",
      valor: Math.round(restantePagamento * 100) / 100,
    }]);
  };

  const handleRemoverPagamento = (idx: number) => {
    setPagamentosForm(pagamentosForm.filter((_, i) => i !== idx));
  };

  const updatePagamento = (idx: number, updates: Partial<PagamentoItem>) => {
    setPagamentosForm(pagamentosForm.map((p, i) => i === idx ? { ...p, ...updates } : p));
  };

  const handleLancar = async () => {
    if (carrinho.length === 0 || !vendedoraSelecionada || pagamentosForm.length === 0) return;
    const diff = Math.abs(totalPagamentos - totalCarrinho);
    if (diff > 0.01) {
      alert(`O total dos pagamentos (${formatCurrency(totalPagamentos)}) não confere com o total da venda (${formatCurrency(totalCarrinho)}). Diferença: ${formatCurrency(diff)}`);
      return;
    }

    setIsLancando(true);
    try {
      const dataEfetiva = isMaster ? dataVenda : getHojeManaus();
      const itens: Venda[] = carrinho.map((item, idx) => ({
        id: `v${Date.now()}_${idx}`,
        data: dataEfetiva,
        perfumeId: item.perfumeId,
        perfumeNome: item.perfumeNome,
        deposito: item.deposito,
        quantidade: item.quantidade,
        precoUnitario: item.precoUnitario,
        tipoAjuste: item.tipoAjuste,
        desconto: item.ajuste,
        total: item.total,
        vendedora: vendedoraSelecionada,
        tipoPagamento: pagamentosForm[0].tipoPagamento,
        bandeira: pagamentosForm[0].bandeira,
        observacao: item.observacao,
        registradoPor: profile?.nome || "Desconhecido",
      }));

      const pagamentosVenda: Omit<VendaPagamento, "id">[] = pagamentosForm.map((p) => ({
        grupoVenda: "",
        tipoPagamento: p.tipoPagamento,
        bandeira: p.bandeira,
        valor: p.valor,
      }));

      await adicionarVendaMulti({ itens, pagamentosVenda });

      if (vaiDescontar) {
        for (const item of carrinho) {
          baixarEstoque(item.perfumeId, item.deposito, item.quantidade);
        }
      }

      setCarrinho([]);
      setVendedoraSelecionada("");
      setPagamentosForm([]);
      setDataVenda(hoje);
      setDescontarEstoque(true);
      setItemForm({ perfumeId: "", deposito: "", quantidade: 1, ajuste: 0, tipoAjuste: "desconto", tipoCalculo: "valor", observacao: "" });
      setShowForm(false);
    } finally {
      setIsLancando(false);
    }
  };

  const handleExcluirVenda = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta venda? O estoque será devolvido.")) return;
    const venda = vendas.find(v => v.id === id);
    if (venda) {
      await excluirVenda(id);
      // Return stock
      adicionarEstoque(venda.perfumeId, venda.deposito as Deposito, venda.quantidade);
    }
  };

  // Group vendas by grupo_venda for display
  const vendasAgrupadas = useMemo(() => {
    const grupos: Record<string, Venda[]> = {};
    vendas.forEach((v) => {
      const key = v.grupoVenda || v.id;
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(v);
    });
    return grupos;
  }, [vendas]);

  const filtradas = useMemo(() => {
    let result = vendas.filter((v) => {
      const matchData = isVendedor ? v.data === hoje : (filtroData ? v.data === filtroData : true);
      const matchDeposito = filtroDeposito === "Todos" || v.deposito === filtroDeposito;
      const matchVendedora = filtroVendedora === "Todas" || v.vendedora === filtroVendedora;
      const matchBusca = busca.trim() === "" || v.perfumeNome.toLowerCase().includes(busca.toLowerCase()) || v.vendedora.toLowerCase().includes(busca.toLowerCase());
      return matchData && matchDeposito && matchVendedora && matchBusca;
    });
    result = [...result].sort((a, b) =>
      ordenacao === "recente" ? b.data.localeCompare(a.data) : a.data.localeCompare(b.data)
    );
    return result;
  }, [vendas, filtroData, filtroDeposito, filtroVendedora, busca, ordenacao]);

  const filtradasAgrupadas = useMemo(() => {
    const grupos: Record<string, Venda[]> = {};
    const ordem: string[] = [];
    filtradas.forEach((v) => {
      const key = v.grupoVenda || v.id;
      if (!grupos[key]) {
        grupos[key] = [];
        ordem.push(key);
      }
      grupos[key].push(v);
    });
    return ordem.map(key => ({ grupoVenda: key, itens: grupos[key] }));
  }, [filtradas]);

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

  const vendasRelatorio = useMemo(() => {
    const modo = isVendedor ? "dia" : modoRelatorio;
    const dataEfetiva = isVendedor ? hoje : dataRelatorio;
    return vendas.filter((v) => {
      const matchLoja = lojaRelatorio === "Geral" || v.deposito === lojaRelatorio;
      if (!matchLoja) return false;
      if (modo === "dia") return v.data === dataEfetiva;
      if (modo === "mes") return v.data.startsWith(mesRelatorio);
      const ok1 = periodoInicio ? v.data >= periodoInicio : true;
      const ok2 = periodoFim ? v.data <= periodoFim : true;
      return ok1 && ok2;
    });
  }, [vendas, modoRelatorio, dataRelatorio, mesRelatorio, periodoInicio, periodoFim, lojaRelatorio, isVendedor]);

  const vendasPorLoja = useMemo(() => {
    if (lojaRelatorio !== "Geral") return null;
    return depositos.map((dep) => {
      const vLoja = vendasRelatorio.filter((v) => v.deposito === dep);
      return { loja: dep, total: vLoja.reduce((a, v) => a + v.total, 0), qtd: vLoja.length, itens: vLoja.reduce((a, v) => a + v.quantidade, 0) };
    }).filter((l) => l.qtd > 0);
  }, [vendasRelatorio, lojaRelatorio]);

  const relatorio = useMemo(() => {
    const porProduto: Record<string, { nome: string; marca: string; qtd: number; valor: number }> = {};
    const porVendedora: Record<string, { qtd: number; valor: number; transacoes: number }> = {};
    const porPagamento: Record<string, { qtd: number; valor: number }> = {};
    const porBandeira: Record<string, { qtd: number; valor: number }> = {};
    let totalDesconto = 0;
    let totalAcrescimo = 0;

    vendasRelatorio.forEach((v) => {
      const pf = perfumes.find((p) => p.id === v.perfumeId);
      if (!porProduto[v.perfumeId]) porProduto[v.perfumeId] = { nome: v.perfumeNome, marca: pf?.marca ?? "", qtd: 0, valor: 0 };
      porProduto[v.perfumeId].qtd += v.quantidade;
      porProduto[v.perfumeId].valor += v.total;
      if (!porVendedora[v.vendedora]) porVendedora[v.vendedora] = { qtd: 0, valor: 0, transacoes: 0 };
      porVendedora[v.vendedora].qtd += v.quantidade;
      porVendedora[v.vendedora].valor += v.total;
      porVendedora[v.vendedora].transacoes += 1;

      const grupoPags = pagamentos.filter(p => p.grupoVenda === v.grupoVenda);
      if (grupoPags.length > 0) {
        const grupoItens = vendasAgrupadas[v.grupoVenda || v.id] || [v];
        const grupoTotal = grupoItens.reduce((a, i) => a + i.total, 0);
        const proporcao = grupoTotal > 0 ? v.total / grupoTotal : 1;
        grupoPags.forEach(pg => {
          const valorProp = pg.valor * proporcao;
          if (!porPagamento[pg.tipoPagamento]) porPagamento[pg.tipoPagamento] = { qtd: 0, valor: 0 };
          porPagamento[pg.tipoPagamento].valor += valorProp;
          if (pg.bandeira !== "N/A") {
            if (!porBandeira[pg.bandeira]) porBandeira[pg.bandeira] = { qtd: 0, valor: 0 };
            porBandeira[pg.bandeira].valor += valorProp;
          }
        });
      } else {
        if (!porPagamento[v.tipoPagamento]) porPagamento[v.tipoPagamento] = { qtd: 0, valor: 0 };
        porPagamento[v.tipoPagamento].qtd += 1;
        porPagamento[v.tipoPagamento].valor += v.total;
        if (v.bandeira !== "N/A") {
          if (!porBandeira[v.bandeira]) porBandeira[v.bandeira] = { qtd: 0, valor: 0 };
          porBandeira[v.bandeira].qtd += 1;
          porBandeira[v.bandeira].valor += v.total;
        }
      }

      if (v.tipoAjuste === "desconto") totalDesconto += v.desconto;
      else totalAcrescimo += v.desconto;
    });

    Object.values(porPagamento).forEach(p => { if (p.qtd === 0) p.qtd = 1; });
    Object.values(porBandeira).forEach(p => { if (p.qtd === 0) p.qtd = 1; });

    return { porProduto, porVendedora, porPagamento, porBandeira, totalDesconto, totalAcrescimo };
  }, [vendasRelatorio, pagamentos, vendasAgrupadas]);

  const temFiltroAtivo = filtroData || filtroDeposito !== "Todos" || filtroVendedora !== "Todas" || busca.trim() !== "";

  const incrementQty = () => setItemForm(f => ({ ...f, quantidade: f.quantidade + 1 }));
  const decrementQty = () => setItemForm(f => ({ ...f, quantidade: Math.max(1, f.quantidade - 1) }));

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 pt-12 pb-4" style={{ background: "var(--gradient-header)" }}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="page-title">Vendas</h1>
            <p className="page-subtitle mt-1">Hoje: {totalHoje.qtd} vendas · {totalHoje.itens} itens</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowRelatorio(!showRelatorio)} className="btn-secondary px-3 py-2 text-xs">
              <FileText size={14} /> Relatório
            </button>
            <button onClick={() => {
              setShowForm(!showForm);
              if (!showForm) { setCarrinho([]); setPagamentosForm([]); setVendedoraSelecionada(""); setDataVenda(hoje); setDescontarEstoque(true); }
            }} className="btn-primary px-4 py-2">
              <Plus size={16} /> Lançar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="kpi-card p-4" style={{ borderColor: "hsl(var(--gold-muted))" }}>
            <p className="text-[10px] text-muted-foreground mb-1.5">{isVendedor ? "Vendas hoje" : "Faturado hoje"}</p>
            <p className="text-lg font-bold text-gold">{isVendedor ? `${totalHoje.qtd} vendas` : formatCurrency(totalHoje.valor)}</p>
          </div>
          <div className="kpi-card p-4">
            <p className="text-[10px] text-muted-foreground mb-1.5">Itens vendidos</p>
            <p className="text-lg font-bold text-foreground">{totalHoje.itens} unid.</p>
          </div>
        </div>

        {!showForm && (
          <>
            <div className="relative mb-3">
              <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="text" value={busca} onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por perfume ou vendedora..."
                className="input-premium pl-9 pr-3 py-2.5 text-xs" />
            </div>

            <div className="space-y-2 mb-1">
              <div className="grid grid-cols-2 gap-2">
                {!isVendedor ? (
                  <div className="relative">
                    <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input type="date" value={filtroData} onChange={(e) => setFiltroData(e.target.value)}
                      className="input-premium pl-9 pr-2 py-2.5 text-xs [color-scheme:dark]" />
                  </div>
                ) : (
                  <div className="flex items-center justify-center kpi-card px-3 py-2.5 text-xs text-muted-foreground">
                    <Calendar size={13} className="mr-1.5" /> Hoje
                  </div>
                )}
                <select value={filtroDeposito} onChange={(e) => setFiltroDeposito(e.target.value as Deposito | "Todos")}
                  className="input-premium px-3 py-2.5 text-xs">
                  <option value="Todos">Depósito</option>
                  {depositos.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select value={filtroVendedora} onChange={(e) => setFiltroVendedora(e.target.value)}
                  className="input-premium px-3 py-2.5 text-xs">
                  <option value="Todas">Vendedora</option>
                  {vendedoras.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
                <button onClick={() => setOrdenacao(o => o === "recente" ? "antiga" : "recente")}
                  className={`btn-secondary px-2.5 py-2.5 text-xs ${ordenacao === "antiga" ? "!border-gold-muted text-gold" : ""}`}>
                  <ArrowUpDown size={13} /> {ordenacao === "recente" ? "Recente" : "Antiga"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Relatório */}
      {showRelatorio && (
        <div className="mx-4 mb-5 card-premium p-5 animate-fade-in space-y-5">
          <div>
            <h3 className="font-display text-lg text-foreground flex items-center gap-2 mb-4">
              <FileText size={16} className="text-gold" />
              Relatório de Vendas
            </h3>
            <div className="mb-3">
              <p className="text-[10px] text-muted-foreground mb-1.5 flex items-center gap-1"><Store size={10} />Loja</p>
              <div className="flex gap-1.5 flex-wrap">
                {(["Geral", ...depositos] as const).map((loja) => (
                  <button key={loja} onClick={() => setLojaRelatorio(loja as Deposito | "Geral")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all duration-150 ${lojaRelatorio === loja ? "bg-primary/15 text-gold border-gold-muted" : "bg-surface-overlay border-border text-muted-foreground"}`}>
                    {loja}
                  </button>
                ))}
              </div>
            </div>
            {!isVendedor && (
              <div className="flex gap-1.5 mb-3">
                {(["dia", "mes", "periodo"] as const).map((m) => (
                  <button key={m} onClick={() => setModoRelatorio(m)}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-medium border transition-all duration-150 ${modoRelatorio === m ? "bg-primary/15 text-gold border-gold-muted" : "bg-surface-overlay border-border text-muted-foreground"}`}>
                    {m === "dia" ? "Dia" : m === "mes" ? "Mês" : "Período"}
                  </button>
                ))}
              </div>
            )}
            {(isVendedor || modoRelatorio === "dia") && (
              <div>
                {isVendedor ? (
                  <div className="flex gap-1.5 mb-3">
                    <div className="flex-1 py-1.5 rounded-xl text-xs font-medium border bg-primary/15 text-gold border-gold-muted text-center">Hoje</div>
                  </div>
                ) : (
                  <input type="date" value={dataRelatorio} onChange={(e) => setDataRelatorio(e.target.value)}
                    className="w-full bg-surface-overlay border border-border rounded-xl px-3 py-2.5 text-xs text-foreground focus:outline-none [color-scheme:dark]" />
                )}
              </div>
            )}
            {!isVendedor && modoRelatorio === "mes" && (
              <input type="month" value={mesRelatorio} onChange={(e) => setMesRelatorio(e.target.value)}
                className="w-full bg-surface-overlay border border-border rounded-xl px-3 py-2.5 text-xs text-foreground focus:outline-none [color-scheme:dark]" />
            )}
            {!isVendedor && modoRelatorio === "periodo" && (
              <div className="flex gap-2 items-center">
                <input type="date" value={periodoInicio} onChange={(e) => setPeriodoInicio(e.target.value)}
                  className="flex-1 bg-surface-overlay border border-border rounded-xl px-2 py-2.5 text-xs text-foreground focus:outline-none [color-scheme:dark]" />
                <span className="text-muted-foreground text-xs">até</span>
                <input type="date" value={periodoFim} onChange={(e) => setPeriodoFim(e.target.value)}
                  className="flex-1 bg-surface-overlay border border-border rounded-xl px-2 py-2.5 text-xs text-foreground focus:outline-none [color-scheme:dark]" />
              </div>
            )}
          </div>

          {vendasRelatorio.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Sem vendas no período selecionado</p>
          ) : (
            <>
              {lojaRelatorio === "Geral" && vendasPorLoja && vendasPorLoja.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-foreground mb-2 flex items-center gap-1"><Store size={11} /> Por Loja</p>
                  <div className="space-y-1.5">
                    {vendasPorLoja.map((loja) => (
                      <div key={loja.loja} className="flex justify-between items-center bg-surface-overlay rounded-xl px-3 py-2.5">
                        <div>
                          <p className="text-xs font-medium text-foreground">{loja.loja}</p>
                          <p className="text-[10px] text-muted-foreground">{loja.qtd} vendas · {loja.itens} un.</p>
                        </div>
                        {!isVendedor && <p className="text-xs font-bold text-gold">{formatCurrency(loja.total)}</p>}
                      </div>
                    ))}
                    {!isVendedor && (
                      <div className="flex justify-between items-center bg-primary/10 border border-gold-muted rounded-xl px-3 py-2.5">
                        <p className="text-xs font-bold text-gold">Total Geral</p>
                        <p className="text-xs font-bold text-gold">{formatCurrency(vendasRelatorio.reduce((a, v) => a + v.total, 0))}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {!isVendedor && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-surface-overlay rounded-xl p-3 text-center">
                    <p className="text-[9px] text-muted-foreground">Total</p>
                    <p className="text-xs font-bold text-gold">{formatCurrency(vendasRelatorio.reduce((a, v) => a + v.total, 0))}</p>
                  </div>
                  <div className="bg-surface-overlay rounded-xl p-3 text-center">
                    <p className="text-[9px] text-muted-foreground">Descontos</p>
                    <p className="text-xs font-bold text-destructive">-{formatCurrency(relatorio.totalDesconto)}</p>
                  </div>
                  <div className="bg-surface-overlay rounded-xl p-3 text-center">
                    <p className="text-[9px] text-muted-foreground">Acréscimos</p>
                    <p className="text-xs font-bold text-emerald-400">+{formatCurrency(relatorio.totalAcrescimo)}</p>
                  </div>
                </div>
              )}
              <div>
                <p className="text-[11px] font-semibold text-foreground mb-2">Produtos Vendidos</p>
                <div className="space-y-1.5">
                  {Object.values(relatorio.porProduto).sort((a, b) => b.qtd - a.qtd).map((item) => (
                    <div key={item.nome} className="flex justify-between items-center bg-surface-overlay rounded-xl px-3 py-2">
                      <div className="flex-1 min-w-0 mr-2">
                        <p className="text-xs text-foreground truncate">{item.nome}</p>
                        {item.marca && <p className="text-[10px] text-muted-foreground">{item.marca}</p>}
                      </div>
                      <div className="flex gap-3 flex-shrink-0">
                        <span className="text-[11px] text-muted-foreground">{item.qtd} un.</span>
                        {!isVendedor && <span className="text-[11px] font-semibold text-gold">{formatCurrency(item.valor)}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-foreground mb-2 flex items-center gap-1"><User size={11} /> Por Vendedora</p>
                <div className="space-y-1.5">
                  {Object.entries(relatorio.porVendedora).sort(([, a], [, b]) => b.valor - a.valor).map(([nome, dados]) => (
                    <div key={nome} className="bg-surface-overlay rounded-xl px-3 py-2.5">
                      <div className="flex justify-between items-center">
                        <p className="text-xs font-medium text-foreground">{nome}</p>
                        {!isVendedor && <span className="text-[11px] font-semibold text-gold">{formatCurrency(dados.valor)}</span>}
                      </div>
                      <div className="flex gap-3 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">{dados.qtd} un.</span>
                        {!isVendedor && (
                          <>
                            <span className="text-[10px] text-muted-foreground">·</span>
                            <span className="text-[10px] text-muted-foreground">Ticket médio: {formatCurrency(dados.transacoes > 0 ? dados.valor / dados.transacoes : 0)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-foreground mb-2 flex items-center gap-1"><CreditCard size={11} /> Por Pagamento</p>
                <div className="space-y-1.5">
                  {Object.entries(relatorio.porPagamento).map(([tipo, dados]) => (
                    <div key={tipo} className="flex justify-between items-center bg-surface-overlay rounded-xl px-3 py-2">
                      <p className="text-xs text-foreground">{tipo}</p>
                      <div className="flex gap-3">
                        <span className="text-[11px] text-muted-foreground">{dados.qtd} venda(s)</span>
                        {!isVendedor && <span className="text-[11px] font-semibold text-gold">{formatCurrency(dados.valor)}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {Object.keys(relatorio.porBandeira).length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-foreground mb-2">Por Bandeira</p>
                  <div className="space-y-1.5">
                    {Object.entries(relatorio.porBandeira).map(([band, dados]) => (
                      <div key={band} className="flex justify-between items-center bg-surface-overlay rounded-xl px-3 py-2">
                        <p className="text-xs text-foreground">{band}</p>
                        <div className="flex gap-3">
                          <span className="text-[11px] text-muted-foreground">{dados.qtd} venda(s)</span>
                          {!isVendedor && <span className="text-[11px] font-semibold text-gold">{formatCurrency(dados.valor)}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ═══════════ NOVA VENDA — Premium POS ═══════════ */}
      {showForm && (
        <div className="mx-4 mb-5 animate-fade-in space-y-4">

          {/* ─── 1️⃣ Vendedora Selection ─── */}
          <div className="rounded-2xl border border-border p-5" style={{ background: "hsl(var(--surface-raised))", boxShadow: "var(--shadow-card)" }}>
            <label className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
              <User size={14} className="text-gold" /> Vendedora
            </label>
            <div className="grid grid-cols-4 sm:grid-cols-4 gap-2 mt-2">
              {vendedoras.map((v) => (
                <button key={v} onClick={() => setVendedoraSelecionada(v)}
                  className={`py-3 rounded-xl text-xs font-semibold border-2 transition-all duration-150
                    ${vendedoraSelecionada === v
                      ? "border-gold bg-primary/20 text-gold shadow-gold"
                      : "border-border bg-surface text-muted-foreground hover:border-muted-foreground hover:text-foreground"
                    }`}>
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* ─── 2️⃣ Data da Venda ─── */}
          {isMaster && (
            <div className="rounded-2xl border border-border p-5" style={{ background: "hsl(var(--surface-raised))", boxShadow: "var(--shadow-card)" }}>
              <label className="text-xs font-semibold text-foreground mb-2 flex items-center gap-2">
                <Calendar size={14} className="text-gold" /> Data da Venda
              </label>
              <input type="date" value={dataVenda} onChange={(e) => setDataVenda(e.target.value)}
                max={hoje}
                className="w-full mt-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground focus:outline-none focus:border-gold-muted [color-scheme:dark]" />
              {dataVenda !== hoje && (
                <div className="mt-2 space-y-1.5">
                  <p className="text-[11px] text-amber-400 flex items-center gap-1">⚠️ Venda retroativa: {dataVenda.split("-").reverse().join("/")}</p>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={descontarEstoque} onChange={(e) => setDescontarEstoque(e.target.checked)}
                      className="accent-[hsl(var(--gold))] w-4 h-4 rounded" />
                    <span className="text-xs text-muted-foreground">Descontar estoque</span>
                  </label>
                </div>
              )}
            </div>
          )}

          {/* ─── 3️⃣ Adicionar Produto ─── */}
          <div className="rounded-2xl border border-border p-5" style={{ background: "hsl(var(--surface-raised))", boxShadow: "var(--shadow-card)" }}>
            <p className="text-xs font-semibold text-foreground mb-4 flex items-center gap-2">
              <ShoppingCart size={14} className="text-gold" /> Adicionar Produto
            </p>

            <div className="space-y-3">
              {/* Perfume search */}
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">Perfume</label>
                <PerfumeSearchSelect
                  perfumes={perfumes}
                  value={itemForm.perfumeId}
                  onChange={(id) => setItemForm({ ...itemForm, perfumeId: id, ajuste: 0 })}
                  concentracoesConfig={concentracoesConfig}
                  placeholder="Digite para buscar perfume..."
                />
              </div>

              {/* Depósito + Quantidade */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block">Depósito</label>
                  <select value={itemForm.deposito} onChange={(e) => setItemForm({ ...itemForm, deposito: e.target.value as Deposito })}
                    className="w-full rounded-xl border border-border bg-surface px-3 py-3 text-sm text-foreground focus:outline-none focus:border-gold-muted">
                    <option value="">Selecione...</option>
                    {depositos.map((d) => {
                      const estoque = perfumeSelecionado ? perfumeSelecionado.estoques[d] : 0;
                      return <option key={d} value={d}>{d} ({estoque})</option>;
                    })}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block">Quantidade</label>
                  <div className="flex items-center gap-0 rounded-xl border border-border bg-surface overflow-hidden">
                    <button onClick={decrementQty} className="px-3 py-3 text-muted-foreground hover:text-foreground hover:bg-surface-overlay transition-colors">
                      <Minus size={14} />
                    </button>
                    <input type="number" min={1} value={itemForm.quantidade === 0 ? "" : itemForm.quantidade}
                      onChange={(e) => setItemForm({ ...itemForm, quantidade: e.target.value === "" ? 0 : parseInt(e.target.value) || 0 })}
                      onWheel={(e) => (e.target as HTMLInputElement).blur()}
                      className="flex-1 text-center py-3 text-sm font-semibold text-foreground bg-transparent focus:outline-none min-w-0" />
                    <button onClick={incrementQty} className="px-3 py-3 text-muted-foreground hover:text-foreground hover:bg-surface-overlay transition-colors">
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Ajuste de valor */}
              <div>
                <label className="text-[11px] text-muted-foreground mb-1.5 block flex items-center gap-1">
                  <Tag size={10} /> Ajuste de Valor
                </label>
                <div className="flex gap-2">
                  {/* Tipo toggle */}
                  <div className="flex rounded-xl overflow-hidden border border-border">
                    <button onClick={() => setItemForm({ ...itemForm, tipoAjuste: "desconto", ajuste: 0 })}
                      className={`px-3 py-2.5 text-[11px] font-semibold transition-all duration-150 ${itemForm.tipoAjuste === "desconto" ? "bg-destructive/20 text-destructive" : "bg-surface text-muted-foreground"}`}>
                      Desc.
                    </button>
                    <button onClick={() => setItemForm({ ...itemForm, tipoAjuste: "acrescimo", ajuste: 0 })}
                      className={`px-3 py-2.5 text-[11px] font-semibold transition-all duration-150 ${itemForm.tipoAjuste === "acrescimo" ? "bg-emerald-500/20 text-emerald-400" : "bg-surface text-muted-foreground"}`}>
                      Acrés.
                    </button>
                  </div>
                  {/* Calc toggle */}
                  <div className="flex rounded-xl overflow-hidden border border-border">
                    <button onClick={() => setItemForm({ ...itemForm, tipoCalculo: "valor", ajuste: 0 })}
                      className={`px-3 py-2.5 text-[11px] font-semibold transition-all duration-150 ${itemForm.tipoCalculo === "valor" ? "bg-primary/20 text-gold" : "bg-surface text-muted-foreground"}`}>
                      R$
                    </button>
                    <button onClick={() => setItemForm({ ...itemForm, tipoCalculo: "percent", ajuste: 0 })}
                      className={`px-3 py-2.5 text-[11px] font-semibold transition-all duration-150 ${itemForm.tipoCalculo === "percent" ? "bg-primary/20 text-gold" : "bg-surface text-muted-foreground"}`}>
                      %
                    </button>
                  </div>
                  <input type="number" min={0} value={itemForm.ajuste || ""}
                    onChange={(e) => setItemForm({ ...itemForm, ajuste: parseFloat(e.target.value) || 0 })}
                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                    placeholder="0"
                    className="flex-1 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold-muted min-w-0" />
                </div>
              </div>

              {/* Observação */}
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">Observação</label>
                <input type="text" value={itemForm.observacao} onChange={(e) => setItemForm({ ...itemForm, observacao: e.target.value })}
                  placeholder={itemForm.ajuste > 0 ? "Obrigatório: justifique o ajuste..." : "Opcional..."}
                  className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold-muted" />
              </div>

              {/* Item subtotal */}
              {perfumeSelecionado && (
                <div className="flex justify-between items-center bg-primary/8 border border-gold-muted rounded-xl px-4 py-3">
                  <div>
                    <p className="text-[10px] text-muted-foreground">Preço unitário</p>
                    <p className="text-xs text-foreground">{formatCurrency(perfumeSelecionado.precoVenda)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground">Subtotal item</p>
                    <p className="text-lg font-bold text-gold">{formatCurrency(totalItem)}</p>
                  </div>
                </div>
              )}

              {/* Add to cart button */}
              <button onClick={handleAdicionarAoCarrinho}
                disabled={!itemForm.perfumeId || !itemForm.deposito || itemForm.quantidade < 1}
                className="w-full py-3 rounded-xl text-sm font-bold transition-all duration-150 disabled:opacity-30
                  bg-primary/15 border-2 border-gold text-gold hover:bg-primary/25 active:scale-[0.98]"
                style={{ minHeight: 48 }}>
                <Plus size={16} className="inline mr-1.5 -mt-0.5" />
                Adicionar ao Carrinho
              </button>
            </div>
          </div>

          {/* ─── 4️⃣ Cart Items ─── */}
          {carrinho.length > 0 && (
            <div className="rounded-2xl border border-border p-5" style={{ background: "hsl(var(--surface-raised))", boxShadow: "var(--shadow-card)" }}>
              <p className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
                <Package size={14} className="text-gold" /> Carrinho ({carrinho.length} {carrinho.length === 1 ? "item" : "itens"})
              </p>
              <div className="space-y-2">
                {carrinho.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 bg-surface border border-border rounded-xl px-4 py-3 group hover:border-gold-muted transition-all duration-150">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{item.perfumeNome}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {item.marca} · {item.deposito} · {item.quantidade} un. × {formatCurrency(item.precoUnitario)}
                      </p>
                      {item.ajuste > 0 && (
                        <p className={`text-[11px] font-medium ${item.tipoAjuste === "desconto" ? "text-destructive" : "text-emerald-400"}`}>
                          {item.tipoAjuste === "desconto" ? "−" : "+"} {formatCurrency(item.ajuste)}
                        </p>
                      )}
                    </div>
                    <p className="text-sm font-bold text-gold flex-shrink-0">{formatCurrency(item.total)}</p>
                    <button onClick={() => handleRemoverDoCarrinho(idx)}
                      className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-150">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── 5️⃣ Pagamentos ─── */}
          {carrinho.length > 0 && (
            <div className="rounded-2xl border border-border p-5" style={{ background: "hsl(var(--surface-raised))", boxShadow: "var(--shadow-card)" }}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-foreground flex items-center gap-2">
                  <CreditCard size={14} className="text-gold" /> Formas de Pagamento
                </p>
              </div>

              <div className="space-y-2.5">
                {pagamentosForm.map((pag, idx) => (
                  <div key={idx} className="bg-surface border border-border rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] text-muted-foreground font-medium">Pagamento {idx + 1}</p>
                      <button onClick={() => handleRemoverPagamento(idx)} className="p-1 text-muted-foreground hover:text-destructive transition-colors">
                        <X size={14} />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {tiposPagamento.map((tp) => (
                        <button key={tp} onClick={() => updatePagamento(idx, { tipoPagamento: tp, bandeira: "N/A" })}
                          className={`py-2 rounded-xl text-[11px] font-semibold border transition-all duration-150
                            ${pag.tipoPagamento === tp
                              ? "border-gold bg-primary/15 text-gold"
                              : "border-border bg-surface-overlay text-muted-foreground hover:text-foreground"
                            }`}>
                          {tp}
                        </button>
                      ))}
                    </div>
                    {(pag.tipoPagamento === "Crédito" || pag.tipoPagamento === "Débito") && (
                      <div className="flex gap-1.5 flex-wrap">
                        {bandeiras.map((b) => (
                          <button key={b} onClick={() => updatePagamento(idx, { bandeira: b })}
                            className={`px-3 py-1.5 rounded-xl text-[11px] font-medium border transition-all duration-150
                              ${pag.bandeira === b
                                ? "border-gold bg-primary/15 text-gold"
                                : "border-border bg-surface text-muted-foreground"
                              }`}>
                            {b}
                          </button>
                        ))}
                      </div>
                    )}
                    <div>
                      <label className="text-[11px] text-muted-foreground mb-1 block">Valor (R$)</label>
                      <input type="number" min={0} step={0.01} value={pag.valor || ""}
                        onChange={(e) => updatePagamento(idx, { valor: parseFloat(e.target.value) || 0 })}
                        onWheel={(e) => (e.target as HTMLInputElement).blur()}
                        className="w-full rounded-xl border border-border bg-surface-overlay px-4 py-3 text-sm text-foreground focus:outline-none focus:border-gold-muted" />
                    </div>
                  </div>
                ))}

                {/* Restante / Completo */}
                {restantePagamento > 0.01 && (
                  <div className="flex items-center justify-between bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3">
                    <p className="text-xs text-destructive font-medium">Restante</p>
                    <p className="text-sm font-bold text-destructive">{formatCurrency(restantePagamento)}</p>
                  </div>
                )}
                {Math.abs(restantePagamento) < 0.01 && pagamentosForm.length > 0 && (
                  <div className="flex items-center justify-center bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3">
                    <p className="text-xs text-emerald-400 font-semibold">✓ Pagamento completo</p>
                  </div>
                )}

                <button onClick={handleAdicionarPagamento}
                  disabled={restantePagamento <= 0.01}
                  className="w-full py-2.5 rounded-xl text-xs font-medium border border-border text-muted-foreground bg-surface-overlay disabled:opacity-30 hover:border-gold-muted transition-all duration-150">
                  <Plus size={12} className="inline mr-1" /> Adicionar Forma de Pagamento
                </button>
              </div>
            </div>
          )}

          {/* ─── 6️⃣ Resumo + Ações ─── */}
          {carrinho.length > 0 && (
            <div className="rounded-2xl border-2 border-gold-muted p-5 space-y-3"
              style={{ background: "linear-gradient(135deg, hsl(var(--surface-raised)), hsl(43 74% 49% / 0.04))", boxShadow: "var(--shadow-gold)" }}>
              <p className="text-xs font-semibold text-foreground mb-2">Resumo da Venda</p>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Subtotal ({carrinho.reduce((a, i) => a + i.quantidade, 0)} un.)</span>
                  <span className="text-foreground">{formatCurrency(subtotalCarrinho)}</span>
                </div>
                {descontoCarrinho > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-destructive">Descontos</span>
                    <span className="text-destructive">−{formatCurrency(descontoCarrinho)}</span>
                  </div>
                )}
                {acrescimoCarrinho > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-emerald-400">Acréscimos</span>
                    <span className="text-emerald-400">+{formatCurrency(acrescimoCarrinho)}</span>
                  </div>
                )}
                <div className="border-t border-gold-muted pt-2 mt-2 flex justify-between items-baseline">
                  <span className="text-sm font-bold text-gold">Total</span>
                  <span className="text-2xl font-bold text-gold">{formatCurrency(totalCarrinho)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Action bar */}
          <div className="flex gap-3">
            <button onClick={() => { setShowForm(false); setCarrinho([]); setPagamentosForm([]); setVendedoraSelecionada(""); }}
              className="flex-1 py-3 rounded-xl text-sm font-semibold border-2 border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground transition-all duration-150"
              style={{ minHeight: 48 }}>
              Cancelar
            </button>
            <button onClick={handleLancar}
              disabled={carrinho.length === 0 || !vendedoraSelecionada || pagamentosForm.length === 0 || Math.abs(restantePagamento) > 0.01 || isLancando}
              className="flex-1 py-3 rounded-xl text-sm font-bold transition-all duration-150 disabled:opacity-30 active:scale-[0.98]"
              style={{
                minHeight: 48,
                background: "var(--gradient-gold)",
                color: "hsl(var(--primary-foreground))",
                boxShadow: "0 4px 16px hsl(43 74% 49% / 0.3)",
              }}>
              {isLancando ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin" /> Lançando...
                </span>
              ) : (
                "Confirmar Venda"
              )}
            </button>
          </div>
        </div>
      )}

      {temFiltroAtivo && !showForm && (
        <div className="mx-4 mb-3 bg-surface border border-border rounded-xl p-3 flex justify-between items-center">
          <p className="text-xs text-muted-foreground">Total filtrado ({filtradas.length} vendas)</p>
          {!isVendedor && <p className="text-sm font-bold text-gold">{formatCurrency(totalFiltrado.valor)}</p>}
        </div>
      )}

      {/* Lista de vendas */}
      {!showForm && (
        <div className="px-4 space-y-2">
          {filtradasAgrupadas.map(({ grupoVenda, itens }) => {
            const grupoPags = pagamentos.filter(p => p.grupoVenda === grupoVenda);
            const totalGrupo = itens.reduce((a, v) => a + v.total, 0);
            const isMulti = itens.length > 1 || grupoPags.length > 1;

            return (
              <div key={grupoVenda} className="card-premium p-4">
                {itens.map((v, idx) => {
                  const pf = perfumes.find((p) => p.id === v.perfumeId);
                  return (
                    <div key={v.id} className={idx > 0 ? "mt-2 pt-2 border-t border-border/50" : ""}>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/8 border border-gold-muted flex items-center justify-center flex-shrink-0">
                          <ShoppingCart size={18} className="text-gold" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{v.perfumeNome}</p>
                          {pf && (
                            <p className="text-[10px] text-muted-foreground truncate">
                              {pf.marca} · {pf.concentracao} · {pf.volume}ml
                            </p>
                          )}
                          <p className="text-[11px] text-muted-foreground">
                            {formatDate(v.data)} · {v.deposito} · {v.quantidade} unid.
                          </p>
                        </div>
                        {!isVendedor && (
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-bold text-gold">{formatCurrency(v.total)}</p>
                            <p className="text-[10px] text-muted-foreground">{formatCurrency(v.precoUnitario)}/un</p>
                          </div>
                        )}
                      </div>
                      {v.desconto > 0 && !isVendedor && (
                        <div className="flex items-center gap-1 mt-1 ml-13">
                          <Tag size={10} className={v.tipoAjuste === "desconto" ? "text-destructive" : "text-emerald-400"} />
                          <p className={`text-[11px] ${v.tipoAjuste === "desconto" ? "text-destructive" : "text-emerald-400"}`}>
                            {v.tipoAjuste === "desconto" ? "-" : "+"}{formatCurrency(v.desconto)}
                          </p>
                        </div>
                      )}
                      {v.observacao && (
                        <p className="text-[10px] text-muted-foreground mt-1 italic ml-13">"{v.observacao}"</p>
                      )}
                    </div>
                  );
                })}

                {isMulti && !isVendedor && (
                  <div className="mt-2 pt-2 border-t border-gold-muted flex justify-between items-center">
                    <p className="text-[10px] text-muted-foreground">{itens.length} itens</p>
                    <p className="text-sm font-bold text-gold">{formatCurrency(totalGrupo)}</p>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-1 mt-2 pt-2 border-t border-border">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1">
                      <User size={10} className="text-muted-foreground" />
                      <p className="text-[11px] text-muted-foreground">{itens[0].vendedora}</p>
                    </div>
                    {grupoPags.length > 0 ? (
                      grupoPags.map((pg, i) => (
                        <div key={i} className="flex items-center gap-1">
                          <CreditCard size={10} className="text-muted-foreground" />
                          <p className="text-[11px] text-muted-foreground">
                            {pg.tipoPagamento}{pg.bandeira !== "N/A" ? ` · ${pg.bandeira}` : ""}: {formatCurrency(pg.valor)}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="flex items-center gap-1">
                        <CreditCard size={10} className="text-muted-foreground" />
                        <p className="text-[11px] text-muted-foreground">
                          {itens[0].tipoPagamento}{itens[0].bandeira !== "N/A" ? ` · ${itens[0].bandeira}` : ""}
                        </p>
                      </div>
                    )}
                    {itens[0].registradoPor && (
                      <p className="text-[10px] text-muted-foreground">Reg: {itens[0].registradoPor}</p>
                    )}
                  </div>
                  {isMaster && (
                    <div className="flex gap-1">
                      {itens.map(v => (
                        <button key={v.id} onClick={() => handleExcluirVenda(v.id)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-150"
                          title={`Excluir ${v.perfumeNome}`}>
                          <Trash2 size={13} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {filtradasAgrupadas.length === 0 && (
            <div className="text-center py-20">
              <ShoppingCart size={40} className="text-muted-foreground mx-auto mb-4 opacity-40" />
              <p className="text-muted-foreground text-sm">Nenhuma venda encontrada</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
