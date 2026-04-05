import { useState, useMemo } from "react";
import {
  DollarSign, ArrowDownCircle, ArrowUpCircle, X, Plus,
  Clock, CheckCircle2, AlertTriangle, Loader2, Store, User,
  Banknote, CreditCard, QrCode, Receipt, Printer
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useCaixa, type CaixaSessao } from "@/hooks/useCaixa";
import { useVendas } from "@/hooks/useVendas";
import { formatCurrency, type Deposito } from "@/data/mockData";
import { useNfce } from "@/hooks/useNfce";

const depositos: Deposito[] = ["Casa", "Sumaúma", "Amazonas"];

export default function FechamentoCaixa() {
  const { profile, user, role } = useAuth();
  const isMaster = role === "master";
  const userLoja = (role === "vendedor" && profile?.loja) ? profile.loja : null;
  const { sessoes, movimentacoes, sessaoAberta, abrirCaixa, fecharCaixa, registrarMovimentacao } = useCaixa();
  const { vendas, pagamentos: vendaPagamentos } = useVendas();
  const { configFiscal } = useNfce();

  const [loja, setLoja] = useState<string>(userLoja || "Casa");
  const [valorAbertura, setValorAbertura] = useState(0);
  const [valorFechamento, setValorFechamento] = useState(0);
  const [obsFechamento, setObsFechamento] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Sangria / Suprimento
  const [showMovForm, setShowMovForm] = useState<"sangria" | "suprimento" | null>(null);
  const [movValor, setMovValor] = useState(0);
  const [movMotivo, setMovMotivo] = useState("");

  // Get movements for current session
  const movsSessao = useMemo(() => {
    if (!sessaoAberta) return [];
    return movimentacoes.filter(m => m.sessaoId === sessaoAberta.id);
  }, [movimentacoes, sessaoAberta]);

  const totalSangrias = movsSessao.filter(m => m.tipo === "sangria").reduce((s, m) => s + m.valor, 0);
  const totalSuprimentos = movsSessao.filter(m => m.tipo === "suprimento").reduce((s, m) => s + m.valor, 0);

  // Calculate expected value from sales in this session period
  const vendasSessao = useMemo(() => {
    if (!sessaoAberta) return [];
    const abertura = new Date(sessaoAberta.abertoEm).getTime();
    return vendas.filter(v => {
      const created = new Date(v.data).getTime();
      return v.deposito === sessaoAberta.loja && created >= abertura - 86400000;
    });
  }, [sessaoAberta, vendas]);

  const totalVendasSessao = useMemo(() => vendasSessao.reduce((s, v) => s + v.total, 0), [vendasSessao]);

  const valorEsperado = useMemo(() => {
    if (!sessaoAberta) return 0;
    return sessaoAberta.valorAbertura + totalVendasSessao + totalSuprimentos - totalSangrias;
  }, [sessaoAberta, totalVendasSessao, totalSangrias, totalSuprimentos]);

  // Totals by payment type
  const totaisPorPagamento = useMemo(() => {
    const map: Record<string, number> = {};
    vendasSessao.forEach(v => {
      map[v.tipoPagamento] = (map[v.tipoPagamento] || 0) + v.total;
    });
    return map;
  }, [vendasSessao]);

  // Products sold grouped
  const produtosVendidos = useMemo(() => {
    const map: Record<string, { nome: string; codigo: string; qtd: number; total: number }> = {};
    vendasSessao.forEach(v => {
      if (!map[v.perfumeId]) {
        map[v.perfumeId] = { nome: v.perfumeNome, codigo: "", qtd: 0, total: 0 };
      }
      map[v.perfumeId].qtd += v.quantidade;
      map[v.perfumeId].total += v.total;
    });
    return Object.values(map).sort((a, b) => b.qtd - a.qtd);
  }, [vendasSessao]);

  const handleAbrirCaixa = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      await abrirCaixa({
        operadorId: user.id,
        operadorNome: profile?.nome || "",
        loja,
        valorAbertura,
      });
    } catch (err) {
      console.error("Erro ao abrir caixa:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFecharCaixa = async () => {
    if (!sessaoAberta) return;
    setIsLoading(true);
    try {
      await fecharCaixa({
        sessaoId: sessaoAberta.id,
        valorFechamento,
        valorEsperado,
        observacao: obsFechamento,
      });
      setValorFechamento(0);
      setObsFechamento("");
    } catch (err) {
      console.error("Erro ao fechar caixa:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegistrarMov = async () => {
    if (!sessaoAberta || !showMovForm || movValor <= 0) return;
    setIsLoading(true);
    try {
      await registrarMovimentacao({
        sessaoId: sessaoAberta.id,
        tipo: showMovForm,
        valor: movValor,
        motivo: movMotivo,
        registradoPor: profile?.nome || "",
      });
      setShowMovForm(null);
      setMovValor(0);
      setMovMotivo("");
    } catch (err) {
      console.error("Erro:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", { timeZone: "America/Manaus", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  // Print closing report
  const handlePrintFechamento = (sessao: CaixaSessao) => {
    const movsS = movimentacoes.filter(m => m.sessaoId === sessao.id);
    const sangrias = movsS.filter(m => m.tipo === "sangria").reduce((s, m) => s + m.valor, 0);
    const suprimentos = movsS.filter(m => m.tipo === "suprimento").reduce((s, m) => s + m.valor, 0);

    // Get sales for session period
    const abertura = new Date(sessao.abertoEm).getTime();
    const fechamento = sessao.fechadoEm ? new Date(sessao.fechadoEm).getTime() : Date.now();
    const vendasPeriodo = vendas.filter(v => {
      const created = new Date(v.data).getTime();
      return v.deposito === sessao.loja && created >= abertura - 86400000 && created <= fechamento + 86400000;
    });

    const totalVendido = vendasPeriodo.reduce((s, v) => s + v.total, 0);
    const qtdeVendas = vendasPeriodo.length;

    // Totals by payment type
    const pagMap: Record<string, number> = {};
    vendasPeriodo.forEach(v => { pagMap[v.tipoPagamento] = (pagMap[v.tipoPagamento] || 0) + v.total; });

    // Products sold grouped
    const prodMap: Record<string, { nome: string; codigo: string; qtd: number; total: number }> = {};
    vendasPeriodo.forEach(v => {
      if (!prodMap[v.perfumeId]) prodMap[v.perfumeId] = { nome: v.perfumeNome, codigo: "", qtd: 0, total: 0 };
      prodMap[v.perfumeId].qtd += v.quantidade;
      prodMap[v.perfumeId].total += v.total;
    });
    const prods = Object.values(prodMap).sort((a, b) => b.qtd - a.qtd);

    const dash = "─".repeat(48);
    const nomeEmpresa = configFiscal?.nomeFantasia || "LE JESS";
    const diff = sessao.diferenca ?? (sessao.valorFechamento != null && sessao.valorEsperado != null ? sessao.valorFechamento - sessao.valorEsperado : 0);

    const printWindow = window.open("", "_blank", "width=320,height=800");
    if (!printWindow) return;

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Fechamento de Caixa</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  body { font-family: 'Arial', sans-serif; font-size: 14px; line-height: 1.5; color: #000; background: #fff; padding: 4mm; margin: 0; width: 80mm; font-weight: 900; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .center { text-align: center; }
  .title { font-size: 16px; font-weight: 900; text-align: center; margin-bottom: 4px; }
  .subtitle { font-size: 15px; font-weight: 900; text-align: center; margin-bottom: 8px; }
  .sep { font-size: 11px; color: #000; }
  .double { font-size: 13px; color: #000; }
  .row { display: flex; justify-content: space-between; font-size: 14px; font-weight: 900; padding: 2px 0; }
  .section { font-size: 15px; font-weight: 900; margin: 8px 0 4px 0; }
  .prod-row { display: flex; font-size: 14px; font-weight: 900; padding: 2px 0; }
  .prod-row .pname { flex: 1; word-break: break-word; }
  .prod-row .pqty { width: 40px; text-align: center; flex-shrink: 0; }
  .prod-row .ptotal { width: 80px; text-align: right; flex-shrink: 0; }
  .footer { text-align: center; font-size: 14px; font-weight: 900; margin-top: 12px; }
</style></head><body>
<div class="title">${nomeEmpresa}</div>
<div class="subtitle">FECHAMENTO DE CAIXA</div>
<div class="sep">${dash}</div>
<div class="row"><span>Operador:</span><span>${sessao.operadorNome}</span></div>
<div class="row"><span>Loja:</span><span>${sessao.loja}</span></div>
<div class="row"><span>Abertura:</span><span>${formatDateTime(sessao.abertoEm)}</span></div>
<div class="row"><span>Fechamento:</span><span>${sessao.fechadoEm ? formatDateTime(sessao.fechadoEm) : "—"}</span></div>
<div class="row"><span>Fundo inicial:</span><span>${formatCurrency(sessao.valorAbertura)}</span></div>
${sangrias > 0 ? `<div class="row"><span>Sangrias:</span><span>-${formatCurrency(sangrias)}</span></div>` : ""}
${suprimentos > 0 ? `<div class="row"><span>Suprimentos:</span><span>+${formatCurrency(suprimentos)}</span></div>` : ""}
<div class="sep">${dash}</div>
<div class="section">VENDAS</div>
${pagMap["Dinheiro"] ? `<div class="row"><span>Dinheiro:</span><span>${formatCurrency(pagMap["Dinheiro"])}</span></div>` : ""}
${pagMap["Crédito"] ? `<div class="row"><span>Cartão Crédito:</span><span>${formatCurrency(pagMap["Crédito"])}</span></div>` : ""}
${pagMap["Débito"] ? `<div class="row"><span>Cartão Débito:</span><span>${formatCurrency(pagMap["Débito"])}</span></div>` : ""}
${pagMap["Pix"] ? `<div class="row"><span>PIX:</span><span>${formatCurrency(pagMap["Pix"])}</span></div>` : ""}
${pagMap["Conta Assinada"] ? `<div class="row"><span>Conta Assinada:</span><span>${formatCurrency(pagMap["Conta Assinada"])}</span></div>` : ""}
<div class="row" style="font-size:15px;"><span><strong>Total vendido:</strong></span><span><strong>${formatCurrency(totalVendido)}</strong></span></div>
<div class="row"><span>Qtde vendas:</span><span>${qtdeVendas}</span></div>
<div class="sep">${dash}</div>
<div class="section">CAIXA</div>
<div class="row"><span>Saldo esperado:</span><span>${formatCurrency(sessao.valorEsperado ?? 0)}</span></div>
<div class="row"><span>Valor informado:</span><span>${formatCurrency(sessao.valorFechamento ?? 0)}</span></div>
<div class="row" style="font-size:15px;"><span><strong>Diferença:</strong></span><span><strong>${formatCurrency(diff)}</strong></span></div>
${prods.length > 0 ? `
<div class="sep">${dash}</div>
<div class="section">PRODUTOS VENDIDOS</div>
${prods.map(p => `<div class="prod-row"><span class="pname">${p.nome}</span><span class="pqty">x${p.qtd}</span><span class="ptotal">${formatCurrency(p.total)}</span></div>`).join("")}
` : ""}
<div class="sep">${dash}</div>
${sessao.observacao ? `<div style="font-size:14px; margin:4px 0;">Obs: ${sessao.observacao}</div><div class="sep">${dash}</div>` : ""}
<div class="footer">${nomeEmpresa}</div>
</body></html>`;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => { printWindow.print(); };
  };

  // Print for current open session
  const handlePrintSessaoAberta = () => {
    if (!sessaoAberta) return;
    // Build a temporary session object with current values
    const tempSessao: CaixaSessao = {
      ...sessaoAberta,
      valorFechamento,
      valorEsperado,
      diferenca: valorFechamento - valorEsperado,
      fechadoEm: new Date().toISOString(),
    };
    handlePrintFechamento(tempSessao);
  };

  return (
    <div className="space-y-6 animate-page-enter">
      <div>
        <h1 className="page-title">Caixa</h1>
        <p className="page-subtitle mt-1">Abertura, sangria, suprimento e fechamento</p>
      </div>

      {/* ─── NO SESSION OPEN: OPEN CASH REGISTER ─── */}
      {!sessaoAberta && (
        <div className="card-premium p-6 max-w-lg space-y-4">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <DollarSign size={20} className="text-gold" /> Abrir Caixa
          </h2>
          {!userLoja && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">Loja</label>
              <div className="flex gap-1.5">
                {depositos.map(d => (
                  <button key={d} onClick={() => setLoja(d)}
                    className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${loja === d ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    style={loja === d ? { background: "hsl(var(--gold))" } : { background: "hsl(var(--surface-raised))" }}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Valor de abertura / Fundo de troco (R$)</label>
            <input type="number" min={0} step={0.01} value={valorAbertura || ""}
              onChange={e => setValorAbertura(Number(e.target.value))}
              className="input-premium px-4 py-3"
              placeholder="0,00" />
          </div>
          <button onClick={handleAbrirCaixa} disabled={isLoading}
            className="btn-primary w-full py-3 text-sm disabled:opacity-40">
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : "Abrir Caixa"}
          </button>
        </div>
      )}

      {/* ─── SESSION OPEN ─── */}
      {sessaoAberta && (
        <div className="space-y-6">
          {/* Session info cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="kpi-card">
              <p className="text-xs text-muted-foreground mb-1">Status</p>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                <span className="text-sm font-bold text-success">Aberto</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">{sessaoAberta.operadorNome} · {sessaoAberta.loja}</p>
            </div>
            <div className="kpi-card">
              <p className="text-xs text-muted-foreground mb-1">Abertura</p>
              <p className="text-lg font-bold text-gold">{formatCurrency(sessaoAberta.valorAbertura)}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{formatDateTime(sessaoAberta.abertoEm)}</p>
            </div>
            <div className="kpi-card">
              <p className="text-xs text-muted-foreground mb-1">Sangrias</p>
              <p className="text-lg font-bold" style={{ color: totalSangrias > 0 ? "hsl(var(--destructive))" : "hsl(var(--foreground))" }}>
                -{formatCurrency(totalSangrias)}
              </p>
            </div>
            <div className="kpi-card">
              <p className="text-xs text-muted-foreground mb-1">Suprimentos</p>
              <p className="text-lg font-bold text-success">+{formatCurrency(totalSuprimentos)}</p>
            </div>
          </div>

          {/* Sales summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="kpi-card">
              <p className="text-xs text-muted-foreground mb-1">Vendas da sessão</p>
              <p className="text-lg font-bold text-gold">{formatCurrency(totalVendasSessao)}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{vendasSessao.length} vendas</p>
            </div>
            <div className="kpi-card">
              <p className="text-xs text-muted-foreground mb-1">Saldo esperado</p>
              <p className="text-lg font-bold text-foreground">{formatCurrency(valorEsperado)}</p>
            </div>
            <div className="kpi-card">
              <p className="text-xs text-muted-foreground mb-1">Por forma de pagamento</p>
              <div className="space-y-0.5 mt-1">
                {Object.entries(totaisPorPagamento).map(([tipo, valor]) => (
                  <div key={tipo} className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground">{tipo}</span>
                    <span className="text-foreground font-bold">{formatCurrency(valor)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <button onClick={() => setShowMovForm("sangria")}
              className="btn-secondary px-5 py-2.5 text-sm flex items-center gap-2">
              <ArrowDownCircle size={16} className="text-destructive" /> Sangria
            </button>
            <button onClick={() => setShowMovForm("suprimento")}
              className="btn-secondary px-5 py-2.5 text-sm flex items-center gap-2">
              <ArrowUpCircle size={16} className="text-success" /> Suprimento
            </button>
          </div>

          {/* Movement form modal */}
          {showMovForm && (
            <div className="card-premium p-5 max-w-md space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground capitalize flex items-center gap-2">
                  {showMovForm === "sangria"
                    ? <><ArrowDownCircle size={16} className="text-destructive" /> Sangria</>
                    : <><ArrowUpCircle size={16} className="text-success" /> Suprimento</>}
                </h3>
                <button onClick={() => setShowMovForm(null)} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
              </div>
              <input type="number" min={0} step={0.01} value={movValor || ""}
                onChange={e => setMovValor(Number(e.target.value))}
                className="input-premium px-4 py-3" placeholder="Valor (R$)" />
              <input type="text" value={movMotivo} onChange={e => setMovMotivo(e.target.value)}
                className="input-premium px-4 py-3" placeholder="Motivo" />
              <button onClick={handleRegistrarMov} disabled={isLoading || movValor <= 0}
                className="btn-primary w-full py-2.5 text-sm disabled:opacity-40">
                {isLoading ? <Loader2 size={14} className="animate-spin" /> : "Registrar"}
              </button>
            </div>
          )}

          {/* Session movements */}
          {movsSessao.length > 0 && (
            <div className="card-premium p-5">
              <h3 className="text-sm font-bold text-foreground mb-3">Movimentações da sessão</h3>
              <div className="space-y-2">
                {movsSessao.map(m => (
                  <div key={m.id} className="flex items-center justify-between py-2 px-3 rounded-lg" style={{ background: "hsl(var(--surface-raised))" }}>
                    <div className="flex items-center gap-2">
                      {m.tipo === "sangria"
                        ? <ArrowDownCircle size={14} className="text-destructive" />
                        : <ArrowUpCircle size={14} className="text-success" />}
                      <div>
                        <p className="text-xs font-medium text-foreground capitalize">{m.tipo}</p>
                        <p className="text-[10px] text-muted-foreground">{m.motivo || "Sem motivo"} · {m.registradoPor}</p>
                      </div>
                    </div>
                    <span className={`text-sm font-bold ${m.tipo === "sangria" ? "text-destructive" : "text-success"}`}>
                      {m.tipo === "sangria" ? "-" : "+"}{formatCurrency(m.valor)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Close cash register */}
          <div className="card-premium p-6 max-w-lg space-y-4">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <CheckCircle2 size={20} className="text-gold" /> Fechar Caixa
            </h2>
            <div className="rounded-xl p-4 space-y-2" style={{ background: "hsl(var(--surface-raised))" }}>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Valor esperado</span>
                <span className="font-bold text-foreground">{formatCurrency(valorEsperado)}</span>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Valor contado (R$)</label>
              <input type="number" min={0} step={0.01} value={valorFechamento || ""}
                onChange={e => setValorFechamento(Number(e.target.value))}
                className="input-premium px-4 py-3" placeholder="0,00" />
            </div>
            {valorFechamento > 0 && (
              <div className={`flex justify-between text-sm px-4 py-2 rounded-lg ${
                Math.abs(valorFechamento - valorEsperado) < 0.01 ? "text-success" : ""
              }`} style={{
                background: Math.abs(valorFechamento - valorEsperado) < 0.01 ? "hsl(var(--success) / 0.1)" : "hsl(var(--warning) / 0.1)",
                color: Math.abs(valorFechamento - valorEsperado) < 0.01 ? undefined : "hsl(var(--warning))",
              }}>
                <span>Diferença</span>
                <span className="font-bold">{formatCurrency(valorFechamento - valorEsperado)}</span>
              </div>
            )}
            <textarea value={obsFechamento} onChange={e => setObsFechamento(e.target.value)}
              className="input-premium px-4 py-3 text-sm" rows={2} placeholder="Observações do fechamento..." />
            <div className="flex gap-3">
              <button onClick={handleFecharCaixa} disabled={isLoading || valorFechamento <= 0}
                className="btn-primary flex-1 py-3 text-sm disabled:opacity-40">
                {isLoading ? <Loader2 size={16} className="animate-spin" /> : "Fechar Caixa"}
              </button>
              {valorFechamento > 0 && (
                <button onClick={handlePrintSessaoAberta}
                  className="btn-secondary px-5 py-3 text-sm flex items-center gap-2">
                  <Printer size={16} /> Imprimir
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── SESSION HISTORY ─── */}
      <div className="card-premium p-5">
        <h3 className="text-sm font-bold text-foreground mb-4">Histórico de sessões</h3>
        {sessoes.filter(s => s.status === "fechado").length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">Nenhuma sessão fechada ainda</p>
        ) : (
          <div className="space-y-2">
            {sessoes.filter(s => s.status === "fechado").slice(0, 20).map(s => (
              <div key={s.id} className="flex items-center justify-between py-3 px-4 rounded-lg" style={{ background: "hsl(var(--surface-raised))" }}>
                <div>
                  <p className="text-sm font-medium text-foreground">{s.operadorNome} · {s.loja}</p>
                  <p className="text-[10px] text-muted-foreground">{formatDateTime(s.abertoEm)} → {s.fechadoEm ? formatDateTime(s.fechadoEm) : ""}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-bold text-foreground">{formatCurrency(s.valorFechamento || 0)}</p>
                    {s.diferenca != null && (
                      <p className={`text-[10px] font-medium ${Math.abs(s.diferenca) < 0.01 ? "text-success" : ""}`}
                        style={Math.abs(s.diferenca) >= 0.01 ? { color: "hsl(var(--warning))" } : {}}>
                        Dif: {formatCurrency(s.diferenca)}
                      </p>
                    )}
                  </div>
                  <button onClick={() => handlePrintFechamento(s)}
                    className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-all"
                    title="Imprimir relatório">
                    <Printer size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
