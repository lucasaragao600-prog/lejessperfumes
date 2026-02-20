import { useState, useMemo } from "react";
import { ShoppingCart, Plus, Calendar, User, Tag, FileText, CreditCard, Search, ArrowUpDown, Store, Trash2 } from "lucide-react";
import { formatCurrency, formatDate, type Deposito, type Venda, type TipoPagamento, type Bandeira, type TipoAjusteValor } from "@/data/mockData";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";

const depositos: Deposito[] = ["Casa", "Sumaúma", "Amazonas"];
const hoje = new Date().toISOString().slice(0, 10);
const ontem = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const vendedorasFixas = ["Outra"];
const tiposPagamento: TipoPagamento[] = ["Dinheiro", "Pix", "Débito", "Crédito"];
const bandeiras: Bandeira[] = ["Visa", "Mastercard", "Elo", "Amex", "Hipercard"];

export default function Vendas() {
  const { vendas, perfumes, baixarEstoque, vendedoras: vendedorasCtx, adicionarVenda, excluirVenda } = useApp();
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
  const [showRelatorio, setShowRelatorio] = useState(false);
  const [modoRelatorio, setModoRelatorio] = useState<"dia" | "periodo" | "mes">("dia");
  const [dataRelatorio, setDataRelatorio] = useState(hoje);
  const [periodoInicio, setPeriodoInicio] = useState("");
  const [periodoFim, setPeriodoFim] = useState("");
  const [mesRelatorio, setMesRelatorio] = useState("2026-02");
  const [lojaRelatorio, setLojaRelatorio] = useState<Deposito | "Geral">("Geral");

  const [form, setForm] = useState({
    perfumeId: "",
    deposito: "" as Deposito | "",
    quantidade: 1,
    ajuste: 0,
    tipoAjuste: "desconto" as TipoAjusteValor,
    tipoCalculo: "valor" as "valor" | "percent",
    vendedora: "",
    tipoPagamento: "" as TipoPagamento | "",
    bandeira: "N/A" as Bandeira,
    observacao: "",
  });

  const perfumeSelecionado = perfumes.find((p) => p.id === form.perfumeId);
  const subtotal = perfumeSelecionado ? perfumeSelecionado.precoVenda * form.quantidade : 0;
  const ajusteCalculado = form.tipoCalculo === "percent" ? (subtotal * form.ajuste) / 100 : form.ajuste;
  const totalFinal = form.tipoAjuste === "desconto" ? Math.max(0, subtotal - ajusteCalculado) : subtotal + ajusteCalculado;

  const filtradas = useMemo(() => {
    let result = vendas.filter((v) => {
      const matchData = filtroData ? v.data === filtroData : true;
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
    const dataEfetiva = isVendedor
      ? (dataRelatorio === hoje || dataRelatorio === ontem ? dataRelatorio : hoje)
      : dataRelatorio;

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
      if (!porPagamento[v.tipoPagamento]) porPagamento[v.tipoPagamento] = { qtd: 0, valor: 0 };
      porPagamento[v.tipoPagamento].qtd += 1;
      porPagamento[v.tipoPagamento].valor += v.total;
      if (v.bandeira !== "N/A") {
        if (!porBandeira[v.bandeira]) porBandeira[v.bandeira] = { qtd: 0, valor: 0 };
        porBandeira[v.bandeira].qtd += 1;
        porBandeira[v.bandeira].valor += v.total;
      }
      if (v.tipoAjuste === "desconto") totalDesconto += v.desconto;
      else totalAcrescimo += v.desconto;
    });

    return { porProduto, porVendedora, porPagamento, porBandeira, totalDesconto, totalAcrescimo };
  }, [vendasRelatorio]);

  const handleLancar = async () => {
    if (!form.perfumeId || !form.deposito || form.quantidade < 1 || !form.vendedora || !form.tipoPagamento) return;
    const p = perfumes.find((x) => x.id === form.perfumeId)!;
    const estoqueAtual = p.estoques[form.deposito as Deposito];
    if (estoqueAtual < form.quantidade) {
      alert(`Estoque insuficiente em ${form.deposito}. Disponível: ${estoqueAtual}`);
      return;
    }
    const hoje = new Date().toISOString().slice(0, 10);
    const novaVenda: Venda = {
      id: `v${Date.now()}`,
      data: hoje,
      perfumeId: form.perfumeId,
      perfumeNome: p.nome,
      deposito: form.deposito as Deposito,
      quantidade: form.quantidade,
      precoUnitario: p.precoVenda,
      tipoAjuste: form.tipoAjuste,
      desconto: ajusteCalculado,
      total: totalFinal,
      vendedora: form.vendedora,
      tipoPagamento: form.tipoPagamento as TipoPagamento,
      bandeira: form.tipoPagamento === "Crédito" || form.tipoPagamento === "Débito" ? form.bandeira : "N/A",
      observacao: form.observacao,
      registradoPor: profile?.nome || "Desconhecido",
    };
    await adicionarVenda(novaVenda);
    baixarEstoque(form.perfumeId, form.deposito as Deposito, form.quantidade);
    setForm({ perfumeId: "", deposito: "", quantidade: 1, ajuste: 0, tipoAjuste: "desconto", tipoCalculo: "valor", vendedora: "", tipoPagamento: "", bandeira: "N/A", observacao: "" });
    setShowForm(false);
  };
  const handleExcluirVenda = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta venda?")) return;
    await excluirVenda(id);
  };

  const temFiltroAtivo = filtroData || filtroDeposito !== "Todos" || filtroVendedora !== "Todas" || busca.trim() !== "";

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
          <div className="flex gap-2">
            <button onClick={() => setShowRelatorio(!showRelatorio)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border border-border text-muted-foreground bg-surface transition-all">
              <FileText size={14} />
              Relatório
            </button>
            <button onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-primary-foreground shadow-gold transition-all active:scale-95"
              style={{ background: "var(--gradient-gold)" }}>
              <Plus size={16} />
              Lançar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-surface border border-gold-muted rounded-xl p-3">
            <p className="text-[10px] text-muted-foreground mb-1">{isVendedor ? "Vendas hoje" : "Faturado hoje"}</p>
            <p className="text-base font-bold text-gold">{isVendedor ? `${totalHoje.qtd} vendas` : formatCurrency(totalHoje.valor)}</p>
          </div>
          <div className="bg-surface border border-border rounded-xl p-3">
            <p className="text-[10px] text-muted-foreground mb-1">Itens vendidos</p>
            <p className="text-base font-bold text-foreground">{totalHoje.itens} unid.</p>
          </div>
        </div>

        <div className="relative mb-2">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" value={busca} onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por perfume ou vendedora..."
            className="w-full bg-surface border border-border rounded-xl pl-8 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold-muted" />
        </div>

        <div className="grid grid-cols-2 gap-2 mb-1">
          <div className="relative">
            <Calendar size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="date" value={filtroData} onChange={(e) => setFiltroData(e.target.value)}
              className="w-full bg-surface border border-border rounded-xl pl-8 pr-3 py-2 text-xs text-foreground focus:outline-none focus:border-gold-muted [color-scheme:dark]" />
          </div>
          <select value={filtroDeposito} onChange={(e) => setFiltroDeposito(e.target.value as Deposito | "Todos")}
            className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-gold-muted">
            <option value="Todos">Depósito</option>
            {depositos.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={filtroVendedora} onChange={(e) => setFiltroVendedora(e.target.value)}
            className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-gold-muted">
            <option value="Todas">Vendedora</option>
            {vendedoras.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
          <button onClick={() => setOrdenacao(o => o === "recente" ? "antiga" : "recente")}
            className={`flex items-center justify-center gap-1 px-2.5 py-2 rounded-xl text-xs font-medium border transition-all ${ordenacao === "antiga" ? "border-gold-muted bg-gold/10 text-gold" : "border-border bg-surface text-muted-foreground"}`}>
            <ArrowUpDown size={13} /> {ordenacao === "recente" ? "Recente" : "Antiga"}
          </button>
        </div>
      </div>

      {/* Relatório */}
      {showRelatorio && (
        <div className="mx-4 mb-4 bg-surface border border-border rounded-xl p-4 animate-fade-in space-y-4">
          <div>
            <h3 className="font-display text-base text-gold flex items-center gap-2 mb-3">
              <FileText size={16} />
              Relatório de Vendas
            </h3>
            <div className="mb-3">
              <p className="text-[10px] text-muted-foreground mb-1.5 flex items-center gap-1"><Store size={10} />Loja</p>
              <div className="flex gap-1.5 flex-wrap">
                {(["Geral", ...depositos] as const).map((loja) => (
                  <button key={loja} onClick={() => setLojaRelatorio(loja as Deposito | "Geral")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${lojaRelatorio === loja ? "bg-gold/20 text-gold border-gold-muted" : "bg-surface-overlay border-border text-muted-foreground"}`}>
                    {loja}
                  </button>
                ))}
              </div>
            </div>
            {!isVendedor && (
              <div className="flex gap-1.5 mb-3">
                {(["dia", "mes", "periodo"] as const).map((m) => (
                  <button key={m} onClick={() => setModoRelatorio(m)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${modoRelatorio === m ? "bg-gold/20 text-gold border-gold-muted" : "bg-surface-overlay border-border text-muted-foreground"}`}>
                    {m === "dia" ? "Dia" : m === "mes" ? "Mês" : "Período"}
                  </button>
                ))}
              </div>
            )}
            {(isVendedor || modoRelatorio === "dia") && (
              <div>
                {isVendedor ? (
                  <div className="flex gap-1.5 mb-3">
                    {[{ label: "Hoje", value: hoje }, { label: "Ontem", value: ontem }].map((opt) => (
                      <button key={opt.value} onClick={() => setDataRelatorio(opt.value)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${dataRelatorio === opt.value ? "bg-gold/20 text-gold border-gold-muted" : "bg-surface-overlay border-border text-muted-foreground"}`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <input type="date" value={dataRelatorio} onChange={(e) => setDataRelatorio(e.target.value)}
                    className="w-full bg-surface-overlay border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none [color-scheme:dark]" />
                )}
              </div>
            )}
            {!isVendedor && modoRelatorio === "mes" && (
              <input type="month" value={mesRelatorio} onChange={(e) => setMesRelatorio(e.target.value)}
                className="w-full bg-surface-overlay border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none [color-scheme:dark]" />
            )}
            {!isVendedor && modoRelatorio === "periodo" && (
              <div className="flex gap-2 items-center">
                <input type="date" value={periodoInicio} onChange={(e) => setPeriodoInicio(e.target.value)}
                  className="flex-1 bg-surface-overlay border border-border rounded-lg px-2 py-2 text-xs text-foreground focus:outline-none [color-scheme:dark]" />
                <span className="text-muted-foreground text-xs">até</span>
                <input type="date" value={periodoFim} onChange={(e) => setPeriodoFim(e.target.value)}
                  className="flex-1 bg-surface-overlay border border-border rounded-lg px-2 py-2 text-xs text-foreground focus:outline-none [color-scheme:dark]" />
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
                      <div key={loja.loja} className="flex justify-between items-center bg-surface-overlay rounded-lg px-2.5 py-2">
                        <div>
                          <p className="text-xs font-medium text-foreground">{loja.loja}</p>
                          <p className="text-[10px] text-muted-foreground">{loja.qtd} vendas · {loja.itens} un.</p>
                        </div>
                        {!isVendedor && <p className="text-xs font-bold text-gold">{formatCurrency(loja.total)}</p>}
                      </div>
                    ))}
                    {!isVendedor && (
                      <div className="flex justify-between items-center bg-gold/10 border border-gold-muted rounded-lg px-2.5 py-2">
                        <p className="text-xs font-bold text-gold">Total Geral</p>
                        <p className="text-xs font-bold text-gold">{formatCurrency(vendasRelatorio.reduce((a, v) => a + v.total, 0))}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {!isVendedor && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-surface-overlay rounded-lg p-2 text-center">
                    <p className="text-[9px] text-muted-foreground">Total</p>
                    <p className="text-xs font-bold text-gold">{formatCurrency(vendasRelatorio.reduce((a, v) => a + v.total, 0))}</p>
                  </div>
                  <div className="bg-surface-overlay rounded-lg p-2 text-center">
                    <p className="text-[9px] text-muted-foreground">Descontos</p>
                    <p className="text-xs font-bold text-destructive">-{formatCurrency(relatorio.totalDesconto)}</p>
                  </div>
                  <div className="bg-surface-overlay rounded-lg p-2 text-center">
                    <p className="text-[9px] text-muted-foreground">Acréscimos</p>
                    <p className="text-xs font-bold text-emerald-400">+{formatCurrency(relatorio.totalAcrescimo)}</p>
                  </div>
                </div>
              )}

              <div>
                <p className="text-[11px] font-semibold text-foreground mb-2">Produtos Vendidos</p>
                <div className="space-y-1.5">
                  {Object.values(relatorio.porProduto).sort((a, b) => b.qtd - a.qtd).map((item) => (
                    <div key={item.nome} className="flex justify-between items-center bg-surface-overlay rounded-lg px-2.5 py-1.5">
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
                    <div key={nome} className="bg-surface-overlay rounded-lg px-2.5 py-2">
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
                    <div key={tipo} className="flex justify-between items-center bg-surface-overlay rounded-lg px-2.5 py-1.5">
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
                      <div key={band} className="flex justify-between items-center bg-surface-overlay rounded-lg px-2.5 py-1.5">
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

      {/* Formulário lançar venda */}
      {showForm && (
        <div className="mx-4 mb-4 bg-surface border border-gold-muted rounded-xl p-4 animate-fade-in"
          style={{ boxShadow: "var(--shadow-gold)" }}>
          <h3 className="font-display text-base text-gold mb-3">Nova Venda</h3>
          <div className="space-y-3">
            <div>
              <label className="text-[11px] text-muted-foreground mb-1 block">Perfume</label>
              <select value={form.perfumeId} onChange={(e) => setForm({ ...form, perfumeId: e.target.value, ajuste: 0 })}
                className="w-full bg-surface-overlay border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-gold-muted">
                <option value="">Selecione...</option>
                {perfumes.map((p) => <option key={p.id} value={p.id}>{p.marca} - {p.nome} - {p.concentracao} - {p.volume}ml</option>)}
              </select>
              {perfumeSelecionado && (
                <div className="flex gap-2 mt-1.5">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-surface-overlay border border-border text-muted-foreground">{perfumeSelecionado.concentracao}</span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-surface-overlay border border-border text-muted-foreground">{perfumeSelecionado.volume} ml</span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-surface-overlay border border-border text-muted-foreground">{perfumeSelecionado.marca}</span>
                </div>
              )}
            </div>

            <div>
              <label className="text-[11px] text-muted-foreground mb-1 block">Vendedora</label>
              <div className="grid grid-cols-4 gap-1.5">
                {vendedoras.map((v) => (
                  <button key={v} onClick={() => setForm({ ...form, vendedora: v })}
                    className={`py-2 rounded-lg text-xs font-medium border transition-all ${form.vendedora === v ? "border-gold bg-gold/15 text-gold" : "border-border bg-surface-overlay text-muted-foreground"}`}>
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">Depósito</label>
                <select value={form.deposito} onChange={(e) => setForm({ ...form, deposito: e.target.value as Deposito })}
                  className="w-full bg-surface-overlay border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-gold-muted">
                  <option value="">Selecione...</option>
                  {depositos.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">Quantidade</label>
                <input type="number" min={1} value={form.quantidade}
                  onChange={(e) => setForm({ ...form, quantidade: parseInt(e.target.value) || 1 })}
                  className="w-full bg-surface-overlay border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-gold-muted" />
              </div>
            </div>

            <div>
              <label className="text-[11px] text-muted-foreground mb-1 block flex items-center gap-1"><CreditCard size={10} />Pagamento</label>
              <div className="grid grid-cols-4 gap-1.5">
                {tiposPagamento.map((tp) => (
                  <button key={tp} onClick={() => setForm({ ...form, tipoPagamento: tp, bandeira: "N/A" })}
                    className={`py-2 rounded-lg text-xs font-medium border transition-all ${form.tipoPagamento === tp ? "border-gold bg-gold/15 text-gold" : "border-border bg-surface-overlay text-muted-foreground"}`}>
                    {tp}
                  </button>
                ))}
              </div>
              {(form.tipoPagamento === "Crédito" || form.tipoPagamento === "Débito") && (
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {bandeiras.map((b) => (
                    <button key={b} onClick={() => setForm({ ...form, bandeira: b })}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${form.bandeira === b ? "border-gold bg-gold/15 text-gold" : "border-border bg-surface-overlay text-muted-foreground"}`}>
                      {b}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="text-[11px] text-muted-foreground mb-1 block flex items-center gap-1"><Tag size={10} />Ajuste de Valor</label>
              <div className="flex gap-2">
                <div className="flex rounded-lg overflow-hidden border border-border">
                  <button onClick={() => setForm({ ...form, tipoAjuste: "desconto", ajuste: 0 })}
                    className={`px-2.5 py-2 text-xs font-medium transition-all ${form.tipoAjuste === "desconto" ? "bg-destructive/20 text-destructive" : "bg-surface-overlay text-muted-foreground"}`}>
                    Desc.
                  </button>
                  <button onClick={() => setForm({ ...form, tipoAjuste: "acrescimo", ajuste: 0 })}
                    className={`px-2.5 py-2 text-xs font-medium transition-all ${form.tipoAjuste === "acrescimo" ? "bg-emerald-500/20 text-emerald-400" : "bg-surface-overlay text-muted-foreground"}`}>
                    Acrés.
                  </button>
                </div>
                <div className="flex rounded-lg overflow-hidden border border-border">
                  <button onClick={() => setForm({ ...form, tipoCalculo: "valor", ajuste: 0 })}
                    className={`px-3 py-2 text-xs font-medium transition-all ${form.tipoCalculo === "valor" ? "bg-gold/20 text-gold" : "bg-surface-overlay text-muted-foreground"}`}>
                    R$
                  </button>
                  <button onClick={() => setForm({ ...form, tipoCalculo: "percent", ajuste: 0 })}
                    className={`px-3 py-2 text-xs font-medium transition-all ${form.tipoCalculo === "percent" ? "bg-gold/20 text-gold" : "bg-surface-overlay text-muted-foreground"}`}>
                    %
                  </button>
                </div>
                <input type="number" min={0} max={form.tipoCalculo === "percent" ? 100 : subtotal}
                  value={form.ajuste} onChange={(e) => setForm({ ...form, ajuste: parseFloat(e.target.value) || 0 })}
                  placeholder={form.tipoCalculo === "percent" ? "Ex: 10" : "Ex: 50"}
                  className="flex-1 bg-surface-overlay border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold-muted" />
              </div>
            </div>

            <div>
              <label className="text-[11px] text-muted-foreground mb-1 block flex items-center gap-1"><FileText size={10} />Observação</label>
              <input type="text" value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })}
                placeholder="Ex: cliente fidelidade, negociação especial..."
                className="w-full bg-surface-overlay border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold-muted" />
            </div>

            {perfumeSelecionado && (
              <div className="bg-gold/10 border border-gold-muted rounded-lg p-3 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="text-foreground">{formatCurrency(subtotal)}</span>
                </div>
                {ajusteCalculado > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{form.tipoAjuste === "desconto" ? "Desconto" : "Acréscimo"}</span>
                    <span className={form.tipoAjuste === "desconto" ? "text-destructive" : "text-emerald-400"}>
                      {form.tipoAjuste === "desconto" ? "- " : "+ "}{formatCurrency(ajusteCalculado)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold border-t border-gold-muted pt-1 mt-1">
                  <span className="text-gold">Total</span>
                  <span className="text-gold">{formatCurrency(totalFinal)}</span>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 rounded-xl text-sm border border-border text-muted-foreground">
                Cancelar
              </button>
              <button onClick={handleLancar}
                disabled={!form.perfumeId || !form.deposito || !form.vendedora || !form.tipoPagamento}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-primary-foreground disabled:opacity-40 transition-all"
                style={{ background: "var(--gradient-gold)" }}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {temFiltroAtivo && (
        <div className="mx-4 mb-3 bg-surface border border-border rounded-xl p-3 flex justify-between items-center">
          <p className="text-xs text-muted-foreground">Total filtrado ({filtradas.length} vendas)</p>
          {!isVendedor && <p className="text-sm font-bold text-gold">{formatCurrency(totalFiltrado.valor)}</p>}
        </div>
      )}

      {/* Lista */}
      <div className="px-4 space-y-2">
        {filtradas.map((v) => {
          const pf = perfumes.find((p) => p.id === v.perfumeId);
          return (
            <div key={v.id} className="bg-surface border border-border rounded-xl p-3.5"
              style={{ boxShadow: "0 2px 8px hsl(0 0% 0% / 0.3)" }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gold/10 border border-gold-muted flex items-center justify-center flex-shrink-0">
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
                <div className="flex items-center gap-2">
                  {!isVendedor && (
                    <div className="text-right">
                      <p className="text-sm font-bold text-gold">{formatCurrency(v.total)}</p>
                      <p className="text-[10px] text-muted-foreground">{formatCurrency(v.precoUnitario)}/un</p>
                    </div>
                  )}
                  {isMaster && (
                    <button onClick={() => handleExcluirVenda(v.id)}
                      className="p-2 rounded-lg text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-1 mt-2 pt-2 border-t border-border">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1">
                    <User size={10} className="text-muted-foreground" />
                    <p className="text-[11px] text-muted-foreground">{v.vendedora}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <CreditCard size={10} className="text-muted-foreground" />
                    <p className="text-[11px] text-muted-foreground">
                      {v.tipoPagamento}{v.bandeira !== "N/A" ? ` · ${v.bandeira}` : ""}
                    </p>
                  </div>
                  {v.registradoPor && (
                    <p className="text-[10px] text-muted-foreground">Reg: {v.registradoPor}</p>
                  )}
                </div>
                {v.desconto > 0 && !isVendedor && (
                  <div className="flex items-center gap-1">
                    <Tag size={10} className={v.tipoAjuste === "desconto" ? "text-destructive" : "text-emerald-400"} />
                    <p className={`text-[11px] ${v.tipoAjuste === "desconto" ? "text-destructive" : "text-emerald-400"}`}>
                      {v.tipoAjuste === "desconto" ? "-" : "+"}{formatCurrency(v.desconto)}
                    </p>
                  </div>
                )}
              </div>
              {v.observacao && (
                <p className="text-[10px] text-muted-foreground mt-1 italic">"{v.observacao}"</p>
              )}
            </div>
          );
        })}
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
