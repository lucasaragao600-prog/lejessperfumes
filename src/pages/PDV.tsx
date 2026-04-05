import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  Search, Plus, Minus, Trash2, ShoppingCart, X,
  Package, CheckCircle2, ArrowLeft, Receipt, DollarSign,
  Percent, Store, User, Loader2, UserPlus, FileText,
  CreditCard, Banknote, QrCode, BookOpen, ChevronDown,
  Printer, Eye, AlertTriangle, Lock
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import {
  formatCurrency, type Deposito, type Venda,
  type TipoPagamento, type Bandeira, type TipoAjusteValor, type Perfume
} from "@/data/mockData";
import type { VendaPagamento } from "@/hooks/useVendas";
import { useClientes, type Cliente } from "@/hooks/useClientes";
import { getHojeManaus } from "@/lib/dateUtils";
import { ComprovantePreview, type ComprovanteData } from "@/components/ComprovantePrint";
import { useNfce } from "@/hooks/useNfce";
import { useCaixa } from "@/hooks/useCaixa";

const depositos: Deposito[] = ["Casa", "Sumaúma", "Amazonas"];
const tiposPagamento: TipoPagamento[] = ["Dinheiro", "Pix", "Débito", "Crédito", "Conta Assinada"];
const bandeiras: Bandeira[] = ["Visa", "Mastercard", "Elo", "Amex", "Hipercard"];

interface CartItem {
  perfumeId: string;
  perfumeNome: string;
  marca: string;
  codigo: string;
  volume: number;
  concentracao: string;
  casaSigla: string;
  imageUrl: string;
  deposito: Deposito;
  quantidade: number;
  precoUnitario: number;
  estoqueDisponivel: number;
}

interface PagamentoItem {
  tipoPagamento: TipoPagamento;
  bandeira: Bandeira;
  valor: number;
  parcelas: number;
  valorParcela: number;
  observacao?: string;
}

type TipoDocumento = "comprovante" | "nfce";

