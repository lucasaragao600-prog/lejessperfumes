import { useState, useMemo, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { usePedidosLista, usePedidosResumo } from "@/hooks/useVendasLista";
import { Search, Eye, Printer, ShoppingCart, Calendar, User, CreditCard, ChevronLeft, FileText, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useNfce } from "@/hooks/useNfce";
import { emitirNfce, imprimirDanfe, explicarRejeicao } from "@/lib/nfceEmitir";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrency } from "@/data/mockData";
import { useApp } from "@/context/AppContext";
import { toast } from "sonner";
import type { NfceStatus } from "@/data/mockData";
import AcoesVendaBotoes from "@/components/vendas/AcoesVendaBotoes";

interface PedidoResumo {
  grupoVenda: string;
  data: string;
  operador: string;
  vendedora: string;
  deposito: string;
  clienteId: string | null;
  clienteNome: string;
  total: number;
  tipoPagamento: string;
  nfceStatus: NfceStatus;
  nfceChave: string;
  itens: {
    perfumeNome: string;
    perfumeId: string;
    quantidade: number;
    precoUnitario: number;
    total: number;
    deposito: string;
  }[];
  pagamentos: { tipoPagamento: string; bandeira: string; valor: number; parcelas: number }[];
}

const fiscalBadge = (status: NfceStatus) => {
  switch (status) {
    case "autorizada":
      return { label: "NFC-e autorizada", bg: "hsl(var(--success) / 0.15)", color: "hsl(var(--success))" };
    case "rejeitada":
      return { label: "NFC-e rejeitada", bg: "hsl(var(--destructive) / 0.15)", color: "hsl(var(--destructive))" };
    case "processando":
      return { label: "NFC-e processando", bg: "hsl(var(--warning) / 0.15)", color: "hsl(var(--warning))" };
    case "sem_certificado":
      return { label: "Sem certificado", bg: "hsl(var(--muted) / 0.5)", color: "hsl(var(--muted-foreground))" };
    default:
      return { label: "NFC-e pendente", bg: "hsl(var(--warning) / 0.15)", color: "hsl(var(--warning))" };
  }
};

