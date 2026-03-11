import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  Search, Plus, Minus, Trash2, ShoppingCart, CreditCard, X,
  Package, Barcode, CheckCircle2, ArrowLeft, Receipt, DollarSign,
  Percent, Tag, Store, User, MessageSquare, Loader2, Calculator
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import {
  formatCurrency, type Deposito, type Venda,
  type TipoPagamento, type Bandeira, type TipoAjusteValor, type Perfume
} from "@/data/mockData";
import type { VendaPagamento } from "@/hooks/useVendas";
import { getHojeManaus } from "@/lib/dateUtils";

const depositos: Deposito[] = ["Casa", "Sumaúma", "Amazonas"];
const tiposPagamento: TipoPagamento[] = ["Dinheiro", "Pix", "Débito", "Crédito", "Conta Assinada"];
const bandeiras: Bandeira[] = ["Visa", "Mastercard", "Elo", "Amex", "Hipercard"];

interface CartItem {
  perfumeId: string;
  perfumeNome: string;
  marca: string;
  codigo: string;
  deposito: Deposito;
  quantidade: number;
  precoUnitario: number;
  estoqueDisponivel: number;
}

interface PagamentoItem {
  tipoPagamento: TipoPagamento;
  bandeira: Bandeira;
  valor: number;
  observacao?: string;
}

