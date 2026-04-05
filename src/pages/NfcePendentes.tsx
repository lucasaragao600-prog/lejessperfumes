import { useState, useMemo } from "react";
import { Search, FileText, AlertTriangle, CheckCircle2, Loader2, Calendar, User, CreditCard, ShieldAlert, Eye, Printer, Download, Key, Filter, X, ChevronLeft } from "lucide-react";
import { useVendas } from "@/hooks/useVendas";
import { useNfce, hasCertificadoConfigurado } from "@/hooks/useNfce";
import { useClientes } from "@/hooks/useClientes";
import { useApp } from "@/context/AppContext";
import { formatCurrency } from "@/data/mockData";
import { toast } from "sonner";
import type { NfceStatus } from "@/data/mockData";

interface NfceRegistro {
  grupoVenda: string;
  data: string;
  operador: string;
  vendedora: string;
  clienteNome: string;
  total: number;
  tipoPagamento: string;
  nfceStatus: NfceStatus;
  nfceChave: string;
  itens: { perfumeId: string; perfumeNome: string; quantidade: number; precoUnitario: number; total: number; deposito: string }[];
  pagamentos: { tipoPagamento: string; bandeira: string; valor: number }[];
}

const statusConfig: Record<string, { label: string; bg: string; color: string }> = {
  autorizada: { label: "NFC-e autorizada", bg: "hsl(var(--success) / 0.15)", color: "hsl(var(--success))" },
  rejeitada: { label: "NFC-e rejeitada", bg: "hsl(var(--destructive) / 0.15)", color: "hsl(var(--destructive))" },
  processando: { label: "Em processamento", bg: "hsl(var(--warning) / 0.15)", color: "hsl(var(--warning))" },
  sem_certificado: { label: "Sem certificado", bg: "hsl(var(--muted) / 0.5)", color: "hsl(var(--muted-foreground))" },
  pendente: { label: "Pendente de emissão", bg: "hsl(var(--warning) / 0.15)", color: "hsl(var(--warning))" },
};

const getBadge = (s: NfceStatus) => statusConfig[s] || statusConfig.pendente;

const statusFilterOptions: { value: string; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "pendente", label: "Pendente" },
  { value: "processando", label: "Processando" },
  { value: "autorizada", label: "Autorizada" },
  { value: "rejeitada", label: "Rejeitada" },
  { value: "sem_certificado", label: "Sem certificado" },
];

