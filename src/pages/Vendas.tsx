import { useState, useMemo } from "react";
import {
  ShoppingCart, Plus, Calendar, User, FileText, CreditCard,
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
import { calcularParcelamento, TAXAS_MDR, PARCELAS_SEM_JUROS_LIMITE } from "@/lib/parcelamento";

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
  total: number;
  observacao: string;
}

interface PagamentoItem {
  tipoPagamento: TipoPagamento;
  bandeira: Bandeira;
  valor: number;
  observacao?: string;
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
  const userLoja = (isVendedor && profile?.loja) ? profile.loja as Deposito : null;
  const vendedoras = [...vendedorasCtx, ...vendedorasFixas];

  const [filtroData, setFiltroData] = useState("");
  const [filtroDeposito, setFiltroDeposito] = useState<Deposito | "Todos">(userLoja || "Todos");
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
  const [lojaRelatorio, setLojaRelatorio] = useState<Deposito | "Geral">(userLoja || "Geral");
  const [isLancando, setIsLancando] = useState(false);

  // Cart state
  const [carrinho, setCarrinho] = useState<CarrinhoItem[]>([]);
  const [vendedoraSelecionada, setVendedoraSelecionada] = useState("");
  const [pagamentosForm, setPagamentosForm] = useState<PagamentoItem[]>([]);

  // Item being added to cart
  const [itemForm, setItemForm] = useState({
    perfumeId: "",
    deposito: (userLoja || "") as Deposito | "",
    quantidade: 1,
    observacao: "",
  });

  // Sale-level adjustment (moved from per-item)
  const [tipoAjusteVenda, setTipoAjusteVenda] = useState<TipoAjusteValor>("desconto");
  const [ajusteVenda, setAjusteVenda] = useState(0);
  const [tipoCalculoVenda, setTipoCalculoVenda] = useState<"valor" | "percent">("valor");
  const [observacaoAjuste, setObservacaoAjuste] = useState("");

  const perfumeSelecionado = perfumes.find((p) => p.id === itemForm.perfumeId);
  const subtotalItem = perfumeSelecionado ? perfumeSelecionado.precoVenda * itemForm.quantidade : 0;

  const subtotalCarrinho = carrinho.reduce((a, i) => a + i.precoUnitario * i.quantidade, 0);
  const ajusteCalcVenda = tipoCalculoVenda === "percent" ? (subtotalCarrinho * ajusteVenda) / 100 : ajusteVenda;
  const totalCarrinho = tipoAjusteVenda === "desconto" ? Math.max(0, subtotalCarrinho - ajusteCalcVenda) : subtotalCarrinho + ajusteCalcVenda;
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

    const itemTotal = p.precoVenda * itemForm.quantidade;

    setCarrinho([...carrinho, {
      perfumeId: p.id,
      perfumeNome: p.nome,
      marca: p.marca,
      concentracao: p.concentracao,
      volume: p.volume,
      deposito: itemForm.deposito as Deposito,
      quantidade: itemForm.quantidade,
      precoUnitario: p.precoVenda,
      total: itemTotal,
      observacao: itemForm.observacao,
    }]);
    setItemForm({ perfumeId: "", deposito: userLoja || "", quantidade: 1, observacao: "" });
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

    if (ajusteVenda > 0 && !observacaoAjuste.trim()) {
      alert("Preencha a observação para justificar o ajuste de valor.");
      return;
    }