export default function PDV({ onBack }: { onBack?: () => void }) {
  const {
    perfumes, baixarEstoque, adicionarVendaMulti, excluirVenda,
    vendedoras: vendedorasCtx
  } = useApp();
  const { role, profile } = useAuth();
  const isMaster = role === "master";
  const isVendedor = role === "vendedor";
  const userLoja = (isVendedor && profile?.loja) ? profile.loja as Deposito : null;
  const vendedoras = [...vendedorasCtx, "Outra"];

  // Search
  const [busca, setBusca] = useState("");
  const [buscaFocused, setBuscaFocused] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const [deposito, setDeposito] = useState<Deposito>(userLoja || "Casa");
  const [vendedora, setVendedora] = useState("");
  const [observacao, setObservacao] = useState("");

  // Adjustment
  const [tipoAjuste, setTipoAjuste] = useState<TipoAjusteValor>("desconto");
  const [ajusteMode, setAjusteMode] = useState<"%" | "R$">("%");
  const [ajusteValor, setAjusteValor] = useState(0);

  // Payment
  const [showPagamento, setShowPagamento] = useState(false);
  const [pagamentos, setPagamentos] = useState<PagamentoItem[]>([]);
  const [troco, setTroco] = useState(0);
  const [isFinalizando, setIsFinalizando] = useState(false);
  const [vendaConcluida, setVendaConcluida] = useState(false);

  // Keyboard shortcut: focus search with F2
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "F2") { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === "F9") { e.preventDefault(); if (cart.length > 0) setShowPagamento(true); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [cart.length]);

  // Search results
  const resultadosBusca = useMemo(() => {
    if (!busca.trim()) return [];
    const q = busca.toLowerCase();
    return perfumes
      .filter(p => {
        const totalEstoque = p.estoques[deposito] || 0;
        return (
          (p.nome.toLowerCase().includes(q) ||
          p.codigo.toLowerCase().includes(q) ||
          p.marca.toLowerCase().includes(q)) &&
          totalEstoque > 0
        );
      })
      .slice(0, 8);
  }, [busca, perfumes, deposito]);

  // Cart totals
  const subtotal = useMemo(() => cart.reduce((s, i) => s + i.precoUnitario * i.quantidade, 0), [cart]);
  const totalItens = useMemo(() => cart.reduce((s, i) => s + i.quantidade, 0), [cart]);

  const valorAjuste = useMemo(() => {
    if (ajusteValor <= 0) return 0;
    if (ajusteMode === "%") return subtotal * (ajusteValor / 100);
    return ajusteValor;
  }, [subtotal, ajusteValor, ajusteMode]);

  const totalFinal = useMemo(() => {
    if (tipoAjuste === "desconto") return Math.max(0, subtotal - valorAjuste);
    return subtotal + valorAjuste;
  }, [subtotal, valorAjuste, tipoAjuste]);

  const totalPagamentos = useMemo(() => pagamentos.reduce((s, p) => s + p.valor, 0), [pagamentos]);
  const restante = totalFinal - totalPagamentos;

  // Add item to cart
  const addToCart = useCallback((p: Perfume) => {
    const estoque = p.estoques[deposito] || 0;
    const existing = cart.find(i => i.perfumeId === p.id);
    if (existing) {
      if (existing.quantidade >= estoque) return;
      setCart(prev => prev.map(i => i.perfumeId === p.id ? { ...i, quantidade: i.quantidade + 1 } : i));
    } else {
      setCart(prev => [...prev, {
        perfumeId: p.id,
        perfumeNome: p.nome,
        marca: p.marca,
        codigo: p.codigo,
        deposito,
        quantidade: 1,
        precoUnitario: p.precoVenda,
        estoqueDisponivel: estoque,
      }]);
    }
    setBusca("");
    searchRef.current?.focus();
  }, [cart, deposito]);

  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.perfumeId !== id) return i;
      const novaQtd = Math.max(1, Math.min(i.estoqueDisponivel, i.quantidade + delta));
      return { ...i, quantidade: novaQtd };
    }));
  };

  const removeItem = (id: string) => {
    setCart(prev => prev.filter(i => i.perfumeId !== id));
  };

  // Payment
  const addPagamento = () => {
    const valorRestante = Math.max(0, Number((totalFinal - totalPagamentos).toFixed(2)));
    setPagamentos(prev => [...prev, {
      tipoPagamento: "Pix",
      bandeira: "N/A" as Bandeira,
      valor: valorRestante,
    }]);
  };

  const updatePagamento = (idx: number, updates: Partial<PagamentoItem>) => {
    setPagamentos(prev => prev.map((p, i) => i === idx ? { ...p, ...updates } : p));
  };

  const removePagamento = (idx: number) => {
    setPagamentos(prev => prev.filter((_, i) => i !== idx));
  };

  // Finalize sale
  const finalizarVenda = async () => {
    if (isFinalizando || cart.length === 0 || !vendedora) return;
    if (restante > 0.01) return;
    setIsFinalizando(true);

    try {
      const hoje = getHojeManaus();
      const registradoPor = profile?.nome || "";

      // Distribute adjustment proportionally
      const itens: Venda[] = cart.map(item => {
        const proporcao = subtotal > 0 ? (item.precoUnitario * item.quantidade) / subtotal : 1 / cart.length;
        const ajusteItem = valorAjuste * proporcao;
        let totalItem = item.precoUnitario * item.quantidade;
        if (tipoAjuste === "desconto") totalItem -= ajusteItem;
        else totalItem += ajusteItem;

        return {
          id: "",
          data: hoje,
          perfumeId: item.perfumeId,
          perfumeNome: item.perfumeNome,
          deposito: item.deposito,
          quantidade: item.quantidade,
          precoUnitario: item.precoUnitario,
          tipoAjuste,
          desconto: ajusteItem,
          total: Math.max(0, totalItem),
          vendedora,
          tipoPagamento: pagamentos[0]?.tipoPagamento || "Pix",
          bandeira: pagamentos[0]?.bandeira || ("N/A" as Bandeira),
          observacao: observacao,
          registradoPor,
          grupoVenda: "",
        };
      });

      const pagamentosVenda: Omit<VendaPagamento, "id">[] = pagamentos.map(p => ({
        grupoVenda: "",
        tipoPagamento: p.tipoPagamento,
        bandeira: p.bandeira,
        valor: p.valor,
      }));

      await adicionarVendaMulti({ itens, pagamentosVenda });

      // Lower stock
      for (const item of cart) {
        baixarEstoque(item.perfumeId, item.deposito, item.quantidade);
      }

      // Calculate change for cash
      const dinheiroTotal = pagamentos
        .filter(p => p.tipoPagamento === "Dinheiro")
        .reduce((s, p) => s + p.valor, 0);
      if (dinheiroTotal > totalFinal) {
        setTroco(dinheiroTotal - totalFinal);
      }

      setVendaConcluida(true);
    } catch (err) {
      console.error("Erro ao finalizar venda:", err);
    } finally {
      setIsFinalizando(false);
    }
  };

  const novaVenda = () => {
    setCart([]);
    setBusca("");
    setVendedora("");
    setObservacao("");
    setAjusteValor(0);
    setPagamentos([]);
    setShowPagamento(false);
    setVendaConcluida(false);
    setTroco(0);
    searchRef.current?.focus();
  };

  // Success screen
  if (vendaConcluida) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: "hsl(var(--background))" }}>
        <div className="text-center space-y-6 animate-fade-in">
          <div className="w-24 h-24 rounded-full mx-auto flex items-center justify-center" style={{ background: "hsl(var(--success) / 0.15)" }}>
            <CheckCircle2 size={48} className="text-success" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Venda concluída!</h1>
            <p className="text-muted-foreground mt-2">Estoque atualizado automaticamente.</p>
          </div>
          <div className="text-2xl font-bold text-gold">{formatCurrency(totalFinal)}</div>
          {troco > 0 && (
            <div className="px-6 py-3 rounded-xl mx-auto inline-block" style={{ background: "hsl(var(--warning) / 0.15)" }}>
              <span className="text-sm text-muted-foreground">Troco: </span>
              <span className="text-lg font-bold" style={{ color: "hsl(var(--warning))" }}>{formatCurrency(troco)}</span>
            </div>
          )}
          <div className="flex gap-3 justify-center pt-4">
            <button onClick={novaVenda} className="btn-primary px-8 py-3 text-sm font-semibold">
              Nova Venda (F2)
            </button>
            {onBack && (
              <button onClick={onBack} className="btn-secondary px-6 py-3 text-sm">
                Voltar ao ERP
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col" style={{ background: "hsl(var(--background))" }}>
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 md:px-6 py-3 flex-shrink-0" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-all">
              <ArrowLeft size={20} />
            </button>
          )}
          <div className="flex items-center gap-2">
            <Receipt size={22} className="text-gold" />
            <h1 className="text-lg font-bold text-foreground tracking-tight">PDV</h1>
          </div>
          <span className="text-xs text-muted-foreground hidden md:inline">Le Jess Perfumes</span>
        </div>

        <div className="flex items-center gap-4">
          {/* Store selector */}
          {!userLoja && (
            <div className="flex items-center gap-2">
              <Store size={14} className="text-muted-foreground" />
              <div className="flex gap-1">
                {depositos.map(d => (
                  <button
                    key={d}
                    onClick={() => {
                      setDeposito(d);
                      // Update cart stock levels
                      setCart(prev => prev.map(item => {
                        const p = perfumes.find(x => x.id === item.perfumeId);
                        return { ...item, deposito: d, estoqueDisponivel: p?.estoques[d] || 0 };
                      }));
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      deposito === d
                        ? "text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    style={deposito === d ? { background: "hsl(var(--gold))" } : { background: "hsl(var(--surface-raised))" }}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Operator */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <User size={14} />
            <span>{profile?.nome || "Operador"}</span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT: Products + Cart */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Search bar */}
          <div className="px-4 md:px-6 py-4">
            <div className="relative">
              <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={searchRef}
                type="text"
                value={busca}
                onChange={e => setBusca(e.target.value)}
                onFocus={() => setBuscaFocused(true)}
                onBlur={() => setTimeout(() => setBuscaFocused(false), 200)}
                placeholder="Buscar por nome, código, marca... (F2)"
                className="w-full pl-12 pr-4 py-3.5 rounded-xl text-sm bg-surface-raised border border-transparent focus:border-gold/30 focus:ring-1 focus:ring-gold/20 text-foreground placeholder:text-muted-foreground outline-none transition-all"
                style={{ background: "hsl(var(--surface-raised))" }}
                autoFocus
              />
              {busca && (
                <button onClick={() => setBusca("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Search results dropdown */}
            {busca.trim() && buscaFocused && (
              <div className="absolute left-4 right-4 md:left-6 md:right-auto md:w-[calc(100%-420px)] mt-1 rounded-xl overflow-hidden z-50 max-h-[400px] overflow-y-auto"
                style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", boxShadow: "var(--shadow-elevated)" }}>
                {resultadosBusca.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground">Nenhum produto encontrado</div>
                ) : (
                  resultadosBusca.map(p => {
                    const estoque = p.estoques[deposito] || 0;
                    return (
                      <button
                        key={p.id}
                        onMouseDown={() => addToCart(p)}
                        className="w-full flex items-center gap-4 px-4 py-3 hover:bg-surface-raised transition-colors text-left"
                      >
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "hsl(var(--surface-raised))" }}>
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt="" className="w-full h-full object-cover rounded-lg" />
                          ) : (
                            <Package size={18} className="text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{p.nome}</p>
                          <p className="text-xs text-muted-foreground">{p.marca} · {p.codigo}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold text-gold">{formatCurrency(p.precoVenda)}</p>
                          <p className="text-[10px] text-muted-foreground">{estoque} em estoque</p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Cart items */}
          <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-4">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-20 opacity-50">
                <ShoppingCart size={56} className="text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">Carrinho vazio</p>
                <p className="text-xs text-muted-foreground mt-1">Busque um produto para iniciar a venda</p>
              </div>
            ) : (
              <div className="space-y-2">
                {cart.map((item, idx) => (
                  <div key={item.perfumeId} className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all hover:bg-surface-raised/50"
                    style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}>
                    <span className="text-xs text-muted-foreground w-6 text-center font-mono">{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{item.perfumeNome}</p>
                      <p className="text-xs text-muted-foreground">{item.marca} · {item.codigo}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateQty(item.perfumeId, -1)} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-all">
                        <Minus size={14} />
                      </button>
                      <span className="w-8 text-center text-sm font-bold text-foreground">{item.quantidade}</span>
                      <button onClick={() => updateQty(item.perfumeId, 1)} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-all">
                        <Plus size={14} />
                      </button>
                    </div>
                    <div className="text-right w-24">
                      <p className="text-sm font-bold text-foreground">{formatCurrency(item.precoUnitario * item.quantidade)}</p>
                      <p className="text-[10px] text-muted-foreground">{formatCurrency(item.precoUnitario)} un.</p>
                    </div>
                    <button onClick={() => removeItem(item.perfumeId)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Payment panel */}
        <aside className="w-[360px] flex-shrink-0 flex flex-col overflow-y-auto hidden md:flex"
          style={{ background: "hsl(var(--card))", borderLeft: "1px solid hsl(var(--border))" }}>
          <div className="p-5 space-y-5 flex-1">
            {/* Seller */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">Vendedora</label>
              <div className="flex flex-wrap gap-1.5">
                {vendedoras.map(v => (
                  <button
                    key={v}
                    onClick={() => setVendedora(v)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      vendedora === v
                        ? "text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    style={vendedora === v ? { background: "hsl(var(--gold))" } : { background: "hsl(var(--surface-raised))" }}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Observation */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Observação</label>
              <textarea
                value={observacao}
                onChange={e => setObservacao(e.target.value)}
                placeholder="Notas da venda..."
                rows={2}
                className="w-full px-3 py-2 rounded-lg text-xs resize-none text-foreground placeholder:text-muted-foreground outline-none transition-all border border-transparent focus:border-gold/30"
                style={{ background: "hsl(var(--surface-raised))" }}
              />
            </div>

            {/* Adjustment */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">Ajuste no total</label>
              <div className="flex gap-1.5 mb-2">
                <button
                  onClick={() => setTipoAjuste("desconto")}
                  className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${tipoAjuste === "desconto" ? "text-primary-foreground" : "text-muted-foreground"}`}
                  style={tipoAjuste === "desconto" ? { background: "hsl(var(--gold))" } : { background: "hsl(var(--surface-raised))" }}
                >
                  Desconto
                </button>
                <button
                  onClick={() => setTipoAjuste("acrescimo")}
                  className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${tipoAjuste === "acrescimo" ? "text-primary-foreground" : "text-muted-foreground"}`}
                  style={tipoAjuste === "acrescimo" ? { background: "hsl(var(--gold))" } : { background: "hsl(var(--surface-raised))" }}
                >
                  Acréscimo
                </button>
              </div>
              <div className="flex gap-2">
                <div className="flex rounded-lg overflow-hidden" style={{ background: "hsl(var(--surface-raised))" }}>
                  <button onClick={() => setAjusteMode("%")} className={`px-3 py-1.5 text-xs font-medium transition-all ${ajusteMode === "%" ? "text-gold" : "text-muted-foreground"}`}>%</button>
                  <button onClick={() => setAjusteMode("R$")} className={`px-3 py-1.5 text-xs font-medium transition-all ${ajusteMode === "R$" ? "text-gold" : "text-muted-foreground"}`}>R$</button>
                </div>
                <input
                  type="number"
                  min={0}
                  value={ajusteValor || ""}
                  onChange={e => setAjusteValor(Number(e.target.value))}
                  placeholder="0"
                  className="flex-1 px-3 py-1.5 rounded-lg text-xs text-foreground placeholder:text-muted-foreground outline-none border border-transparent focus:border-gold/30"
                  style={{ background: "hsl(var(--surface-raised))" }}
                />
              </div>
            </div>

            {/* Payments */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-muted-foreground">Pagamentos</label>
                <button onClick={addPagamento} className="text-xs text-gold hover:text-gold-light transition-colors flex items-center gap-1">
                  <Plus size={12} /> Adicionar
                </button>
              </div>
              <div className="space-y-2">
                {pagamentos.map((pag, idx) => (
                  <div key={idx} className="rounded-lg p-3 space-y-2" style={{ background: "hsl(var(--surface-raised))" }}>
                    <div className="flex gap-2">
                      <select
                        value={pag.tipoPagamento}
                        onChange={e => updatePagamento(idx, {
                          tipoPagamento: e.target.value as TipoPagamento,
                          bandeira: ["Débito", "Crédito"].includes(e.target.value) ? "Visa" : "N/A" as Bandeira,
                        })}
                        className="flex-1 px-2 py-1.5 rounded-lg text-xs text-foreground outline-none"
                        style={{ background: "hsl(var(--background))" }}
                      >
                        {tiposPagamento.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={pag.valor || ""}
                        onChange={e => updatePagamento(idx, { valor: Number(e.target.value) })}
                        className="w-24 px-2 py-1.5 rounded-lg text-xs text-foreground text-right outline-none"
                        style={{ background: "hsl(var(--background))" }}
                        placeholder="R$ 0,00"
                      />
                      <button onClick={() => removePagamento(idx)} className="text-muted-foreground hover:text-destructive transition-colors">
                        <X size={14} />
                      </button>
                    </div>
                    {["Débito", "Crédito"].includes(pag.tipoPagamento) && (
                      <select
                        value={pag.bandeira}
                        onChange={e => updatePagamento(idx, { bandeira: e.target.value as Bandeira })}
                        className="w-full px-2 py-1.5 rounded-lg text-xs text-foreground outline-none"
                        style={{ background: "hsl(var(--background))" }}
                      >
                        {bandeiras.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    )}
                    {pag.tipoPagamento === "Conta Assinada" && (
                      <input
                        type="text"
                        placeholder="Nome do funcionário / observação"
                        value={pag.observacao || ""}
                        onChange={e => updatePagamento(idx, { observacao: e.target.value })}
                        className="w-full px-2 py-1.5 rounded-lg text-xs text-foreground placeholder:text-muted-foreground outline-none"
                        style={{ background: "hsl(var(--background))" }}
                      />
                    )}
                  </div>
                ))}
                {pagamentos.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-3">Adicione uma forma de pagamento</p>
                )}
              </div>
            </div>
          </div>

          {/* Totals + CTA */}
          <div className="p-5 space-y-3 flex-shrink-0" style={{ borderTop: "1px solid hsl(var(--border))" }}>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Subtotal ({totalItens} {totalItens === 1 ? "item" : "itens"})</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {valorAjuste > 0 && (
                <div className="flex justify-between text-xs">
                  <span className={tipoAjuste === "desconto" ? "text-success" : "text-warning"}>{tipoAjuste === "desconto" ? "Desconto" : "Acréscimo"}</span>
                  <span className={tipoAjuste === "desconto" ? "text-success" : "text-warning"}>
                    {tipoAjuste === "desconto" ? "-" : "+"}{formatCurrency(valorAjuste)}
                  </span>
                </div>
              )}
              {totalPagamentos > 0 && restante > 0.01 && (
                <div className="flex justify-between text-xs text-warning">
                  <span>Restante</span>
                  <span>{formatCurrency(restante)}</span>
                </div>
              )}
            </div>
            <div className="flex justify-between items-baseline pt-2" style={{ borderTop: "1px solid hsl(var(--border))" }}>
              <span className="text-sm font-medium text-foreground">Total</span>
              <span className="text-2xl font-bold text-gold">{formatCurrency(totalFinal)}</span>
            </div>

            <button
              onClick={finalizarVenda}
              disabled={cart.length === 0 || !vendedora || restante > 0.01 || isFinalizando}
              className="w-full py-4 rounded-xl text-sm font-bold transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{
                background: cart.length > 0 && vendedora && restante <= 0.01
                  ? "var(--gradient-gold)"
                  : "hsl(var(--muted))",
                color: cart.length > 0 && vendedora && restante <= 0.01
                  ? "hsl(var(--primary-foreground))"
                  : "hsl(var(--muted-foreground))",
                boxShadow: cart.length > 0 && vendedora && restante <= 0.01
                  ? "var(--shadow-gold)"
                  : "none",
              }}
            >
              {isFinalizando ? (
                <><Loader2 size={18} className="animate-spin" /> Finalizando...</>
              ) : (
                <><CheckCircle2 size={18} /> Finalizar Venda (F9)</>
              )}
            </button>

            {!vendedora && cart.length > 0 && (
              <p className="text-[10px] text-center text-warning">Selecione uma vendedora para finalizar</p>
            )}
          </div>
        </aside>
      </div>

      {/* Mobile: floating cart summary */}
      {cart.length > 0 && !showPagamento && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 p-4 z-50" style={{ background: "hsl(var(--card))", borderTop: "1px solid hsl(var(--border))" }}>
          <button
            onClick={() => setShowPagamento(true)}
            className="w-full py-4 rounded-xl text-sm font-bold flex items-center justify-between px-6"
            style={{ background: "var(--gradient-gold)", color: "hsl(var(--primary-foreground))" }}
          >
            <span className="flex items-center gap-2">
              <ShoppingCart size={18} />
              {totalItens} {totalItens === 1 ? "item" : "itens"}
            </span>
            <span>{formatCurrency(totalFinal)}</span>
          </button>
        </div>
      )}

      {/* Mobile: payment sheet */}
      {showPagamento && (
        <div className="md:hidden fixed inset-0 z-[110] flex flex-col" style={{ background: "hsl(var(--background))" }}>
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
            <button onClick={() => setShowPagamento(false)} className="p-2 text-muted-foreground">
              <ArrowLeft size={20} />
            </button>
            <h2 className="text-sm font-bold text-foreground">Pagamento</h2>
            <div className="w-9" />
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Same payment UI as desktop sidebar — vendedora, observation, adjustment, payments */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">Vendedora</label>
              <div className="flex flex-wrap gap-1.5">
                {vendedoras.map(v => (
                  <button key={v} onClick={() => setVendedora(v)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${vendedora === v ? "text-primary-foreground" : "text-muted-foreground"}`}
                    style={vendedora === v ? { background: "hsl(var(--gold))" } : { background: "hsl(var(--surface-raised))" }}
                  >{v}</button>
                ))}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-muted-foreground">Pagamentos</label>
                <button onClick={addPagamento} className="text-xs text-gold flex items-center gap-1"><Plus size={12} /> Adicionar</button>
              </div>
              {pagamentos.map((pag, idx) => (
                <div key={idx} className="rounded-lg p-3 space-y-2 mb-2" style={{ background: "hsl(var(--surface-raised))" }}>
                  <div className="flex gap-2">
                    <select value={pag.tipoPagamento} onChange={e => updatePagamento(idx, { tipoPagamento: e.target.value as TipoPagamento, bandeira: ["Débito", "Crédito"].includes(e.target.value) ? "Visa" : "N/A" as Bandeira })}
                      className="flex-1 px-2 py-1.5 rounded-lg text-xs text-foreground outline-none" style={{ background: "hsl(var(--background))" }}>
                      {tiposPagamento.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <input type="number" min={0} step={0.01} value={pag.valor || ""} onChange={e => updatePagamento(idx, { valor: Number(e.target.value) })}
                      className="w-24 px-2 py-1.5 rounded-lg text-xs text-foreground text-right outline-none" style={{ background: "hsl(var(--background))" }} />
                    <button onClick={() => removePagamento(idx)} className="text-muted-foreground hover:text-destructive"><X size={14} /></button>
                  </div>
                  {["Débito", "Crédito"].includes(pag.tipoPagamento) && (
                    <select value={pag.bandeira} onChange={e => updatePagamento(idx, { bandeira: e.target.value as Bandeira })}
                      className="w-full px-2 py-1.5 rounded-lg text-xs text-foreground outline-none" style={{ background: "hsl(var(--background))" }}>
                      {bandeiras.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  )}
                  {pag.tipoPagamento === "Conta Assinada" && (
                    <input type="text" placeholder="Nome do funcionário" value={pag.observacao || ""} onChange={e => updatePagamento(idx, { observacao: e.target.value })}
                      className="w-full px-2 py-1.5 rounded-lg text-xs text-foreground placeholder:text-muted-foreground outline-none" style={{ background: "hsl(var(--background))" }} />
                  )}
                </div>
              ))}
              {pagamentos.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Adicione uma forma de pagamento</p>}
            </div>
          </div>
          <div className="p-4 space-y-3" style={{ borderTop: "1px solid hsl(var(--border))" }}>
            <div className="flex justify-between items-baseline">
              <span className="text-sm text-foreground">Total</span>
              <span className="text-2xl font-bold text-gold">{formatCurrency(totalFinal)}</span>
            </div>
            {restante > 0.01 && <p className="text-xs text-warning text-center">Faltam {formatCurrency(restante)}</p>}
            <button onClick={finalizarVenda} disabled={!vendedora || restante > 0.01 || isFinalizando}
              className="w-full py-4 rounded-xl text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2"
              style={{ background: "var(--gradient-gold)", color: "hsl(var(--primary-foreground))" }}>
              {isFinalizando ? <><Loader2 size={18} className="animate-spin" /> Finalizando...</> : <><CheckCircle2 size={18} /> Finalizar Venda</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
