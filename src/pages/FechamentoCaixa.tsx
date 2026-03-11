import { useState, useMemo } from "react";
import {
  DollarSign, ArrowDownCircle, ArrowUpCircle, X, Plus,
  Clock, CheckCircle2, AlertTriangle, Loader2, Store, User,
  Banknote, CreditCard, QrCode, Receipt
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useCaixa } from "@/hooks/useCaixa";
import { useVendas } from "@/hooks/useVendas";
import { formatCurrency, type Deposito } from "@/data/mockData";

const depositos: Deposito[] = ["Casa", "Sumaúma", "Amazonas"];

export default function FechamentoCaixa() {
  const { profile, user, role } = useAuth();
  const isMaster = role === "master";
  const userLoja = (role === "vendedor" && profile?.loja) ? profile.loja : null;
  const { sessoes, movimentacoes, sessaoAberta, abrirCaixa, fecharCaixa, registrarMovimentacao } = useCaixa();
  const { vendas, pagamentos: vendaPagamentos } = useVendas();

  const [loja, setLoja] = useState<string>(userLoja || "Casa");
  const [valorAbertura, setValorAbertura] = useState(0);
  const [valorFechamento, setValorFechamento] = useState(0);
  const [obsFechamento, setObsFechamento] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Sangria / Suprimento
  const [showMovForm, setShowMovForm] = useState<"sangria" | "suprimento" | null>(null);
  const [movValor, setMovValor] = useState(0);
  const [movMotivo, setMovMotivo] = useState("");

  // History
  const [showHistorico, setShowHistorico] = useState(false);

  // Get movements for current session
  const movsSessao = useMemo(() => {
    if (!sessaoAberta) return [];
    return movimentacoes.filter(m => m.sessaoId === sessaoAberta.id);
  }, [movimentacoes, sessaoAberta]);

  const totalSangrias = movsSessao.filter(m => m.tipo === "sangria").reduce((s, m) => s + m.valor, 0);
  const totalSuprimentos = movsSessao.filter(m => m.tipo === "suprimento").reduce((s, m) => s + m.valor, 0);

  // Calculate expected value from sales in this session period
  const valorEsperado = useMemo(() => {
    if (!sessaoAberta) return 0;
    const abertura = new Date(sessaoAberta.abertoEm).getTime();
    // Sum vendas created after session opened for this loja
    const vendasSessao = vendas.filter(v => {
      const created = new Date(v.data).getTime();
      return v.deposito === sessaoAberta.loja && created >= abertura - 86400000; // approximate
    });
    const totalVendas = vendasSessao.reduce((s, v) => s + v.total, 0);
    return sessaoAberta.valorAbertura + totalVendas + totalSuprimentos - totalSangrias;
  }, [sessaoAberta, vendas, totalSangrias, totalSuprimentos]);

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
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Valor de abertura (R$)</label>
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
            <button onClick={handleFecharCaixa} disabled={isLoading || valorFechamento <= 0}
              className="btn-primary w-full py-3 text-sm disabled:opacity-40">
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : "Fechar Caixa"}
            </button>
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
                <div className="text-right">
                  <p className="text-sm font-bold text-foreground">{formatCurrency(s.valorFechamento || 0)}</p>
                  {s.diferenca != null && (
                    <p className={`text-[10px] font-medium ${Math.abs(s.diferenca) < 0.01 ? "text-success" : ""}`}
                      style={Math.abs(s.diferenca) >= 0.01 ? { color: "hsl(var(--warning))" } : {}}>
                      Dif: {formatCurrency(s.diferenca)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