    setIsLancando(true);
    try {
      const dataEfetiva = isMaster ? dataVenda : getHojeManaus();
      // Distribute the sale-level adjustment proportionally across items
      const itens: Venda[] = carrinho.map((item, idx) => {
        const proporcao = subtotalCarrinho > 0 ? (item.precoUnitario * item.quantidade) / subtotalCarrinho : 1 / carrinho.length;
        const ajusteItem = ajusteCalcVenda * proporcao;
        const totalItem = tipoAjusteVenda === "desconto"
          ? Math.max(0, item.precoUnitario * item.quantidade - ajusteItem)
          : item.precoUnitario * item.quantidade + ajusteItem;

        return {
          id: `v${Date.now()}_${idx}`,
          data: dataEfetiva,
          perfumeId: item.perfumeId,
          perfumeNome: item.perfumeNome,
          deposito: item.deposito,
          quantidade: item.quantidade,
          precoUnitario: item.precoUnitario,
          tipoAjuste: ajusteVenda > 0 ? tipoAjusteVenda : "desconto" as TipoAjusteValor,
          desconto: ajusteItem,
          total: totalItem,
          vendedora: vendedoraSelecionada,
          tipoPagamento: pagamentosForm[0].tipoPagamento,
          bandeira: pagamentosForm[0].bandeira,
          observacao: ajusteVenda > 0 ? observacaoAjuste : (pagamentosForm.some(p => p.tipoPagamento === "Conta Assinada" && p.observacao) ? pagamentosForm.filter(p => p.tipoPagamento === "Conta Assinada").map(p => `Conta Assinada: ${p.observacao}`).join("; ") : item.observacao),
          registradoPor: profile?.nome || "Desconhecido",
        };
      });

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
      setAjusteVenda(0);
      setTipoAjusteVenda("desconto");
      setTipoCalculoVenda("valor");
      setObservacaoAjuste("");
      setItemForm({ perfumeId: "", deposito: userLoja || "", quantidade: 1, observacao: "" });
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
      const matchDeposito = userLoja ? v.deposito === userLoja : (filtroDeposito === "Todos" || v.deposito === filtroDeposito);
      const matchVendedora = filtroVendedora === "Todas" || v.vendedora === filtroVendedora;
      const matchBusca = busca.trim() === "" || v.perfumeNome.toLowerCase().includes(busca.toLowerCase()) || v.vendedora.toLowerCase().includes(busca.toLowerCase());
      return matchData && matchDeposito && matchVendedora && matchBusca;
    });
    result = [...result].sort((a, b) =>
      ordenacao === "recente" ? b.data.localeCompare(a.data) : a.data.localeCompare(b.data)
    );
    return result;
  }, [vendas, filtroData, filtroDeposito, filtroVendedora, busca, ordenacao, userLoja]);

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
    const vendasHoje = vendas.filter((v) => {
      const matchHoje = v.data === hoje;
      const matchLoja = userLoja ? v.deposito === userLoja : true;
      return matchHoje && matchLoja;
    });
    return {
      valor: vendasHoje.reduce((a, v) => a + v.total, 0),
      itens: vendasHoje.reduce((a, v) => a + v.quantidade, 0),
      qtd: vendasHoje.length,
    };
  }, [vendas, userLoja]);

  const totalFiltrado = useMemo(() => ({
    valor: filtradas.reduce((a, v) => a + v.total, 0),
    itens: filtradas.reduce((a, v) => a + v.quantidade, 0),
  }), [filtradas]);

  const vendasRelatorio = useMemo(() => {
    const modo = isVendedor ? "dia" : modoRelatorio;
    const dataEfetiva = isVendedor ? hoje : dataRelatorio;
    return vendas.filter((v) => {
      const matchLoja = userLoja ? v.deposito === userLoja : (lojaRelatorio === "Geral" || v.deposito === lojaRelatorio);
      if (!matchLoja) return false;
      if (modo === "dia") return v.data === dataEfetiva;
      if (modo === "mes") return v.data.startsWith(mesRelatorio);
      const ok1 = periodoInicio ? v.data >= periodoInicio : true;
      const ok2 = periodoFim ? v.data <= periodoFim : true;
      return ok1 && ok2;
    });
  }, [vendas, modoRelatorio, dataRelatorio, mesRelatorio, periodoInicio, periodoFim, lojaRelatorio, isVendedor, userLoja]);

  const vendasPorLoja = useMemo(() => {
    if (userLoja || lojaRelatorio !== "Geral") return null;
    return depositos.map((dep) => {
      const vLoja = vendasRelatorio.filter((v) => v.deposito === dep);
      return { loja: dep, total: vLoja.reduce((a, v) => a + v.total, 0), qtd: vLoja.length, itens: vLoja.reduce((a, v) => a + v.quantidade, 0) };
    }).filter((l) => l.qtd > 0);
  }, [vendasRelatorio, lojaRelatorio, userLoja]);

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

  // Available depositos for this user
  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 pt-12 pb-4" style={{ background: "var(--gradient-header)" }}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="page-title">Vendas</h1>
            <p className="page-subtitle mt-1">
              Hoje: {totalHoje.qtd} vendas · {totalHoje.itens} itens
              {userLoja ? ` · ${userLoja}` : ""}
            </p>
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
                {!userLoja ? (
                  <select value={filtroDeposito} onChange={(e) => setFiltroDeposito(e.target.value as Deposito | "Todos")}
                    className="input-premium px-3 py-2.5 text-xs">
                    <option value="Todos">Depósito</option>
                    {depositos.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                ) : (
                  <div className="flex items-center justify-center kpi-card px-3 py-2.5 text-xs text-muted-foreground">
                    <Store size={13} className="mr-1.5" /> {userLoja}
                  </div>
                )}
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
            {!userLoja && (
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
            )}
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
              {!userLoja && lojaRelatorio === "Geral" && vendasPorLoja && vendasPorLoja.length > 0 && (
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

      {/* Nova Venda Form */}
      {showForm && (
        <div className="mx-4 mb-5 space-y-4 animate-fade-in">
          {/* Vendedora selection */}
          <div className="card-premium p-5" style={{ boxShadow: "var(--shadow-gold)" }}>
            <h3 className="font-display text-lg text-foreground mb-4 flex items-center gap-2">
              <User size={16} className="text-gold" />
              Vendedora
            </h3>
            <div className="grid grid-cols-4 gap-2">
              {vendedoras.map((v) => (
                <button key={v} onClick={() => setVendedoraSelecionada(v)}
                  className={`py-2.5 rounded-xl text-xs font-medium border transition-all duration-150 ${
                    vendedoraSelecionada === v
                      ? "border-gold-muted text-gold" : "border-border bg-surface-overlay text-muted-foreground"
                  }`}
                  style={vendedoraSelecionada === v ? { background: "var(--gradient-gold)", color: "hsl(var(--primary-foreground))" } : {}}>
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Data + Retroativa */}
          <div className="card-premium p-5">
            <div className="flex items-center gap-2 mb-3">
              <Calendar size={14} className="text-gold" />
              <label className="text-xs text-muted-foreground">Data da Venda</label>
            </div>
            <input type="date" value={dataVenda}
              onChange={(e) => setDataVenda(e.target.value)}
              disabled={isVendedor}
              className="input-premium px-3 py-2.5 text-sm [color-scheme:dark]" />
            {isRetroativa && (
              <label className="flex items-center gap-2 mt-3 cursor-pointer">
                <input type="checkbox" checked={descontarEstoque} onChange={(e) => setDescontarEstoque(e.target.checked)}
                  className="w-4 h-4 rounded border-border accent-gold" />
                <span className="text-xs text-muted-foreground">Descontar do estoque atual</span>
              </label>
            )}
          </div>

          {/* Add product */}
          <div className="card-premium p-5" style={{ boxShadow: "var(--shadow-gold)" }}>
            <h3 className="font-display text-lg text-foreground mb-4 flex items-center gap-2">
              <Package size={16} className="text-gold" />
              Adicionar Produto
            </h3>
            <div className="space-y-3">
              <PerfumeSearchSelect perfumes={perfumes} value={itemForm.perfumeId}
                onChange={(id) => setItemForm({ ...itemForm, perfumeId: id })}
                concentracoesConfig={concentracoesConfig} />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-muted-foreground mb-1.5 block">Depósito</label>
                  {userLoja ? (
                    <div className="input-premium px-3 py-2.5 text-xs text-muted-foreground bg-surface-overlay flex items-center gap-1">
                      <Store size={12} /> {userLoja}
                    </div>
                  ) : (
                    <select value={itemForm.deposito} onChange={(e) => setItemForm({ ...itemForm, deposito: e.target.value as Deposito })}
                      className="input-premium px-3 py-2.5 text-xs">
                      <option value="">Selecione</option>
                      {depositos.map((d) => {
                        const selectedPerfume = perfumes.find((p) => p.id === itemForm.perfumeId);
                        const qtd = selectedPerfume ? selectedPerfume.estoques[d as Deposito] ?? 0 : null;
                        return <option key={d} value={d}>{d}{qtd !== null ? ` (${qtd})` : ""}</option>;
                      })}
                    </select>
                  )}
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground mb-1.5 block">Quantidade</label>
                  <div className="flex items-center gap-1">
                    <button onClick={decrementQty} className="btn-secondary p-2"><Minus size={12} /></button>
                    <input type="number" min={1} value={itemForm.quantidade}
                      onChange={(e) => setItemForm({ ...itemForm, quantidade: parseInt(e.target.value) || 1 })}
                      className="input-premium px-2 py-2 text-center text-sm flex-1" />
                    <button onClick={incrementQty} className="btn-secondary p-2"><Plus size={12} /></button>
                  </div>
                </div>
              </div>

              {perfumeSelecionado && (
                <div className="flex justify-between items-center bg-surface-overlay rounded-xl px-4 py-3">
                  <span className="text-xs text-muted-foreground">Subtotal do item</span>
                  <span className="text-sm font-bold text-gold">{formatCurrency(subtotalItem)}</span>
                </div>
              )}

              <button onClick={handleAdicionarAoCarrinho}
                disabled={!itemForm.perfumeId || !itemForm.deposito || itemForm.quantidade < 1}
                className="w-full py-3 rounded-xl text-sm font-semibold text-primary-foreground disabled:opacity-50"
                style={{ background: "var(--gradient-gold)" }}>
                <Plus size={14} className="inline mr-1" /> Adicionar ao Carrinho
              </button>
            </div>
          </div>

          {/* Cart */}
          {carrinho.length > 0 && (
            <div className="card-premium p-5">
              <h3 className="font-display text-lg text-foreground mb-4 flex items-center gap-2">
                <ShoppingCart size={16} className="text-gold" />
                Carrinho ({carrinho.length})
              </h3>
              <div className="space-y-2">
                {carrinho.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-surface-overlay rounded-xl px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{item.perfumeNome}</p>
                      <p className="text-[10px] text-muted-foreground">{item.quantidade}x {formatCurrency(item.precoUnitario)} · {item.deposito}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-gold">{formatCurrency(item.total)}</p>
                      <button onClick={() => handleRemoverDoCarrinho(idx)} className="text-muted-foreground hover:text-destructive"><X size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pagamento e Ajuste */}
          {carrinho.length > 0 && (
            <div className="card-premium p-5">
              <h3 className="font-display text-lg text-foreground mb-4 flex items-center gap-2">
                <CreditCard size={16} className="text-gold" />
                Pagamento
              </h3>

              {/* Ajuste no valor total */}
              <div className="mb-4 p-3 bg-surface-overlay rounded-xl space-y-2">
                <p className="text-[11px] text-muted-foreground font-medium">Desconto / Acréscimo na venda</p>
                <div className="flex gap-1.5">
                  {(["desconto", "acrescimo"] as TipoAjusteValor[]).map((t) => (
                    <button key={t} onClick={() => setTipoAjusteVenda(t)}
                      className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${
                        tipoAjusteVenda === t ? "border-gold-muted bg-primary/10 text-gold" : "border-border bg-surface-overlay text-muted-foreground"
                      }`}>
                      {t === "desconto" ? "Desconto" : "Acréscimo"}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex gap-1">
                    {(["valor", "percent"] as const).map((tc) => (
                      <button key={tc} onClick={() => setTipoCalculoVenda(tc)}
                        className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${
                          tipoCalculoVenda === tc ? "border-gold-muted bg-primary/10 text-gold" : "border-border bg-surface-overlay text-muted-foreground"
                        }`}>
                        {tc === "valor" ? "R$" : "%"}
                      </button>
                    ))}
                  </div>
                  <input type="number" min={0} value={ajusteVenda || ""} placeholder="0"
                    onChange={(e) => setAjusteVenda(parseFloat(e.target.value) || 0)}
                    className="input-premium px-3 py-1.5 text-xs" />
                </div>
                {ajusteVenda > 0 && (
                  <input type="text" value={observacaoAjuste}
                    onChange={(e) => setObservacaoAjuste(e.target.value)}
                    placeholder="Observação (obrigatória com ajuste)"
                    className="input-premium px-3 py-2 text-xs" />
                )}
              </div>

              {/* Resumo do total */}
              <div className="mb-4 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="text-foreground">{formatCurrency(subtotalCarrinho)}</span>
                </div>
                {ajusteCalcVenda > 0 && tipoAjusteVenda === "desconto" && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Desconto</span>
                    <span className="text-destructive">-{formatCurrency(ajusteCalcVenda)}</span>
                  </div>
                )}
                {ajusteCalcVenda > 0 && tipoAjusteVenda === "acrescimo" && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Acréscimo</span>
                    <span className="text-success">+{formatCurrency(ajusteCalcVenda)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold pt-1 border-t border-border">
                  <span className="text-foreground">Total da Venda</span>
                  <span className="text-gold">{formatCurrency(totalCarrinho)}</span>
                </div>
              </div>

              {/* Formas de pagamento */}
              <div className="space-y-2 mb-3">
                {pagamentosForm.map((pag, idx) => (
                  <div key={idx} className="bg-surface-overlay rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <select value={pag.tipoPagamento}
                        onChange={(e) => updatePagamento(idx, { tipoPagamento: e.target.value as TipoPagamento, bandeira: ["Crédito", "Débito"].includes(e.target.value) ? "Visa" : "N/A" })}
                        className="input-premium px-2 py-1.5 text-xs flex-1 mr-2">
                        {tiposPagamento.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <button onClick={() => handleRemoverPagamento(idx)} className="text-muted-foreground hover:text-destructive"><X size={14} /></button>
                    </div>
                    {["Crédito", "Débito"].includes(pag.tipoPagamento) && (
                      <select value={pag.bandeira} onChange={(e) => updatePagamento(idx, { bandeira: e.target.value as Bandeira })}
                        className="input-premium px-2 py-1.5 text-xs">
                        {bandeiras.map((b) => <option key={b} value={b}>{b}</option>)}
                      </select>
                    )}
                    {pag.tipoPagamento === "Conta Assinada" && (
                      <input type="text" placeholder="Nome do funcionário / observação"
                        value={pag.observacao || ""}
                        onChange={(e) => updatePagamento(idx, { observacao: e.target.value })}
                        className="input-premium px-2 py-1.5 text-xs" />
                    )}
                    <input type="number" min={0} step="0.01" value={pag.valor}
                      onChange={(e) => updatePagamento(idx, { valor: parseFloat(e.target.value) || 0 })}
                      className="input-premium px-2 py-1.5 text-xs" />
                  </div>
                ))}
              </div>
              {restantePagamento > 0.01 && (
                <button onClick={handleAdicionarPagamento} className="btn-secondary w-full py-2.5 text-xs mb-3">
                  <Plus size={12} /> Adicionar pagamento ({formatCurrency(restantePagamento)} restante)
                </button>
              )}
              {Math.abs(restantePagamento) <= 0.01 && pagamentosForm.length > 0 && (
                <div className="bg-success/10 border border-success/20 rounded-xl px-3 py-2 text-center">
                  <p className="text-xs text-success font-medium">✓ Pagamento completo</p>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          {carrinho.length > 0 && (
            <div className="flex gap-3">
              <button onClick={() => { setShowForm(false); setCarrinho([]); setPagamentosForm([]); }}
                className="btn-secondary flex-1 py-3">
                Cancelar
              </button>
              <button onClick={handleLancar}
                disabled={isLancando || carrinho.length === 0 || !vendedoraSelecionada || pagamentosForm.length === 0 || Math.abs(restantePagamento) > 0.01}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-primary-foreground disabled:opacity-50"
                style={{ background: "var(--gradient-gold)" }}>
                {isLancando ? <><Loader2 size={14} className="inline mr-1 animate-spin" /> Lançando...</> : "Confirmar Venda"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Sales list */}
      {!showForm && (
        <div className="px-4 space-y-2.5">
          {temFiltroAtivo && (
            <div className="flex justify-between items-center mb-2 px-1">
              <p className="text-[11px] text-muted-foreground">{filtradas.length} venda(s) encontrada(s)</p>
              {!isVendedor && <p className="text-[11px] font-semibold text-gold">{formatCurrency(totalFiltrado.valor)}</p>}
            </div>
          )}

          {filtradasAgrupadas.map(({ grupoVenda, itens }) => {
            const grupoPags = pagamentos.filter((p) => p.grupoVenda === grupoVenda);
            const grupoTotal = itens.reduce((a, v) => a + v.total, 0);
            const isGroup = itens.length > 1;

            return (
              <div key={grupoVenda} className="card-premium overflow-hidden">
                {isGroup && (
                  <div className="px-4 py-2 border-b border-border flex items-center justify-between bg-surface-overlay">
                    <div className="flex items-center gap-2">
                      <ShoppingCart size={12} className="text-gold" />
                      <span className="text-[10px] font-semibold text-gold">{itens.length} itens</span>
                    </div>
                    <span className="text-xs font-bold text-gold">{formatCurrency(grupoTotal)}</span>
                  </div>
                )}
                {itens.map((v) => (
                  <div key={v.id} className="p-4 flex items-start gap-3 border-b border-border last:border-b-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-sm font-medium text-foreground truncate">{v.perfumeNome}</p>
                        {!isVendedor && <p className="text-sm font-bold text-gold flex-shrink-0">{formatCurrency(v.total)}</p>}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                        <span>{formatDate(v.data)}</span>
                        <span>{v.deposito}</span>
                        <span>{v.quantidade}x {formatCurrency(v.precoUnitario)}</span>
                        <span>{v.vendedora}</span>
                        <span>{v.tipoPagamento}{v.bandeira && v.bandeira !== "N/A" ? ` (${v.bandeira})` : ""}</span>
                        {v.registradoPor && <span>por {v.registradoPor}</span>}
                      </div>
                      {v.desconto > 0 && (
                        <p className="text-[10px] mt-0.5">
                          <span className={v.tipoAjuste === "desconto" ? "text-destructive" : "text-emerald-400"}>
                            {v.tipoAjuste === "desconto" ? "-" : "+"}{formatCurrency(v.desconto)}
                          </span>
                        </p>
                      )}
                      {v.observacao && <p className="text-[10px] text-muted-foreground italic mt-0.5">"{v.observacao}"</p>}
                    </div>
                    {isMaster && (
                      <button onClick={() => handleExcluirVenda(v.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
                {isGroup && grupoPags.length > 0 && (
                  <div className="px-4 py-2 bg-surface-overlay border-t border-border">
                    <div className="flex flex-wrap gap-2">
                      {grupoPags.map((pg, i) => (
                        <span key={i} className="text-[10px] bg-primary/10 text-gold px-2 py-0.5 rounded-full">
                          {pg.tipoPagamento}{pg.bandeira !== "N/A" ? ` · ${pg.bandeira}` : ""}: {formatCurrency(pg.valor)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {filtradas.length === 0 && (
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