export default function PDV({ onBack }: { onBack?: () => void }) {
  const {
    perfumes, baixarEstoque, adicionarVendaMulti,
    vendedoras: vendedorasCtx, concentracoesConfig
  } = useApp();
  const { role, profile, user } = useAuth();
  const isMaster = role === "master";
  const isVendedor = role === "vendedor";
  const userLoja = (isVendedor && profile?.loja) ? profile.loja as Deposito : null;
  const vendedoras = [...vendedorasCtx, "Outra"];
  const { clientes, adicionarCliente } = useClientes();
  const { configFiscal, criarEmissao, gerarXmlNfce } = useNfce();
  const { sessaoAberta } = useCaixa();

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

  // Client
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [showClienteModal, setShowClienteModal] = useState(false);
  const [showNovoCliente, setShowNovoCliente] = useState(false);
  const [buscaCliente, setBuscaCliente] = useState("");
  const [novoCliente, setNovoCliente] = useState({ nome: "", cpfCnpj: "", telefone: "", email: "", dataNascimento: "" });

  // Document type
  const [tipoDocumento, setTipoDocumento] = useState<TipoDocumento>("comprovante");
  const [showFinalizacao, setShowFinalizacao] = useState(false);
  const [showComprovante, setShowComprovante] = useState(false);
  const [comprovanteData, setComprovanteData] = useState<ComprovanteData | null>(null);
  const [grupoVendaAtual, setGrupoVendaAtual] = useState("");

  const clienteSelecionado = clientes.find(c => c.id === clienteId) || null;

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "F2") { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === "F9" && cart.length > 0) { e.preventDefault(); setShowFinalizacao(true); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [cart.length]);

  // Search results
  const resultadosBusca = useMemo(() => {
    if (!busca.trim()) return [];
    const q = busca.toLowerCase().trim();
    return perfumes
      .filter(p => {
        const estoque = p.estoques[deposito] || 0;
        // Search by name, code, brand, concentration, volume, and barcode
        const text = `${p.nome} ${p.codigo} ${p.marca} ${concentracoesConfig[p.concentracao] || p.concentracao} ${p.volume}ml ${p.codigoBarras || ""}`.toLowerCase();
        return text.includes(q) && estoque > 0;
      })
      .slice(0, 10);
  }, [busca, perfumes, deposito, concentracoesConfig]);

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
    if (estoque <= 0) return;
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
        volume: p.volume,
        concentracao: p.concentracao,
        casaSigla: p.casaSigla,
        imageUrl: p.imageUrl || "",
        deposito,
        quantidade: 1,
        precoUnitario: p.precoVenda,
        estoqueDisponivel: estoque,
      }]);
    }
    setBusca("");
    searchRef.current?.focus();
  }, [cart, deposito]);

  // Enter to add first result
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && resultadosBusca.length > 0) {
      e.preventDefault();
      addToCart(resultadosBusca[0]);
    }
  };

  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.perfumeId !== id) return i;
      const novaQtd = Math.max(1, Math.min(i.estoqueDisponivel, i.quantidade + delta));
      return { ...i, quantidade: novaQtd };
    }));
  };

  const removeItem = (id: string) => setCart(prev => prev.filter(i => i.perfumeId !== id));

  // Payment helpers
  const addPagamento = () => {
    const valorRestante = Math.max(0, Number((totalFinal - totalPagamentos).toFixed(2)));
    setPagamentos(prev => [...prev, {
      tipoPagamento: "Pix", bandeira: "N/A" as Bandeira, valor: valorRestante,
      parcelas: 1, valorParcela: valorRestante,
    }]);
  };

  const updatePagamento = (idx: number, updates: Partial<PagamentoItem>) => {
    setPagamentos(prev => prev.map((p, i) => {
      if (i !== idx) return p;
      const updated = { ...p, ...updates };
      // Auto-calc parcela value
      if (updates.parcelas && !updates.valorParcela) {
        updated.valorParcela = Number((updated.valor / updates.parcelas).toFixed(2));
      }
      if (updates.valor && !updates.valorParcela) {
        updated.valorParcela = Number((updates.valor / updated.parcelas).toFixed(2));
      }
      return updated;
    }));
  };

  const removePagamento = (idx: number) => setPagamentos(prev => prev.filter((_, i) => i !== idx));

  // Calculate troco for cash payments
  const trocoCalculado = useMemo(() => {
    if (totalPagamentos <= totalFinal) return 0;
    const dinheiroTotal = pagamentos
      .filter(p => p.tipoPagamento === "Dinheiro")
      .reduce((s, p) => s + p.valor, 0);
    const outrosTotal = pagamentos
      .filter(p => p.tipoPagamento !== "Dinheiro")
      .reduce((s, p) => s + p.valor, 0);
    const sobraEmDinheiro = totalFinal - outrosTotal;
    if (dinheiroTotal > sobraEmDinheiro && sobraEmDinheiro >= 0) {
      return dinheiroTotal - sobraEmDinheiro;
    }
    return 0;
  }, [pagamentos, totalFinal, totalPagamentos]);

  // Save new client
  const handleSalvarCliente = async () => {
    if (!novoCliente.nome.trim()) return;
    try {
      const created = await adicionarCliente({
        nome: novoCliente.nome,
        cpfCnpj: novoCliente.cpfCnpj,
        telefone: novoCliente.telefone,
        email: novoCliente.email,
        dataNascimento: novoCliente.dataNascimento || null,
      });
      setClienteId(created.id);
      setShowNovoCliente(false);
      setShowClienteModal(false);
      setNovoCliente({ nome: "", cpfCnpj: "", telefone: "", email: "", dataNascimento: "" });
    } catch (err) {
      console.error("Erro ao cadastrar cliente:", err);
    }
  };

  // Filtered clients
  const clientesFiltrados = useMemo(() => {
    if (!buscaCliente.trim()) return clientes.slice(0, 20);
    const q = buscaCliente.toLowerCase();
    return clientes.filter(c =>
      c.nome.toLowerCase().includes(q) ||
      c.cpfCnpj.includes(q) ||
      c.telefone.includes(q)
    ).slice(0, 20);
  }, [clientes, buscaCliente]);

  // Map payment type to fiscal code
  const codigoFiscalMap: Record<string, string> = {
    "Dinheiro": "01 - Dinheiro",
    "Pix": "17 - Pix",
    "Débito": "02 - Cartão de Débito",
    "Crédito": "03 - Cartão de Crédito",
    "Conta Assinada": "99 - Outros",
  };

  // Build comprovante data from current sale state
  const buildComprovanteData = (grupoVenda: string): ComprovanteData => {
    const agora = new Date();
    return {
      nomeFantasia: configFiscal?.nomeFantasia || "LE JESS PERFUMES",
      razaoSocial: configFiscal?.razaoSocial || "MAISON LE JESS COMERCIO DE PERFUMARIA LTDA",
      cnpj: configFiscal?.cnpj || "",
      inscricaoEstadual: configFiscal?.inscricaoEstadual || "",
      endereco: configFiscal ? `${configFiscal.endereco}, ${configFiscal.numero}${configFiscal.complemento ? ` - ${configFiscal.complemento}` : ""}` : "",
      cidade: configFiscal ? `${configFiscal.bairro}\n${configFiscal.cidade} - Cep ${configFiscal.cep}\n${configFiscal.uf}` : "",
      telefone: configFiscal?.telefone || "",
      logoUrl: configFiscal?.logoUrl || "",
      pedido: grupoVenda.slice(0, 8).toUpperCase(),
      data: agora.toLocaleDateString("pt-BR"),
      hora: agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      vendedor: vendedora,
      operador: profile?.nome || "",
      cliente: clienteSelecionado,
      itens: cart.map((item, idx) => ({
        item: idx + 1,
        descricao: `${item.marca} - ${item.perfumeNome}`,
        casa: item.marca || item.casaSigla,
        perfumeNome: item.perfumeNome,
        codigo: item.codigo,
        quantidade: item.quantidade,
        valorUnitario: item.precoUnitario,
        total: item.precoUnitario * item.quantidade,
      })),
      pagamentos: pagamentos.map(p => {
        const codigoFiscal = codigoFiscalMap[p.tipoPagamento] || "99 - Outros";
        // Generate installment dates for credit
        let dataParcelas: { data: string; valor: number }[] | undefined;
        if (p.parcelas > 1) {
          dataParcelas = Array.from({ length: p.parcelas }, (_, i) => {
            const d = new Date(agora);
            d.setMonth(d.getMonth() + i + 1);
            return {
              data: d.toLocaleDateString("pt-BR"),
              valor: Number((p.valor / p.parcelas).toFixed(2)),
            };
          });
        }
        return {
          forma: p.tipoPagamento,
          codigoFiscal,
          parcelas: p.parcelas,
          valor: p.valor,
          dataParcelas,
        };
      }),
      subtotal,
      desconto: tipoAjuste === "desconto" ? valorAjuste : 0,
      acrescimo: tipoAjuste === "acrescimo" ? valorAjuste : 0,
      descontoLabel: tipoAjuste === "desconto" && ajusteMode === "%" && ajusteValor > 0 ? `${ajusteValor}%` : undefined,
      acrescimoLabel: tipoAjuste === "acrescimo" && ajusteMode === "%" && ajusteValor > 0 ? `${ajusteValor}%` : undefined,
      total: totalFinal,
      troco: trocoCalculado,
      observacao: observacao || undefined,
    };
  };

  // Finalize sale
  const finalizarVenda = async () => {
    if (isFinalizando || cart.length === 0 || !vendedora) return;
    if (restante > 0.01) return;
    setIsFinalizando(true);

    try {
      const hoje = getHojeManaus();
      const registradoPor = profile?.nome || "";
      const grupoVenda = crypto.randomUUID();

      const itens: Venda[] = cart.map(item => {
        const proporcao = subtotal > 0 ? (item.precoUnitario * item.quantidade) / subtotal : 1 / cart.length;
        const ajusteItem = valorAjuste * proporcao;
        let totalItem = item.precoUnitario * item.quantidade;
        if (tipoAjuste === "desconto") totalItem -= ajusteItem;
        else totalItem += ajusteItem;

        return {
          id: "", data: hoje, perfumeId: item.perfumeId, perfumeNome: item.perfumeNome,
          deposito: item.deposito, quantidade: item.quantidade, precoUnitario: item.precoUnitario,
          tipoAjuste, desconto: ajusteItem, total: Math.max(0, totalItem),
          vendedora, tipoPagamento: pagamentos[0]?.tipoPagamento || "Pix",
          bandeira: pagamentos[0]?.bandeira || ("N/A" as Bandeira),
          observacao, registradoPor, grupoVenda,
        };
      });

      const pagamentosVenda: Omit<VendaPagamento, "id">[] = pagamentos.map(p => ({
        grupoVenda: "", tipoPagamento: p.tipoPagamento, bandeira: p.bandeira, valor: p.valor,
      }));

      await adicionarVendaMulti({ itens, pagamentosVenda });

      for (const item of cart) {
        baixarEstoque(item.perfumeId, item.deposito, item.quantidade);
      }

      // Generate comprovante data
      const compData = buildComprovanteData(grupoVenda);
      setComprovanteData(compData);
      setGrupoVendaAtual(grupoVenda);

      // If NFC-e, create emission record
      if (tipoDocumento === "nfce") {
        try {
          await criarEmissao({ vendaGrupoVenda: grupoVenda });
        } catch (err) {
          console.error("Erro ao criar emissão NFC-e:", err);
        }
      }

      setTroco(trocoCalculado);
      setVendaConcluida(true);
    } catch (err) {
      console.error("Erro ao finalizar venda:", err);
    } finally {
      setIsFinalizando(false);
    }
  };

  const novaVenda = () => {
    setCart([]); setBusca(""); setVendedora(""); setObservacao("");
    setAjusteValor(0); setPagamentos([]); setShowPagamento(false);
    setVendaConcluida(false); setTroco(0); setClienteId(null);
    setTipoDocumento("comprovante"); setShowFinalizacao(false);
    setShowComprovante(false); setComprovanteData(null); setGrupoVendaAtual("");
    searchRef.current?.focus();
  };

  // ─── Payment icon helper ───
  const paymentIcon = (tipo: TipoPagamento) => {
    switch (tipo) {
      case "Dinheiro": return <Banknote size={14} />;
      case "Pix": return <QrCode size={14} />;
      case "Débito": case "Crédito": return <CreditCard size={14} />;
      case "Conta Assinada": return <BookOpen size={14} />;
      default: return <DollarSign size={14} />;
    }
  };

  // Print comprovante
  const handlePrint = () => {
    if (!comprovanteData) return;
    // Create print window with receipt content
    const printWindow = window.open("", "_blank", "width=320,height=600");
    if (!printWindow) return;
    
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Comprovante</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  body { font-family: 'Arial', sans-serif; font-size: 14px; line-height: 1.5; color: #000; background: #fff; padding: 4mm; margin: 0; width: 80mm; font-weight: 900; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .logo-center { text-align: center; margin-bottom: 8px; }
  .logo-center img { width: 70%; max-height: 80px; object-fit: contain; }
  .logo-text { text-align: center; font-weight: 900; font-size: 16px; margin-bottom: 8px; }
  .company-center { text-align: center; font-size: 14px; margin-bottom: 6px; font-weight: 900; }
  .company-name { font-weight: 900; font-size: 15px; }
  .sep { color: #000; font-size: 11px; }
  .double { color: #000; font-size: 13px; }
  .flex { display: flex; justify-content: space-between; }
  .sm { font-size: 15px; font-weight: 900; }
  .xs { font-size: 14px; font-weight: 900; }
  .item-row { font-size: 14px; display: flex; padding: 3px 0; font-weight: 900; }
  .item-row .name { flex: 1; word-break: break-word; }
  .item-row .qty { width: 36px; text-align: center; flex-shrink: 0; }
  .item-row .val { width: 72px; text-align: right; flex-shrink: 0; }
  .col-head { font-size: 14px; font-weight: 900; display: flex; padding: 3px 0; }
  .col-head .name { flex: 1; }
  .col-head .qty { width: 36px; text-align: center; }
  .col-head .val { width: 72px; text-align: right; }
  .pag-row { font-size: 14px; display: flex; padding: 2px 0; font-weight: 900; }
  .pag-row .pname { flex: 1; }
  .pag-row .pval { width: 80px; text-align: right; }
  .total-line { font-size: 18px; font-weight: 900; display: flex; justify-content: space-between; padding: 6px 0; }
  .footer { text-align: center; font-size: 14px; font-weight: 900; margin-top: 8px; }
  .section-title { font-size: 15px; font-weight: 900; margin: 4px 0; }
</style></head><body>
</style></head><body>
${comprovanteData.logoUrl ? `<div class="logo-center"><img src="${comprovanteData.logoUrl}" alt="Logo" /></div>` : `<div class="logo-text">${comprovanteData.nomeFantasia || "LE JESS PERFUMES"}</div>`}
<div class="company-center">
  <div class="company-name">${comprovanteData.razaoSocial || comprovanteData.nomeFantasia}</div>
  ${comprovanteData.cnpj ? `<div>CNPJ: ${comprovanteData.cnpj}</div>` : ""}
  ${comprovanteData.inscricaoEstadual ? `<div>IE: ${comprovanteData.inscricaoEstadual}</div>` : ""}
  ${comprovanteData.telefone ? `<div>Tel.: ${comprovanteData.telefone}</div>` : ""}
  ${comprovanteData.endereco ? `<div>${comprovanteData.endereco}</div>` : ""}
  ${comprovanteData.cidade ? `<div>${comprovanteData.cidade.replace(/\\n/g, "<br/>")}</div>` : ""}
</div>
<div class="sep">${"─".repeat(48)}</div>
<div class="sm">
  <div class="flex"><span>Pedido: ${comprovanteData.pedido}</span><span>${comprovanteData.data}</span></div>
  <div>Vendedor: ${comprovanteData.vendedor}</div>
  <div>Operador: ${comprovanteData.operador || ""}</div>
  ${comprovanteData.cliente ? `<div>Cliente: ${comprovanteData.cliente.nome}</div>` : ""}
  ${comprovanteData.cliente ? `<div>Cliente: ${comprovanteData.cliente.nome}</div>` : ""}
</div>
<div class="sep">${"─".repeat(48)}</div>
<div class="col-head"><span class="name">ITEM</span><span class="qty">QTD</span><span class="val">VALOR</span><span class="val">TOTAL</span></div>
<div class="sep">${"─".repeat(48)}</div>
${comprovanteData.itens.map(item => `
<div class="item-row"><span class="name">${item.descricao}</span><span class="qty">${item.quantidade}</span><span class="val">${formatCurrency(item.valorUnitario)}</span><span class="val">${formatCurrency(item.total)}</span></div>`).join("")}
<div class="section-title">FORMA DE PAGAMENTO</div>
<div class="col-head" style="margin-top:2px"><span class="pname">FORMA PGTO.</span><span class="pval">VALOR</span></div>
<div class="sep">${"─".repeat(48)}</div>
${comprovanteData.pagamentos.map(pag => {
    if (pag.dataParcelas && pag.dataParcelas.length > 0) {
      return pag.dataParcelas.map((parcela: {data: string; valor: number}, pIdx: number) => `
<div class="pag-row"><span class="pname">${pag.forma}${pag.parcelas > 1 ? ` ${String(pIdx + 1).padStart(2, "0")}` : ""} (${parcela.data})</span><span class="pval">${formatCurrency(parcela.valor)}</span></div>`).join("");
    }
    return `<div class="pag-row"><span class="pname">${pag.forma}</span><span class="pval">${formatCurrency(pag.valor)}</span></div>`;
  }).join("")}
<div class="sep">${"─".repeat(48)}</div>
<div class="sm flex"><span><strong>SUBTOTAL:</strong></span><span><strong>${formatCurrency(comprovanteData.subtotal)}</strong></span></div>
${comprovanteData.desconto > 0 ? `<div class="sm flex"><span>DESCONTO${comprovanteData.descontoLabel ? ` (${comprovanteData.descontoLabel})` : ""}:</span><span>-${formatCurrency(comprovanteData.desconto)}</span></div>` : ""}
${comprovanteData.acrescimo > 0 ? `<div class="sm flex"><span>ACRÉSCIMO${comprovanteData.acrescimoLabel ? ` (${comprovanteData.acrescimoLabel})` : ""}:</span><span>+${formatCurrency(comprovanteData.acrescimo)}</span></div>` : ""}
<div class="double">${"═".repeat(48)}</div>
<div class="total-line"><span><strong>TOTAL:</strong></span><span><strong>${formatCurrency(comprovanteData.total)}</strong></span></div>
<div class="double">${"═".repeat(48)}</div>
${comprovanteData.troco > 0 ? `<div class="sm flex"><span><strong>TROCO:</strong></span><span><strong>${formatCurrency(comprovanteData.troco)}</strong></span></div>` : ""}
${comprovanteData.observacao ? `<div class="sep">${"─".repeat(48)}</div><div class="xs">Obs: ${comprovanteData.observacao}</div>` : ""}
<div class="sep">${"─".repeat(48)}</div>
<div class="footer">
  <div>Obrigada pela preferência!</div>
  <div style="margin-top:4px">${comprovanteData.data} ${comprovanteData.hora}</div>
</div>
</body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => { printWindow.print(); };
  };

  // ═══════════════════════════════════════════
  // SUCCESS SCREEN
  // ═══════════════════════════════════════════
  if (vendaConcluida) {
    return (
      <div className="fixed inset-0 z-[100] flex" style={{ background: "hsl(var(--background))" }}>
        {/* Left: Success info */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-6 animate-fade-in max-w-md mx-auto px-6">
            <div className="w-24 h-24 rounded-full mx-auto flex items-center justify-center" style={{ background: "hsl(var(--success) / 0.15)" }}>
              <CheckCircle2 size={48} className="text-success" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Venda concluída!</h1>
              <p className="text-muted-foreground mt-2">Estoque atualizado automaticamente.</p>
              {tipoDocumento === "nfce" && (
                <div className="mt-3 px-4 py-2 rounded-xl inline-flex items-center gap-2" style={{ background: "hsl(var(--warning) / 0.15)" }}>
                  <AlertTriangle size={14} style={{ color: "hsl(var(--warning))" }} />
                  <span className="text-xs" style={{ color: "hsl(var(--warning))" }}>
                    NFC-e pendente — será emitida quando a API fiscal estiver configurada
                  </span>
                </div>
              )}
            </div>
            <div className="text-2xl font-bold text-gold">{formatCurrency(totalFinal)}</div>
            {clienteSelecionado && (
              <p className="text-sm text-muted-foreground">Cliente: {clienteSelecionado.nome}</p>
            )}
            {troco > 0 && (
              <div className="px-6 py-3 rounded-xl mx-auto inline-block" style={{ background: "hsl(var(--warning) / 0.15)" }}>
                <span className="text-sm text-muted-foreground">Troco: </span>
                <span className="text-lg font-bold" style={{ color: "hsl(var(--warning))" }}>{formatCurrency(troco)}</span>
              </div>
            )}
            <div className="flex gap-3 justify-center pt-4">
              <button onClick={handlePrint} className="btn-secondary px-6 py-3 text-sm flex items-center gap-2">
                <Printer size={16} /> Imprimir
              </button>
              <button onClick={() => setShowComprovante(prev => !prev)} className="btn-secondary px-6 py-3 text-sm flex items-center gap-2">
                <Eye size={16} /> {showComprovante ? "Ocultar" : "Ver"} Comprovante
              </button>
            </div>
            <div className="flex gap-3 justify-center">
              <button onClick={novaVenda} className="btn-primary px-8 py-3 text-sm font-semibold">
                Nova Venda (F2)
              </button>
              {onBack && (
                <button onClick={onBack} className="btn-secondary px-6 py-3 text-sm">Voltar ao ERP</button>
              )}
            </div>
          </div>
        </div>

        {/* Right: Comprovante preview */}
        {showComprovante && comprovanteData && (
          <div className="w-[380px] flex-shrink-0 overflow-y-auto p-6 hidden md:block" style={{ borderLeft: "1px solid hsl(var(--border))" }}>
            <ComprovantePreview data={comprovanteData} />
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════
  // FINALIZATION MODAL (document type + client + confirm)
  // ═══════════════════════════════════════════
  const FinalizacaoModal = () => {
    if (!showFinalizacao) return null;
    const canFinalize = cart.length > 0 && vendedora && restante <= 0.01 && pagamentos.length > 0;

    return (
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" style={{ background: "hsla(0,0%,0%,0.7)" }}>
        <div className="w-full max-w-lg rounded-2xl overflow-hidden" style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
            <h2 className="text-lg font-bold text-foreground">Finalizar Venda</h2>
            <button onClick={() => setShowFinalizacao(false)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors">
              <X size={18} />
            </button>
          </div>

          <div className="p-6 space-y-5">
            {/* Document type */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">Tipo de documento</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setTipoDocumento("comprovante")}
                  className={`flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                    tipoDocumento === "comprovante" ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                  style={tipoDocumento === "comprovante"
                    ? { background: "hsl(var(--gold))" }
                    : { background: "hsl(var(--surface-raised))", border: "1px solid hsl(var(--border))" }}
                >
                  <Receipt size={16} /> Comprovante
                </button>
                <button
                  onClick={() => setTipoDocumento("nfce")}
                  className={`flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                    tipoDocumento === "nfce" ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                  style={tipoDocumento === "nfce"
                    ? { background: "hsl(var(--gold))" }
                    : { background: "hsl(var(--surface-raised))", border: "1px solid hsl(var(--border))" }}
                >
                  <FileText size={16} /> NFC-e
                </button>
              </div>
            </div>

            {/* Client */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">
                Cliente {tipoDocumento === "nfce" ? "(recomendado para NFC-e)" : "(opcional)"}
              </label>
              {clienteSelecionado ? (
                <div className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background: "hsl(var(--surface-raised))" }}>
                  <div>
                    <p className="text-sm font-medium text-foreground">{clienteSelecionado.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {clienteSelecionado.cpfCnpj && `CPF/CNPJ: ${clienteSelecionado.cpfCnpj}`}
                      {clienteSelecionado.telefone && ` · ${clienteSelecionado.telefone}`}
                    </p>
                  </div>
                  <button onClick={() => setClienteId(null)} className="text-xs text-muted-foreground hover:text-foreground">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => setShowClienteModal(true)}
                    className="flex-1 px-4 py-2.5 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground flex items-center justify-center gap-2 transition-all"
                    style={{ background: "hsl(var(--surface-raised))", border: "1px solid hsl(var(--border))" }}>
                    <Search size={14} /> Buscar cliente
                  </button>
                  <button onClick={() => { setShowNovoCliente(true); setShowClienteModal(true); }}
                    className="px-4 py-2.5 rounded-xl text-xs font-medium text-gold hover:text-gold-light flex items-center gap-2 transition-all"
                    style={{ background: "hsl(var(--gold) / 0.1)", border: "1px solid hsl(var(--gold) / 0.2)" }}>
                    <UserPlus size={14} /> Novo
                  </button>
                </div>
              )}
            </div>

            {/* Summary */}
            <div className="rounded-xl p-4 space-y-2" style={{ background: "hsl(var(--surface-raised))" }}>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{totalItens} {totalItens === 1 ? "item" : "itens"}</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {valorAjuste > 0 && (
                <div className="flex justify-between text-xs">
                  <span className={tipoAjuste === "desconto" ? "text-success" : ""} style={tipoAjuste !== "desconto" ? { color: "hsl(var(--warning))" } : {}}>
                    {tipoAjuste === "desconto" ? "Desconto" : "Acréscimo"}
                  </span>
                  <span className={tipoAjuste === "desconto" ? "text-success" : ""} style={tipoAjuste !== "desconto" ? { color: "hsl(var(--warning))" } : {}}>
                    {tipoAjuste === "desconto" ? "-" : "+"}{formatCurrency(valorAjuste)}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-baseline pt-2" style={{ borderTop: "1px solid hsl(var(--border))" }}>
                <span className="text-sm font-medium text-foreground">Total</span>
                <span className="text-xl font-bold text-gold">{formatCurrency(totalFinal)}</span>
              </div>
              {trocoCalculado > 0 && (
                <div className="flex justify-between text-xs" style={{ color: "hsl(var(--warning))" }}>
                  <span>Troco</span>
                  <span>{formatCurrency(trocoCalculado)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="px-6 pb-6 flex gap-3">
            <button onClick={() => setShowFinalizacao(false)} className="btn-secondary flex-1 py-3 text-sm">
              Voltar
            </button>
            <button
              onClick={finalizarVenda}
              disabled={!canFinalize || isFinalizando}
              className="flex-1 py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-2"
              style={{
                background: canFinalize ? "var(--gradient-gold)" : "hsl(var(--muted))",
                color: canFinalize ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))",
                boxShadow: canFinalize ? "var(--shadow-gold)" : "none",
              }}
            >
              {isFinalizando ? <><Loader2 size={16} className="animate-spin" /> Finalizando...</> : <><CheckCircle2 size={16} /> Confirmar Venda</>}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════
  // CLIENT MODAL
  // ═══════════════════════════════════════════
  const ClienteModal = () => {
    if (!showClienteModal) return null;

    return (
      <div className="fixed inset-0 z-[130] flex items-center justify-center p-4" style={{ background: "hsla(0,0%,0%,0.7)" }}>
        <div className="w-full max-w-md rounded-2xl overflow-hidden max-h-[80vh] flex flex-col" style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
            <h3 className="text-sm font-bold text-foreground">{showNovoCliente ? "Novo Cliente" : "Buscar Cliente"}</h3>
            <button onClick={() => { setShowClienteModal(false); setShowNovoCliente(false); }} className="text-muted-foreground hover:text-foreground">
              <X size={16} />
            </button>
          </div>

          {showNovoCliente ? (
            <div className="p-5 space-y-3 overflow-y-auto">
              <input type="text" placeholder="Nome *" value={novoCliente.nome} onChange={e => setNovoCliente(p => ({ ...p, nome: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg text-sm text-foreground placeholder:text-muted-foreground outline-none border border-transparent focus:border-gold/30"
                style={{ background: "hsl(var(--surface-raised))" }} autoFocus />
              <input type="text" placeholder="CPF / CNPJ" value={novoCliente.cpfCnpj} onChange={e => setNovoCliente(p => ({ ...p, cpfCnpj: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg text-sm text-foreground placeholder:text-muted-foreground outline-none border border-transparent focus:border-gold/30"
                style={{ background: "hsl(var(--surface-raised))" }} />
              <input type="text" placeholder="Telefone" value={novoCliente.telefone} onChange={e => setNovoCliente(p => ({ ...p, telefone: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg text-sm text-foreground placeholder:text-muted-foreground outline-none border border-transparent focus:border-gold/30"
                style={{ background: "hsl(var(--surface-raised))" }} />
              <input type="email" placeholder="E-mail" value={novoCliente.email} onChange={e => setNovoCliente(p => ({ ...p, email: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg text-sm text-foreground placeholder:text-muted-foreground outline-none border border-transparent focus:border-gold/30"
                style={{ background: "hsl(var(--surface-raised))" }} />
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Data de nascimento (opcional)</label>
                <input type="date" value={novoCliente.dataNascimento} onChange={e => setNovoCliente(p => ({ ...p, dataNascimento: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg text-sm text-foreground outline-none border border-transparent focus:border-gold/30"
                  style={{ background: "hsl(var(--surface-raised))" }} />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowNovoCliente(false)} className="btn-secondary flex-1 py-2.5 text-xs">Voltar</button>
                <button onClick={handleSalvarCliente} disabled={!novoCliente.nome.trim()} className="btn-primary flex-1 py-2.5 text-xs disabled:opacity-40">
                  Cadastrar e Selecionar
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="px-5 pt-4">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type="text" placeholder="Buscar por nome, CPF ou telefone..." value={buscaCliente}
                    onChange={e => setBuscaCliente(e.target.value)} autoFocus
                    className="w-full pl-9 pr-3 py-2.5 rounded-lg text-sm text-foreground placeholder:text-muted-foreground outline-none border border-transparent focus:border-gold/30"
                    style={{ background: "hsl(var(--surface-raised))" }} />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-2 py-2">
                {clientesFiltrados.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">Nenhum cliente encontrado</p>
                ) : (
                  clientesFiltrados.map(c => (
                    <button key={c.id} onClick={() => { setClienteId(c.id); setShowClienteModal(false); setBuscaCliente(""); }}
                      className="w-full text-left px-4 py-3 rounded-lg hover:bg-surface-raised transition-colors">
                      <p className="text-sm font-medium text-foreground">{c.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.cpfCnpj && `${c.cpfCnpj} · `}{c.telefone || "Sem telefone"}
                      </p>
                    </button>
                  ))
                )}
              </div>
              <div className="px-5 pb-4">
                <button onClick={() => setShowNovoCliente(true)}
                  className="w-full py-2.5 rounded-lg text-xs font-medium text-gold flex items-center justify-center gap-2 transition-all"
                  style={{ background: "hsl(var(--gold) / 0.1)", border: "1px solid hsl(var(--gold) / 0.2)" }}>
                  <UserPlus size={14} /> Cadastrar novo cliente
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════════════════
  // Gate: require open cash register
  if (!sessaoAberta) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: "hsl(var(--background))" }}>
        <div className="text-center space-y-6 max-w-md mx-auto px-6 animate-fade-in">
          {onBack && (
            <button onClick={onBack} className="absolute top-6 left-6 p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-all">
              <ArrowLeft size={20} />
            </button>
          )}
          <div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center" style={{ background: "hsl(var(--warning) / 0.15)" }}>
            <Lock size={40} style={{ color: "hsl(var(--warning))" }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Caixa fechado</h1>
            <p className="text-muted-foreground mt-2">É necessário abrir o caixa antes de realizar vendas.</p>
            <p className="text-sm text-muted-foreground mt-1">Vá em <strong>Caixa</strong> para abrir uma sessão.</p>
          </div>
          {onBack && (
            <button onClick={onBack} className="btn-primary px-8 py-3 text-sm font-semibold">
              Voltar ao ERP
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col" style={{ background: "hsl(var(--background))" }}>
      <FinalizacaoModal />
      <ClienteModal />

      {/* ─── TOP BAR ─── */}
      <header className="flex items-center justify-between px-4 md:px-6 py-3 flex-shrink-0" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-all">
              <ArrowLeft size={20} />
            </button>
          )}
          <div className="flex items-center gap-2">
            <Receipt size={22} className="text-gold" />
            <h1 className="text-lg font-bold text-foreground tracking-tight" style={{ fontFamily: "'Inter', sans-serif" }}>PDV</h1>
          </div>
          <span className="text-xs text-muted-foreground hidden md:inline">Le Jess Perfumes</span>
        </div>

        <div className="flex items-center gap-4">
          {!userLoja && (
            <div className="flex items-center gap-2">
              <Store size={14} className="text-muted-foreground" />
              <div className="flex gap-1">
                {depositos.map(d => (
                  <button key={d} onClick={() => {
                    setDeposito(d);
                    setCart(prev => prev.map(item => {
                      const p = perfumes.find(x => x.id === item.perfumeId);
                      return { ...item, deposito: d, estoqueDisponivel: p?.estoques[d] || 0 };
                    }));
                  }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${deposito === d ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    style={deposito === d ? { background: "hsl(var(--gold))" } : { background: "hsl(var(--surface-raised))" }}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <User size={14} />
            <span>{profile?.nome || "Operador"}</span>
          </div>
        </div>
      </header>

      {/* ─── MAIN CONTENT ─── */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT: Search + Cart */}
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
                onKeyDown={handleSearchKeyDown}
                onFocus={() => setBuscaFocused(true)}
                onBlur={() => setTimeout(() => setBuscaFocused(false), 200)}
                placeholder="Buscar por nome, código, marca... (F2) — Enter para adicionar"
                className="w-full pl-12 pr-4 py-3.5 rounded-xl text-sm border border-transparent focus:border-gold/30 focus:ring-1 focus:ring-gold/20 text-foreground placeholder:text-muted-foreground outline-none transition-all"
                style={{ background: "hsl(var(--surface-raised))" }}
                autoFocus
              />
              {busca && (
                <button onClick={() => { setBusca(""); searchRef.current?.focus(); }} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
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
                  resultadosBusca.map((p, idx) => {
                    const estoque = p.estoques[deposito] || 0;
                    return (
                      <button key={p.id} onMouseDown={() => addToCart(p)}
                        className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-raised transition-colors text-left ${idx === 0 ? "bg-surface-raised/50" : ""}`}>
                        <div className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ background: "hsl(var(--surface-raised))" }}>
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Package size={18} className="text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{p.nome}</p>
                          <p className="text-xs text-muted-foreground">{p.marca} · {p.codigo} · {p.volume}ml</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold text-gold">{formatCurrency(p.precoVenda)}</p>
                          <p className="text-[10px] text-muted-foreground">{estoque} em estoque</p>
                        </div>
                        {idx === 0 && <span className="text-[9px] px-1.5 py-0.5 rounded text-muted-foreground" style={{ background: "hsl(var(--surface-overlay))" }}>Enter</span>}
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
                <p className="text-xs text-muted-foreground mt-1">Busque um produto ou escaneie o código de barras</p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Cart header */}
                <div className="flex items-center gap-3 px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <span className="w-6 text-center">#</span>
                  <span className="w-10" />
                  <span className="flex-1">Produto</span>
                  <span className="w-20 text-center">Qtd</span>
                  <span className="w-24 text-right">Subtotal</span>
                  <span className="w-8" />
                </div>

                {cart.map((item, idx) => (
                  <div key={item.perfumeId} className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all hover:bg-surface-raised/50"
                    style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}>
                    {/* Index */}
                    <span className="text-xs text-muted-foreground w-6 text-center font-mono">{idx + 1}</span>

                    {/* Photo */}
                    <div className="w-10 h-10 rounded-lg flex-shrink-0 overflow-hidden flex items-center justify-center" style={{ background: "hsl(var(--surface-raised))" }}>
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Package size={16} className="text-muted-foreground" />
                      )}
                    </div>

                    {/* Product info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{item.perfumeNome}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {item.marca} · {item.codigo} · {item.volume}ml
                        <span className="ml-2 text-[10px]" style={{ color: item.estoqueDisponivel <= 3 ? "hsl(var(--warning))" : "hsl(var(--muted-foreground))" }}>
                          ({item.estoqueDisponivel} disp.)
                        </span>
                      </p>
                    </div>

                    {/* Quantity controls */}
                    <div className="flex items-center gap-1 w-20 justify-center">
                      <button onClick={() => updateQty(item.perfumeId, -1)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-all">
                        <Minus size={14} />
                      </button>
                      <span className="w-8 text-center text-sm font-bold text-foreground">{item.quantidade}</span>
                      <button onClick={() => updateQty(item.perfumeId, 1)}
                        disabled={item.quantidade >= item.estoqueDisponivel}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-all disabled:opacity-30">
                        <Plus size={14} />
                      </button>
                    </div>

                    {/* Subtotal */}
                    <div className="text-right w-24">
                      <p className="text-sm font-bold text-foreground">{formatCurrency(item.precoUnitario * item.quantidade)}</p>
                      <p className="text-[10px] text-muted-foreground">{formatCurrency(item.precoUnitario)} un.</p>
                    </div>

                    {/* Remove */}
                    <button onClick={() => removeItem(item.perfumeId)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all w-8 flex items-center justify-center">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ─── RIGHT SIDEBAR ─── */}
        <aside className="w-[380px] flex-shrink-0 flex flex-col overflow-y-auto hidden md:flex"
          style={{ background: "hsl(var(--card))", borderLeft: "1px solid hsl(var(--border))" }}>
          <div className="p-5 space-y-5 flex-1">
            {/* Seller */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">Vendedora</label>
              <div className="flex flex-wrap gap-1.5">
                {vendedoras.map(v => (
                  <button key={v} onClick={() => setVendedora(v)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${vendedora === v ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    style={vendedora === v ? { background: "hsl(var(--gold))" } : { background: "hsl(var(--surface-raised))" }}>
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Observation */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Observação</label>
              <textarea value={observacao} onChange={e => setObservacao(e.target.value)}
                placeholder="Notas da venda..." rows={2}
                className="w-full px-3 py-2 rounded-lg text-xs resize-none text-foreground placeholder:text-muted-foreground outline-none transition-all border border-transparent focus:border-gold/30"
                style={{ background: "hsl(var(--surface-raised))" }} />
            </div>

            {/* Adjustment */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">Ajuste no total</label>
              <div className="flex gap-1.5 mb-2">
                <button onClick={() => setTipoAjuste("desconto")}
                  className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${tipoAjuste === "desconto" ? "text-primary-foreground" : "text-muted-foreground"}`}
                  style={tipoAjuste === "desconto" ? { background: "hsl(var(--gold))" } : { background: "hsl(var(--surface-raised))" }}>
                  Desconto
                </button>
                <button onClick={() => setTipoAjuste("acrescimo")}
                  className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${tipoAjuste === "acrescimo" ? "text-primary-foreground" : "text-muted-foreground"}`}
                  style={tipoAjuste === "acrescimo" ? { background: "hsl(var(--gold))" } : { background: "hsl(var(--surface-raised))" }}>
                  Acréscimo
                </button>
              </div>
              <div className="flex gap-2">
                <div className="flex rounded-lg overflow-hidden" style={{ background: "hsl(var(--surface-raised))" }}>
                  <button onClick={() => setAjusteMode("%")} className={`px-3 py-1.5 text-xs font-medium transition-all ${ajusteMode === "%" ? "text-gold" : "text-muted-foreground"}`}>%</button>
                  <button onClick={() => setAjusteMode("R$")} className={`px-3 py-1.5 text-xs font-medium transition-all ${ajusteMode === "R$" ? "text-gold" : "text-muted-foreground"}`}>R$</button>
                </div>
                <input type="number" min={0} value={ajusteValor || ""} onChange={e => setAjusteValor(Number(e.target.value))}
                  placeholder="0"
                  className="flex-1 px-3 py-1.5 rounded-lg text-xs text-foreground placeholder:text-muted-foreground outline-none border border-transparent focus:border-gold/30"
                  style={{ background: "hsl(var(--surface-raised))" }} />
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
                  <div key={idx} className="rounded-xl p-3 space-y-2" style={{ background: "hsl(var(--surface-raised))" }}>
                    <div className="flex gap-2 items-center">
                      <span className="text-muted-foreground">{paymentIcon(pag.tipoPagamento)}</span>
                      <select value={pag.tipoPagamento}
                        onChange={e => updatePagamento(idx, {
                          tipoPagamento: e.target.value as TipoPagamento,
                          bandeira: ["Débito", "Crédito"].includes(e.target.value) ? "Visa" : "N/A" as Bandeira,
                          parcelas: 1, valorParcela: pag.valor,
                        })}
                        className="flex-1 px-2 py-1.5 rounded-lg text-xs text-foreground outline-none" style={{ background: "hsl(var(--background))" }}>
                        {tiposPagamento.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <input type="number" min={0} step={0.01} value={pag.valor || ""} onChange={e => updatePagamento(idx, { valor: Number(e.target.value) })}
                        className="w-24 px-2 py-1.5 rounded-lg text-xs text-foreground text-right outline-none" style={{ background: "hsl(var(--background))" }} placeholder="R$ 0,00" />
                      <button onClick={() => removePagamento(idx)} className="text-muted-foreground hover:text-destructive transition-colors">
                        <X size={14} />
                      </button>
                    </div>

                    {/* Card brand */}
                    {["Débito", "Crédito"].includes(pag.tipoPagamento) && (
                      <select value={pag.bandeira} onChange={e => updatePagamento(idx, { bandeira: e.target.value as Bandeira })}
                        className="w-full px-2 py-1.5 rounded-lg text-xs text-foreground outline-none" style={{ background: "hsl(var(--background))" }}>
                        {bandeiras.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    )}

                    {/* Credit card installments */}
                    {pag.tipoPagamento === "Crédito" && (
                      <div className="flex gap-2 items-center">
                        <label className="text-[10px] text-muted-foreground whitespace-nowrap">Parcelas:</label>
                        <select value={pag.parcelas} onChange={e => {
                          const p = Number(e.target.value);
                          updatePagamento(idx, { parcelas: p, valorParcela: Number((pag.valor / p).toFixed(2)) });
                        }}
                          className="flex-1 px-2 py-1.5 rounded-lg text-xs text-foreground outline-none" style={{ background: "hsl(var(--background))" }}>
                          {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                            <option key={n} value={n}>{n}x de {formatCurrency(pag.valor / n)}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Conta Assinada observation */}
                    {pag.tipoPagamento === "Conta Assinada" && (
                      <input type="text" placeholder="Nome do funcionário / observação" value={pag.observacao || ""}
                        onChange={e => updatePagamento(idx, { observacao: e.target.value })}
                        className="w-full px-2 py-1.5 rounded-lg text-xs text-foreground placeholder:text-muted-foreground outline-none"
                        style={{ background: "hsl(var(--background))" }} />
                    )}
                  </div>
                ))}
                {pagamentos.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-3">Adicione uma forma de pagamento</p>
                )}
              </div>
            </div>
          </div>

          {/* ─── TOTALS + CTA ─── */}
          <div className="p-5 space-y-3 flex-shrink-0" style={{ borderTop: "1px solid hsl(var(--border))" }}>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Subtotal ({totalItens} {totalItens === 1 ? "item" : "itens"})</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {valorAjuste > 0 && (
                <div className="flex justify-between text-xs">
                  <span className={tipoAjuste === "desconto" ? "text-success" : ""} style={tipoAjuste !== "desconto" ? { color: "hsl(var(--warning))" } : {}}>
                    {tipoAjuste === "desconto" ? "Desconto" : "Acréscimo"}
                  </span>
                  <span className={tipoAjuste === "desconto" ? "text-success" : ""} style={tipoAjuste !== "desconto" ? { color: "hsl(var(--warning))" } : {}}>
                    {tipoAjuste === "desconto" ? "-" : "+"}{formatCurrency(valorAjuste)}
                  </span>
                </div>
              )}
              {totalPagamentos > 0 && restante > 0.01 && (
                <div className="flex justify-between text-xs" style={{ color: "hsl(var(--warning))" }}>
                  <span>Restante</span>
                  <span>{formatCurrency(restante)}</span>
                </div>
              )}
              {trocoCalculado > 0 && (
                <div className="flex justify-between text-xs text-success">
                  <span>Troco</span>
                  <span>{formatCurrency(trocoCalculado)}</span>
                </div>
              )}
            </div>
            <div className="flex justify-between items-baseline pt-2" style={{ borderTop: "1px solid hsl(var(--border))" }}>
              <span className="text-sm font-medium text-foreground">Total</span>
              <span className="text-2xl font-bold text-gold">{formatCurrency(totalFinal)}</span>
            </div>

            <button
              onClick={() => setShowFinalizacao(true)}
              disabled={cart.length === 0 || !vendedora || pagamentos.length === 0 || restante > 0.01}
              className="w-full py-4 rounded-xl text-sm font-bold transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{
                background: cart.length > 0 && vendedora && pagamentos.length > 0 && restante <= 0.01
                  ? "var(--gradient-gold)" : "hsl(var(--muted))",
                color: cart.length > 0 && vendedora && pagamentos.length > 0 && restante <= 0.01
                  ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))",
                boxShadow: cart.length > 0 && vendedora && pagamentos.length > 0 && restante <= 0.01
                  ? "var(--shadow-gold)" : "none",
              }}
            >
              <CheckCircle2 size={18} /> Finalizar Venda (F9)
            </button>

            {!vendedora && cart.length > 0 && (
              <p className="text-[10px] text-center" style={{ color: "hsl(var(--warning))" }}>Selecione uma vendedora</p>
            )}
          </div>
        </aside>
      </div>

      {/* ─── MOBILE: floating cart ─── */}
      {cart.length > 0 && !showPagamento && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 p-4 z-50" style={{ background: "hsl(var(--card))", borderTop: "1px solid hsl(var(--border))" }}>
          <button onClick={() => setShowPagamento(true)}
            className="w-full py-4 rounded-xl text-sm font-bold flex items-center justify-between px-6"
            style={{ background: "var(--gradient-gold)", color: "hsl(var(--primary-foreground))" }}>
            <span className="flex items-center gap-2"><ShoppingCart size={18} /> {totalItens} {totalItens === 1 ? "item" : "itens"}</span>
            <span>{formatCurrency(totalFinal)}</span>
          </button>
        </div>
      )}

      {/* ─── MOBILE: payment sheet ─── */}
      {showPagamento && (
        <div className="md:hidden fixed inset-0 z-[110] flex flex-col" style={{ background: "hsl(var(--background))" }}>
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
            <button onClick={() => setShowPagamento(false)} className="p-2 text-muted-foreground"><ArrowLeft size={20} /></button>
            <h2 className="text-sm font-bold text-foreground">Pagamento</h2>
            <div className="w-9" />
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">Vendedora</label>
              <div className="flex flex-wrap gap-1.5">
                {vendedoras.map(v => (
                  <button key={v} onClick={() => setVendedora(v)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${vendedora === v ? "text-primary-foreground" : "text-muted-foreground"}`}
                    style={vendedora === v ? { background: "hsl(var(--gold))" } : { background: "hsl(var(--surface-raised))" }}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-muted-foreground">Pagamentos</label>
                <button onClick={addPagamento} className="text-xs text-gold flex items-center gap-1"><Plus size={12} /> Adicionar</button>
              </div>
              {pagamentos.map((pag, idx) => (
                <div key={idx} className="rounded-xl p-3 space-y-2 mb-2" style={{ background: "hsl(var(--surface-raised))" }}>
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
                  {pag.tipoPagamento === "Crédito" && (
                    <select value={pag.parcelas} onChange={e => {
                      const p = Number(e.target.value);
                      updatePagamento(idx, { parcelas: p, valorParcela: Number((pag.valor / p).toFixed(2)) });
                    }}
                      className="w-full px-2 py-1.5 rounded-lg text-xs text-foreground outline-none" style={{ background: "hsl(var(--background))" }}>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                        <option key={n} value={n}>{n}x de {formatCurrency(pag.valor / n)}</option>
                      ))}
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
            {restante > 0.01 && <p className="text-xs text-center" style={{ color: "hsl(var(--warning))" }}>Faltam {formatCurrency(restante)}</p>}
            <button onClick={() => { setShowPagamento(false); setShowFinalizacao(true); }}
              disabled={!vendedora || restante > 0.01 || pagamentos.length === 0}
              className="w-full py-4 rounded-xl text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2"
              style={{ background: "var(--gradient-gold)", color: "hsl(var(--primary-foreground))" }}>
              <CheckCircle2 size={18} /> Finalizar Venda
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