export default function NfcePendentes() {
  const { vendas, pagamentos: vendaPagamentos, atualizarNfceStatus } = useVendas();
  const { configFiscal, criarEmissao, gerarXmlNfce, emissoes } = useNfce();
  const { clientes } = useClientes();
  const { perfumes } = useApp();

  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [gerandoId, setGerandoId] = useState<string | null>(null);
  const [selected, setSelected] = useState<NfceRegistro | null>(null);

  const temCertificado = hasCertificadoConfigurado(configFiscal);

  // Build grouped records
  const registros = useMemo(() => {
    const map = new Map<string, NfceRegistro>();
    for (const v of vendas) {
      const gv = v.grupoVenda || v.id;
      if (!map.has(gv)) {
        const cliente = v.clienteId ? clientes.find(c => c.id === v.clienteId) : null;
        map.set(gv, {
          grupoVenda: gv,
          data: v.data,
          operador: v.registradoPor || "",
          vendedora: v.vendedora,
          clienteNome: cliente?.nome || "",
          total: 0,
          tipoPagamento: v.tipoPagamento,
          nfceStatus: v.nfceStatus || "pendente",
          nfceChave: v.nfceChave || "",
          itens: [],
          pagamentos: [],
        });
      }
      const p = map.get(gv)!;
      p.total += v.total;
      p.itens.push({
        perfumeId: v.perfumeId,
        perfumeNome: v.perfumeNome,
        quantidade: v.quantidade,
        precoUnitario: v.precoUnitario,
        total: v.total,
        deposito: v.deposito,
      });
    }
    for (const [gv, p] of map) {
      const pags = vendaPagamentos.filter(pg => pg.grupoVenda === gv);
      if (pags.length > 0) {
        p.pagamentos = pags.map(pg => ({ tipoPagamento: pg.tipoPagamento, bandeira: pg.bandeira, valor: pg.valor }));
        p.tipoPagamento = pags.map(pg => pg.tipoPagamento).join(", ");
      }
      // Enrich with emissao data
      const emissao = emissoes.find(e => e.vendaGrupoVenda === gv);
      if (emissao) {
        if (emissao.chaveAcesso) p.nfceChave = emissao.chaveAcesso;
      }
    }
    return Array.from(map.values()).sort((a, b) => b.data.localeCompare(a.data));
  }, [vendas, vendaPagamentos, clientes, emissoes]);

  // Apply filters
  const filtrados = useMemo(() => {
    let list = registros;
    if (filtroStatus !== "todos") {
      list = list.filter(r => r.nfceStatus === filtroStatus);
    }
    if (busca.trim()) {
      const q = busca.toLowerCase();
      list = list.filter(r =>
        r.grupoVenda.toLowerCase().includes(q) ||
        r.clienteNome.toLowerCase().includes(q) ||
        r.operador.toLowerCase().includes(q) ||
        r.data.includes(q)
      );
    }
    return list;
  }, [registros, filtroStatus, busca]);

  // Counts
  const counts = useMemo(() => {
    const c = { pendente: 0, processando: 0, autorizada: 0, rejeitada: 0, sem_certificado: 0, total: registros.length };
    for (const r of registros) {
      if (r.nfceStatus in c) (c as any)[r.nfceStatus]++;
    }
    return c;
  }, [registros]);

  const getCasa = (perfumeId: string) => {
    const perf = perfumes.find(p => p.id === perfumeId);
    return perf?.marca || "";
  };

  const handleGerarNfce = async (reg: NfceRegistro) => {
    if (!temCertificado) {
      toast.error("Certificado digital não configurado. Acesse Configurações.");
      return;
    }
    setGerandoId(reg.grupoVenda);
    try {
      await criarEmissao({ vendaGrupoVenda: reg.grupoVenda });
      if (configFiscal) {
        gerarXmlNfce({
          emitente: configFiscal,
          itens: reg.itens.map(item => ({
            codigo: item.perfumeId.slice(0, 8),
            descricao: `${getCasa(item.perfumeId)} - ${item.perfumeNome}`,
            ncm: "33030010", cfop: "5102", cstCsosn: "102", unidade: "UN",
            quantidade: item.quantidade, valor: item.precoUnitario,
          })),
          pagamentos: reg.pagamentos.map(p => ({ forma: p.tipoPagamento, valor: p.valor })),
          total: reg.total,
          numero: configFiscal.proximoNumeroNfce,
          serie: configFiscal.serieNfce,
        });
      }
      // XML generated but NOT authorized - needs real SEFAZ
      await atualizarNfceStatus({ grupoVenda: reg.grupoVenda, nfceStatus: "pendente" });
      toast.info("XML gerado. Aguardando integração com SEFAZ para autorização.");
      if (selected?.grupoVenda === reg.grupoVenda) {
        setSelected({ ...reg, nfceStatus: "pendente" });
      }
    } catch (err) {
      console.error("Erro ao gerar NFC-e:", err);
      toast.error("Erro ao gerar NFC-e");
    } finally {
      setGerandoId(null);
    }
  };

  const handlePrintDanfe = (reg: NfceRegistro) => {
    if (reg.nfceStatus !== "autorizada") return;
    handlePrintReceipt(reg, true);
  };

  const handlePrintReceipt = (reg: NfceRegistro, isDanfe = false) => {
    const dash = "─".repeat(40);
    const doubleLine = "═".repeat(40);
    const nome = configFiscal?.nomeFantasia || "LE JESS";

    const itensHtml = reg.itens.map(item => {
      const casa = getCasa(item.perfumeId);
      return `<div style="font-size:13px;font-weight:900;padding:2px 0">
        <div>${casa} - ${item.perfumeNome}</div>
        <div style="display:flex;justify-content:space-between">
          <span>x${item.quantidade}  ${formatCurrency(item.precoUnitario)}</span>
          <span>${formatCurrency(item.total)}</span>
        </div>
      </div>`;
    }).join("");

    const pagsHtml = reg.pagamentos.length > 0
      ? reg.pagamentos.map(pg =>
        `<div style="font-size:13px;display:flex;justify-content:space-between;font-weight:900;padding:1px 0">
          <span>${pg.tipoPagamento}</span><span>${formatCurrency(pg.valor)}</span>
        </div>`).join("")
      : `<div style="font-size:13px;font-weight:900">${reg.tipoPagamento}: ${formatCurrency(reg.total)}</div>`;

    const nfceSection = isDanfe && reg.nfceChave
      ? `<div style="font-size:10px;margin-top:4px;border-top:1px dashed #000;padding-top:4px">
          <div style="font-weight:900">NFC-e AUTORIZADA</div>
          <div>Chave: ${reg.nfceChave}</div>
        </div>` : "";

    const pw = window.open("", "_blank", "width=320,height=600");
    if (!pw) return;
    pw.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${isDanfe ? "DANFE NFC-e" : "Comprovante"}</title>
<style>@page{size:72mm auto;margin:0}body{font-family:Arial,sans-serif;font-size:13px;line-height:1.5;color:#000;background:#fff;padding:2mm;margin:0;width:72mm;font-weight:900}</style></head><body>
<div style="text-align:center;font-size:15px;font-weight:900;margin-bottom:6px">${nome}</div>
${isDanfe ? '<div style="text-align:center;font-size:11px;font-weight:900;margin-bottom:4px">DANFE NFC-e</div>' : ''}
<div style="font-size:10px">${dash}</div>
<div style="font-size:13px;font-weight:900;margin:3px 0">
  <div style="display:flex;justify-content:space-between"><span>#${reg.grupoVenda.slice(0, 8).toUpperCase()}</span><span>${reg.data}</span></div>
  <div>Operador: ${reg.operador || reg.vendedora}</div>
  ${reg.clienteNome ? `<div>Cliente: ${reg.clienteNome}</div>` : ""}
</div>
<div style="font-size:10px">${dash}</div>
${itensHtml}
<div style="font-size:10px">${dash}</div>
<div style="font-size:14px;font-weight:900;margin:3px 0">FORMA DE PAGAMENTO</div>
${pagsHtml}
<div style="font-size:10px">${dash}</div>
<div style="font-size:11px">${doubleLine}</div>
<div style="font-size:16px;font-weight:900;display:flex;justify-content:space-between;padding:4px 0"><span>TOTAL:</span><span>${formatCurrency(reg.total)}</span></div>
<div style="font-size:11px">${doubleLine}</div>
${nfceSection}
<div style="text-align:center;font-size:12px;margin-top:6px;font-weight:900">Obrigada pela preferência!</div>
</body></html>`);
    pw.document.close();
    pw.onload = () => pw.print();
  };

  const canEmit = (s: NfceStatus) => s === "pendente" || s === "rejeitada";

  // ─── Detail View ───
  if (selected) {
    const badge = getBadge(selected.nfceStatus);
    const emissao = emissoes.find(e => e.vendaGrupoVenda === selected.grupoVenda);
    return (
      <div className="space-y-6 animate-page-enter">
        <button onClick={() => setSelected(null)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft size={16} /> Voltar
        </button>
        <div className="card-premium p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-foreground">NFC-e #{selected.grupoVenda.slice(0, 8).toUpperCase()}</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: badge.bg, color: badge.color }}>{badge.label}</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              {canEmit(selected.nfceStatus) && temCertificado && (
                <button onClick={() => handleGerarNfce(selected)} disabled={gerandoId === selected.grupoVenda}
                  className="px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-2 disabled:opacity-50"
                  style={{ background: "var(--gradient-gold)", color: "hsl(var(--primary-foreground))" }}>
                  {gerandoId === selected.grupoVenda ? <><Loader2 size={14} className="animate-spin" /> Gerando...</> : <><FileText size={14} /> Gerar NFC-e</>}
                </button>
              )}
              {selected.nfceStatus === "autorizada" && (
                <>
                  <button onClick={() => handlePrintDanfe(selected)} className="btn-secondary px-4 py-2 text-xs flex items-center gap-2">
                    <Printer size={14} /> Imprimir DANFE
                  </button>
                  {emissao?.xmlUrl && (
                    <a href={emissao.xmlUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary px-4 py-2 text-xs flex items-center gap-2">
                      <Download size={14} /> Baixar XML
                    </a>
                  )}
                </>
              )}
              <button onClick={() => handlePrintReceipt(selected)} className="btn-secondary px-4 py-2 text-xs flex items-center gap-2">
                <Printer size={14} /> Comprovante
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { l: "Data", v: selected.data },
              { l: "Operador", v: selected.operador || "—" },
              { l: "Vendedor", v: selected.vendedora || "—" },
              { l: "Cliente", v: selected.clienteNome || "—" },
            ].map(f => (
              <div key={f.l}><p className="text-[10px] text-muted-foreground">{f.l}</p><p className="text-sm font-medium text-foreground">{f.v}</p></div>
            ))}
          </div>

          {/* NFC-e fiscal info */}
          {selected.nfceStatus === "autorizada" && selected.nfceChave && (
            <div className="rounded-xl p-3" style={{ background: "hsl(var(--success) / 0.08)", border: "1px solid hsl(var(--success) / 0.2)" }}>
              <p className="text-xs font-medium" style={{ color: "hsl(var(--success))" }}>NFC-e Autorizada</p>
              <div className="mt-1 space-y-1">
                <p className="text-[10px] text-muted-foreground"><span className="font-bold">Chave:</span> <span className="font-mono break-all">{selected.nfceChave}</span></p>
                {emissao?.protocoloAutorizacao && <p className="text-[10px] text-muted-foreground"><span className="font-bold">Protocolo:</span> {emissao.protocoloAutorizacao}</p>}
                {emissao?.dataEmissao && <p className="text-[10px] text-muted-foreground"><span className="font-bold">Emissão:</span> {new Date(emissao.dataEmissao).toLocaleString("pt-BR")}</p>}
                {emissao?.xmlUrl && <p className="text-[10px] flex items-center gap-1" style={{ color: "hsl(var(--success))" }}><CheckCircle2 size={10} /> XML disponível</p>}
              </div>
            </div>
          )}

          {selected.nfceStatus === "rejeitada" && (
            <div className="rounded-xl p-3" style={{ background: "hsl(var(--destructive) / 0.08)", border: "1px solid hsl(var(--destructive) / 0.2)" }}>
              <p className="text-xs font-medium" style={{ color: "hsl(var(--destructive))" }}>NFC-e Rejeitada</p>
              {emissao?.motivoRejeicao && <p className="text-[10px] text-muted-foreground mt-1">{emissao.motivoRejeicao}</p>}
            </div>
          )}

          {/* Items */}
          <div style={{ borderTop: "1px solid hsl(var(--border))", paddingTop: "12px" }}>
            <h3 className="text-sm font-bold text-foreground mb-2">Itens</h3>
            <div className="space-y-2">
              {selected.itens.map((item, idx) => (
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

          {/* Payments */}
          <div style={{ borderTop: "1px solid hsl(var(--border))", paddingTop: "12px" }}>
            <h3 className="text-sm font-bold text-foreground mb-2">Pagamentos</h3>
            {selected.pagamentos.length > 0 ? (
              <div className="space-y-1">
                {selected.pagamentos.map((pg, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{pg.tipoPagamento}{pg.bandeira && pg.bandeira !== "N/A" ? ` (${pg.bandeira})` : ""}</span>
                    <span className="font-bold text-foreground">{formatCurrency(pg.valor)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{selected.tipoPagamento}: {formatCurrency(selected.total)}</p>
            )}
          </div>

          <div className="flex justify-between items-center pt-3" style={{ borderTop: "1px solid hsl(var(--border))" }}>
            <span className="text-lg font-bold text-foreground">TOTAL</span>
            <span className="text-lg font-bold text-gold">{formatCurrency(selected.total)}</span>
          </div>
        </div>
      </div>
    );
  }

  // ─── List View ───
  return (
    <div className="space-y-6 animate-page-enter">
      <div>
        <h1 className="page-title">NFC-e</h1>
        <p className="page-subtitle mt-1">Gestão fiscal de NFC-e — emissão, consulta e impressão</p>
      </div>

      {!temCertificado && (
        <div className="rounded-xl p-4 flex items-start gap-3" style={{ background: "hsl(var(--destructive) / 0.1)", border: "1px solid hsl(var(--destructive) / 0.2)" }}>
          <ShieldAlert size={20} style={{ color: "hsl(var(--destructive))" }} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold" style={{ color: "hsl(var(--destructive))" }}>Certificado digital não configurado</p>
            <p className="text-xs text-muted-foreground mt-1">Configure o certificado digital A1 em Configurações para emitir NFC-e.</p>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="flex flex-wrap gap-3">
        {[
          { label: "Total", value: counts.total, color: "text-foreground" },
          { label: "Pendentes", value: counts.pendente, color: "text-warning" },
          { label: "Autorizadas", value: counts.autorizada, color: "text-success" },
          { label: "Rejeitadas", value: counts.rejeitada, color: "text-destructive" },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <p className="text-xs text-muted-foreground mb-1">{k.label}</p>
            <p className={`text-lg font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Search + filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por pedido, cliente, operador, data..."
            className="input-premium pl-10 pr-4 py-2.5 text-sm w-full" />
        </div>
        <div className="flex gap-1 flex-wrap">
          {statusFilterOptions.map(opt => (
            <button key={opt.value} onClick={() => setFiltroStatus(opt.value)}
              className={`px-3 py-2 text-xs font-medium rounded-xl transition-all ${filtroStatus === opt.value ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              style={filtroStatus === opt.value ? { background: "hsl(var(--gold) / 0.12)", border: "1px solid hsl(var(--gold) / 0.3)" } : { background: "hsl(var(--surface-raised))", border: "1px solid transparent" }}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        {filtrados.length === 0 ? (
          <div className="text-center py-12">
            <FileText size={40} className="mx-auto text-muted-foreground opacity-30 mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma NFC-e encontrada</p>
          </div>
        ) : (
          filtrados.map(reg => {
            const badge = getBadge(reg.nfceStatus);
            return (
              <div key={reg.grupoVenda} className="card-premium p-4 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-foreground">#{reg.grupoVenda.slice(0, 8).toUpperCase()}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: badge.bg, color: badge.color }}>
                      {badge.label}
                    </span>
                    {reg.nfceStatus === "autorizada" && reg.nfceChave && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Key size={9} /> Chave disponível</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Calendar size={10} /> {reg.data}</span>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1"><User size={10} /> {reg.operador || reg.vendedora}</span>
                    {reg.clienteNome && <span className="text-[10px] text-muted-foreground">{reg.clienteNome}</span>}
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1"><CreditCard size={10} /> {reg.tipoPagamento}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-3">
                  <span className="text-sm font-bold text-gold">{formatCurrency(reg.total)}</span>
                  <div className="flex gap-1">
                    <button onClick={() => setSelected(reg)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-all" title="Ver detalhes">
                      <Eye size={16} />
                    </button>
                    {reg.nfceStatus === "autorizada" && (
                      <button onClick={() => handlePrintDanfe(reg)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-all" title="Imprimir DANFE">
                        <Printer size={16} />
                      </button>
                    )}
                    {canEmit(reg.nfceStatus) && temCertificado && (
                      <button onClick={() => handleGerarNfce(reg)} disabled={gerandoId === reg.grupoVenda}
                        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-all disabled:opacity-50" title="Gerar NFC-e">
                        {gerandoId === reg.grupoVenda ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