export default function PedidosVenda() {
  useAuth();
  const queryClient = useQueryClient();
  const { configFiscal } = useNfce();
  const { perfumes } = useApp();
  const [params, setParams] = useSearchParams();
  const [busca, setBusca] = useState(params.get("pq") || "");
  const [buscaDeb, setBuscaDeb] = useState(busca);
  const [de, setDe] = useState(params.get("pde") || "");
  const [ate, setAte] = useState(params.get("pate") || "");
  const [selectedPedido, setSelectedPedido] = useState<PedidoResumo | null>(null);
  const [gerandoId, setGerandoId] = useState<string | null>(null);

  useEffect(() => { const t = setTimeout(() => setBuscaDeb(busca), 300); return () => clearTimeout(t); }, [busca]);
  useEffect(() => {
    const n = new URLSearchParams(params);
    const set = (k: string, v: string) => (v ? n.set(k, v) : n.delete(k));
    set("pq", buscaDeb.trim()); set("pde", de); set("pate", ate);
    if (n.toString() !== params.toString()) setParams(n, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buscaDeb, de, ate]);

  const filtros = { busca: buscaDeb, data_ini: de, data_fim: ate };
  const lista = usePedidosLista(filtros);
  const resumo = usePedidosResumo(filtros);

  const pedidosFiltrados = useMemo(() => {
    const out: PedidoResumo[] = [];
    for (const pg of lista.data?.pages || []) {
      const pagsPorGrupo = new Map<string, typeof pg.pagamentos>();
      for (const x of pg.pagamentos) { const a = pagsPorGrupo.get(x.grupoVenda) || []; a.push(x); pagsPorGrupo.set(x.grupoVenda, a); }
      const itensPorGrupo = new Map<string, typeof pg.itens>();
      for (const v of pg.itens) { const k = v.grupoVenda || v.id; const a = itensPorGrupo.get(k) || []; a.push(v); itensPorGrupo.set(k, a); }
      for (const g of pg.grupos) {
        const vs = itensPorGrupo.get(g.grupo) || [];
        if (!vs.length) continue;
        const v = vs[0];
        const pags = pagsPorGrupo.get(g.grupo) || [];
        out.push({
          grupoVenda: g.grupo, data: v.data, operador: v.registradoPor || "", vendedora: v.vendedora,
          deposito: v.deposito, clienteId: v.clienteId || null, clienteNome: g.clienteNome,
          total: vs.reduce((s, i) => s + i.total, 0),
          tipoPagamento: pags.length ? pags.map((p) => p.tipoPagamento).join(", ") : v.tipoPagamento,
          nfceStatus: v.nfceStatus || "pendente", nfceChave: v.nfceChave || "",
          itens: vs.map((i) => ({ perfumeNome: i.perfumeNome, perfumeId: i.perfumeId, quantidade: i.quantidade, precoUnitario: i.precoUnitario, total: i.total, deposito: i.deposito })),
          pagamentos: pags.map((p) => ({ tipoPagamento: p.tipoPagamento, bandeira: p.bandeira, valor: p.valor, parcelas: (p as any).parcelas || 1 })),
        });
      }
    }
    return out;
  }, [lista.data]);

  const sentinela = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinela.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => {
      if (e[0].isIntersecting && lista.hasNextPage && !lista.isFetchingNextPage) lista.fetchNextPage();
    }, { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, [lista.hasNextPage, lista.isFetchingNextPage, lista.fetchNextPage, selectedPedido]);

  const perfumesMap = useMemo(() => new Map(perfumes.map((p) => [p.id, p])), [perfumes]);
  const getCasa = (perfumeId: string) => {
    const perf = perfumesMap.get(perfumeId);
    return perf?.marca || perf?.casaSigla || "";
  };

  const handleGerarNfce = async (pedido: PedidoResumo) => {
    setGerandoId(pedido.grupoVenda);
    try {
      const res = await emitirNfce(pedido.grupoVenda);
      queryClient.invalidateQueries({ queryKey: ["nfce_emissoes"] });
      queryClient.invalidateQueries({ queryKey: ["vendas"] });
      if (!res.ok) {
        toast.error(explicarRejeicao(res.cStat ? `${res.cStat} ${res.motivo}` : res.motivo), { duration: 10000 });
        if (selectedPedido?.grupoVenda === pedido.grupoVenda) setSelectedPedido({ ...pedido, nfceStatus: "rejeitada" });
        return;
      }
      toast.success(`NFC-e nº ${res.numero} autorizada${res.ambiente !== "producao" ? " (teste, sem valor fiscal)" : ""}`);
      if (selectedPedido?.grupoVenda === pedido.grupoVenda) setSelectedPedido({ ...pedido, nfceStatus: "autorizada", nfceChave: res.chave || "" });
      await imprimirDanfe(res,
        pedido.itens.map(i => ({ nome: `${getCasa(i.perfumeId)} ${i.perfumeNome}`, quantidade: i.quantidade, precoUnitario: i.precoUnitario, total: i.total })),
        pedido.pagamentos.map(p => ({ tipo: p.tipoPagamento, valor: p.valor })));
    } catch (err) {
      console.error("Erro ao gerar NFC-e:", err);
      toast.error("Erro ao gerar NFC-e");
    } finally {
      setGerandoId(null);
    }
  };

  // Reprint receipt
  const handleReprint = (pedido: PedidoResumo) => {
    const dash = "─".repeat(40);
    const doubleLine = "═".repeat(40);
    const nomeEmpresa = configFiscal?.nomeFantasia || "LE JESS";

    const itensHtml = pedido.itens.map(item => {
      const casa = getCasa(item.perfumeId);
      return `<div style="font-size:13px;font-weight:900;padding:2px 0">
        <div>${casa} - ${item.perfumeNome}</div>
        <div style="display:flex;justify-content:space-between">
          <span>x${item.quantidade}  ${formatCurrency(item.precoUnitario)}</span>
          <span>${formatCurrency(item.total)}</span>
        </div>
      </div>`;
    }).join("");

    const pagsHtml = pedido.pagamentos.length > 0
      ? pedido.pagamentos.map(pg =>
        `<div style="font-size:13px;display:flex;justify-content:space-between;font-weight:900;padding:1px 0">
          <span>${pg.tipoPagamento}</span><span>${formatCurrency(pg.valor)}</span>
        </div>`).join("")
      : `<div style="font-size:13px;font-weight:900">${pedido.tipoPagamento}: ${formatCurrency(pedido.total)}</div>`;

    const printWindow = window.open("", "_blank", "width=320,height=600");
    if (!printWindow) return;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Comprovante</title>
<style>
  @page { size: 72mm auto; margin: 0; }
  body { font-family: Arial, sans-serif; font-size: 13px; line-height: 1.5; color: #000; background: #fff; padding: 2mm; margin: 0; width: 72mm; font-weight: 900; }
</style></head><body>
<div style="text-align:center;font-size:15px;font-weight:900;margin-bottom:6px">${nomeEmpresa}</div>
<div style="font-size:10px">${dash}</div>
<div style="font-size:13px;font-weight:900;margin:3px 0">
  <div style="display:flex;justify-content:space-between"><span>Pedido: ${pedido.grupoVenda.slice(0, 8).toUpperCase()}</span><span>${pedido.data}</span></div>
  <div>Vendedor: ${pedido.vendedora}</div>
  <div>Operador: ${pedido.operador}</div>
  ${pedido.clienteNome ? `<div>Cliente: ${pedido.clienteNome}</div>` : ""}
</div>
<div style="font-size:10px">${dash}</div>
${itensHtml}
<div style="font-size:10px">${dash}</div>
<div style="font-size:14px;font-weight:900;margin:3px 0">FORMA DE PAGAMENTO</div>
${pagsHtml}
<div style="font-size:10px">${dash}</div>
<div style="font-size:11px">${doubleLine}</div>
<div style="font-size:16px;font-weight:900;display:flex;justify-content:space-between;padding:4px 0"><span>TOTAL:</span><span>${formatCurrency(pedido.total)}</span></div>
<div style="font-size:11px">${doubleLine}</div>
${pedido.nfceStatus === "autorizada" && pedido.nfceChave ? `<div style="font-size:10px;margin-top:4px">Chave NFC-e: ${pedido.nfceChave}</div>` : ""}
<div style="font-size:10px;margin-top:4px">${dash}</div>
<div style="text-align:center;font-size:12px;margin-top:6px;font-weight:900">
  <div>Obrigada pela preferência!</div>
  <div style="font-size:11px;margin-top:3px">${pedido.data}</div>
</div>
</body></html>`;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => { printWindow.print(); };
  };

  // Detail view
  if (selectedPedido) {
    const badge = fiscalBadge(selectedPedido.nfceStatus);
    return (
      <div className="space-y-6 animate-page-enter">
        <button onClick={() => setSelectedPedido(null)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft size={16} /> Voltar aos pedidos
        </button>
        <div className="card-premium p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-foreground">
                Pedido #{selectedPedido.grupoVenda.slice(0, 8).toUpperCase()}
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: badge.bg, color: badge.color }}>
                {badge.label}
              </span>
            </div>
            <div className="flex gap-2">
              {(selectedPedido.nfceStatus === "pendente" || selectedPedido.nfceStatus === "sem_certificado" || selectedPedido.nfceStatus === "rejeitada" || selectedPedido.nfceStatus === "autorizada") && (
                <button
                  onClick={() => handleGerarNfce(selectedPedido)}
                  disabled={gerandoId === selectedPedido.grupoVenda}
                  className="px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-2 disabled:opacity-50"
                  style={{ background: "var(--gradient-gold)", color: "hsl(var(--primary-foreground))" }}
                >
                  {gerandoId === selectedPedido.grupoVenda ? <><Loader2 size={14} className="animate-spin" /> Gerando...</> : <><FileText size={14} /> {selectedPedido.nfceStatus === "autorizada" ? "Imprimir NFC-e" : "Gerar NFC-e"}</>}
                </button>
              )}
              <button onClick={() => handleReprint(selectedPedido)} className="btn-secondary px-4 py-2 text-sm flex items-center gap-2">
                <Printer size={14} /> Reimprimir Comprovante
              </button>
            </div>
          </div>
          <AcoesVendaBotoes grupoVenda={selectedPedido.grupoVenda} onClose={() => setSelectedPedido(null)} />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <p className="text-[10px] text-muted-foreground">Data</p>
              <p className="text-sm font-medium text-foreground">{selectedPedido.data}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Operador</p>
              <p className="text-sm font-medium text-foreground">{selectedPedido.operador || "—"}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Vendedor</p>
              <p className="text-sm font-medium text-foreground">{selectedPedido.vendedora || "—"}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Cliente</p>
              <p className="text-sm font-medium text-foreground">{selectedPedido.clienteNome || "—"}</p>
            </div>
          </div>

          {/* NFC-e info */}
          {selectedPedido.nfceStatus === "autorizada" && selectedPedido.nfceChave && (
            <div className="rounded-xl p-3" style={{ background: "hsl(var(--success) / 0.08)", border: "1px solid hsl(var(--success) / 0.2)" }}>
              <p className="text-xs font-medium" style={{ color: "hsl(var(--success))" }}>Chave de acesso NFC-e</p>
              <p className="text-xs text-muted-foreground mt-1 break-all font-mono">{selectedPedido.nfceChave}</p>
            </div>
          )}

          <div style={{ borderTop: "1px solid hsl(var(--border))", paddingTop: "12px" }}>
            <h3 className="text-sm font-bold text-foreground mb-2">Itens</h3>
            <div className="space-y-2">
              {selectedPedido.itens.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 px-3 rounded-lg" style={{ background: "hsl(var(--surface-raised))" }}>
                  <div>
                    <p className="text-sm font-medium text-foreground">{getCasa(item.perfumeId)} - {item.perfumeNome}</p>
                    <p className="text-[10px] text-muted-foreground">{item.deposito} · x{item.quantidade} · {formatCurrency(item.precoUnitario)} un.</p>
                  </div>
                  <span className="text-sm font-bold text-foreground">{formatCurrency(item.total)}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ borderTop: "1px solid hsl(var(--border))", paddingTop: "12px" }}>
            <h3 className="text-sm font-bold text-foreground mb-2">Pagamentos</h3>
            {selectedPedido.pagamentos.length > 0 ? (
              <div className="space-y-1">
                {selectedPedido.pagamentos.map((pg, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{pg.tipoPagamento}{pg.bandeira && pg.bandeira !== "N/A" ? ` (${pg.bandeira})` : ""}</span>
                    <span className="font-bold text-foreground">{formatCurrency(pg.valor)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{selectedPedido.tipoPagamento}: {formatCurrency(selectedPedido.total)}</p>
            )}
          </div>

          <div className="flex justify-between items-center pt-3" style={{ borderTop: "1px solid hsl(var(--border))" }}>
            <span className="text-lg font-bold text-foreground">TOTAL</span>
            <span className="text-lg font-bold text-gold">{formatCurrency(selectedPedido.total)}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-page-enter">
      <div>
        <h1 className="page-title">Pedidos de Venda</h1>
        <p className="page-subtitle mt-1">Histórico completo de vendas realizadas</p>
      </div>

      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por pedido, cliente, operador, produto..."
          className="input-premium pl-10 pr-4 py-2.5 text-sm w-full"
        />
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <input type="date" value={de} onChange={e => setDe(e.target.value)} className="input-premium text-xs" aria-label="De" />
        <span className="text-xs text-muted-foreground">até</span>
        <input type="date" value={ate} onChange={e => setAte(e.target.value)} className="input-premium text-xs" aria-label="Até" />
        {(de || ate || busca) && <button onClick={() => { setDe(""); setAte(""); setBusca(""); }} className="btn-secondary px-3 py-1.5 text-xs">Limpar</button>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="kpi-card">
          <p className="text-xs text-muted-foreground mb-1">Total de pedidos</p>
          <p className="text-lg font-bold text-foreground">{resumo.data?.pedidos ?? "—"}</p>
        </div>
        <div className="kpi-card">
          <p className="text-xs text-muted-foreground mb-1">Valor total</p>
          <p className="text-lg font-bold text-gold">{resumo.data ? formatCurrency(resumo.data.valor) : "—"}</p>
        </div>
        <div className="kpi-card hidden md:block">
          <p className="text-xs text-muted-foreground mb-1">Itens vendidos</p>
          <p className="text-lg font-bold text-foreground">{resumo.data?.qtd ?? "—"}</p>
        </div>
      </div>

      <div className="space-y-2">
        {lista.isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <div key={i} className="card-premium h-[72px] animate-pulse" />)
        ) : lista.isError ? (
          <div className="card-premium p-8 text-center space-y-3">
            <AlertTriangle size={28} className="mx-auto text-destructive" />
            <p className="text-sm text-muted-foreground">Não foi possível carregar os pedidos.</p>
            <button onClick={() => lista.refetch()} className="btn-secondary px-4 py-2 text-sm">Tentar novamente</button>
          </div>
        ) : pedidosFiltrados.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingCart size={40} className="mx-auto text-muted-foreground opacity-30 mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum pedido encontrado</p>
          </div>
        ) : (
          pedidosFiltrados.map(pedido => {
            const badge = fiscalBadge(pedido.nfceStatus);
            return (
              <div key={pedido.grupoVenda} className="card-premium p-4 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-foreground">#{pedido.grupoVenda.slice(0, 8).toUpperCase()}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: badge.bg, color: badge.color }}>
                      {badge.label}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Calendar size={10} /> {pedido.data}</span>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1"><User size={10} /> {pedido.operador || pedido.vendedora}</span>
                    {pedido.clienteNome && (
                      <span className="text-[10px] text-muted-foreground">{pedido.clienteNome}</span>
                    )}
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1"><CreditCard size={10} /> {pedido.tipoPagamento}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-3">
                  <span className="text-sm font-bold text-gold">{formatCurrency(pedido.total)}</span>
                  <div className="flex gap-1">
                    <button onClick={() => setSelectedPedido(pedido)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-all" title="Ver detalhes">
                      <Eye size={16} />
                    </button>
                    <button onClick={() => handleReprint(pedido)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-all" title="Reimprimir">
                      <Printer size={16} />
                    </button>
                    {(pedido.nfceStatus === "pendente" || pedido.nfceStatus === "sem_certificado" || pedido.nfceStatus === "rejeitada") && (
                      <button
                        onClick={() => handleGerarNfce(pedido)}
                        disabled={gerandoId === pedido.grupoVenda}
                        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-all disabled:opacity-50"
                        title="Gerar NFC-e"
                      >
                        {gerandoId === pedido.grupoVenda ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={sentinela} />
        {lista.hasNextPage && (
          <button onClick={() => lista.fetchNextPage()} disabled={lista.isFetchingNextPage} className="btn-secondary w-full py-2.5 text-sm flex items-center justify-center gap-2">
            {lista.isFetchingNextPage ? <><Loader2 size={14} className="animate-spin" /> Carregando...</> : "Carregar mais"}
          </button>
        )}
      </div>
    </div>
  );
}
