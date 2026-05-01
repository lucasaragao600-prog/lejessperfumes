import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  ArrowLeft, Search, ScanBarcode, Save, CheckCircle2, AlertTriangle,
  Volume2, VolumeX, Plus, Minus, Layers, X, Link as LinkIcon, EyeOff, ImageOff
} from "lucide-react";
import { useBalancos, useBalancoItens, type BalancoItem } from "@/hooks/useBalancos";
import { useAuth } from "@/context/AuthContext";
import { usePerfumes } from "@/hooks/usePerfumes";
import { useProdutoGtins } from "@/hooks/useProdutoGtins";
import PerfumeSearchSelect from "@/components/PerfumeSearchSelect";
import { useBalancoLeituras } from "@/hooks/useBalancoLeituras";
import { useConfiguracoes } from "@/hooks/useConfiguracoes";
import { useCasas } from "@/hooks/useCasas";
import { toast } from "sonner";

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  sem_divergencia: "OK",
  sobra: "Sobra",
  falta: "Falta",
};

const STATUS_STYLE: Record<string, string> = {
  pendente: "bg-muted text-muted-foreground",
  sem_divergencia: "bg-success/15 text-success border border-success/30",
  sobra: "bg-warning/15 text-warning border border-warning/30",
  falta: "bg-destructive/15 text-destructive border border-destructive/30",
};

interface Props {
  balancoId: string;
  onBack: () => void;
  onOpenHistorico: (id: string) => void;
}

let beepCtx: AudioContext | null = null;

function getBeepContext() {
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!beepCtx || beepCtx.state === "closed") {
    beepCtx = new AudioCtx();
  }
  return beepCtx;
}

function primeBeep() {
  try {
    const ctx = getBeepContext();
    if (ctx?.state === "suspended") void ctx.resume();
  } catch {}
}

// bip simples via WebAudio (sem assets)
function playBeep(ok: boolean) {
  try {
    const ctx = getBeepContext();
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = ok ? 1200 : 320;
    g.gain.value = 0.08;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + (ok ? 0.08 : 0.18));
  } catch {}
}

export default function BalancoConferencia({ balancoId, onBack, onOpenHistorico }: Props) {
  const { profile, role } = useAuth();
  const isMaster = role === "master";
  const { balancos, atualizarItem, bipar, concluirBalanco, aplicarAjustes, recalcularTotais } = useBalancos();
  const { data: itens = [], isLoading } = useBalancoItens(balancoId);
  const { data: leituras = [] } = useBalancoLeituras(balancoId);
  const { concentracoesConfig } = useConfiguracoes();
  const { casas } = useCasas();
  const { perfumes } = usePerfumes();
  const balanco = balancos.find((b) => b.id === balancoId);

  const isCega = balanco?.tipo_contagem === "cega";
  const isBarras = balanco?.modo_contagem === "codigo_barras";
  const editavel = balanco?.status === "em_andamento" || balanco?.status === "rascunho";

  const [busca, setBusca] = useState("");
  const [filtroDeposito, setFiltroDeposito] = useState<string>("Todos");
  const [filtroStatus, setFiltroStatus] = useState<string>("Todos");
  const [edits, setEdits] = useState<Record<string, { qtd: string; just: string }>>({});
  const [showRevisao, setShowRevisao] = useState(false);
  const [ordenarDivergencia, setOrdenarDivergencia] = useState(false);

  // Modo contagem rápida (scan)
  const [scanCodigo, setScanCodigo] = useState("");
  const [scanQtd, setScanQtd] = useState("1");
  const [somAtivo, setSomAtivo] = useState(true);
  const [contagemAtiva, setContagemAtiva] = useState<1 | 2>(1);
  const [ultimoBip, setUltimoBip] = useState<{
    nome: string; deposito: string; qtd: number; ok: boolean; ts: number;
  } | null>(null);
  const [naoEncontrado, setNaoEncontrado] = useState<{ codigo: string } | null>(null);
  const scanRef = useRef<HTMLInputElement>(null);
  const buscaRef = useRef<HTMLInputElement>(null);
  const scanCodigoRef = useRef("");
  const globalScanBufferRef = useRef("");
  const globalScanTimeoutRef = useRef<number | null>(null);
  const scanIdleTimeoutRef = useRef<number | null>(null);
  const scanCaptureRef = useRef({ startedAt: 0, lastAt: 0, count: 0 });
  const autoSubmittingRef = useRef(false);
  const [tab, setTab] = useState<"scan" | "lista">(isBarras ? "scan" : "lista");
  const casaLabelMap = useMemo(() => Object.fromEntries(casas.map((c) => [c.sigla, c.nome])), [casas]);

  // Lançamento rápido na aba Lista (bipe + busca manual)
  const [listaCodigo, setListaCodigo] = useState("");
  const [listaPerfumeId, setListaPerfumeId] = useState("");
  const [listaQtd, setListaQtd] = useState("1");
  const listaCodigoRef = useRef<HTMLInputElement>(null);

  // Auto-focus contínuo no campo de scan
  useEffect(() => {
    if (tab === "scan") scanRef.current?.focus();
    else buscaRef.current?.focus();
  }, [tab]);

  const resetScanCapture = useCallback(() => {
    scanCaptureRef.current = { startedAt: 0, lastAt: 0, count: 0 };
    globalScanBufferRef.current = "";
    if (scanIdleTimeoutRef.current) {
      window.clearTimeout(scanIdleTimeoutRef.current);
      scanIdleTimeoutRef.current = null;
    }
    if (globalScanTimeoutRef.current) {
      window.clearTimeout(globalScanTimeoutRef.current);
      globalScanTimeoutRef.current = null;
    }
  }, []);

  // Re-focus se perder foco no modo scan (e não tiver modal aberto)
  useEffect(() => {
    if (tab !== "scan") return;
    const h = setInterval(() => {
      if (
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA" &&
        !naoEncontrado
      ) {
        scanRef.current?.focus();
      }
    }, 1500);
    return () => clearInterval(h);
  }, [tab, naoEncontrado]);

  useEffect(() => () => resetScanCapture(), [resetScanCapture]);

  const depositos = useMemo(() => {
    const set = new Set(itens.map((i) => i.deposito));
    return ["Todos", ...Array.from(set)];
  }, [itens]);

  const filtrados = useMemo(() => {
    let lista = itens.filter((i) => {
      if (filtroDeposito !== "Todos" && i.deposito !== filtroDeposito) return false;
      if (filtroStatus !== "Todos" && i.status !== filtroStatus) return false;
      if (busca) {
        const b = busca.toLowerCase();
        return (
          i.perfume_nome.toLowerCase().includes(b) ||
          i.perfume_codigo.toLowerCase().includes(b) ||
          i.marca.toLowerCase().includes(b)
        );
      }
      return true;
    });
    if (ordenarDivergencia) {
      lista = [...lista].sort(
        (a, b) => Math.abs(b.diferenca) - Math.abs(a.diferenca)
      );
    }
    return lista;
  }, [itens, busca, filtroDeposito, filtroStatus, ordenarDivergencia]);

  const totalConferidos = itens.filter((i) => i.status !== "pendente").length;
  const pendentes = itens.length - totalConferidos;
  const totalDiverg = itens.filter((i) => i.status === "sobra" || i.status === "falta").length;
  const sobras = itens.filter((i) => i.status === "sobra").length;
  const faltas = itens.filter((i) => i.status === "falta").length;
  const valorDiverg = itens.reduce((s, i) => s + Number(i.impacto_financeiro || 0), 0);
  const progresso = itens.length ? Math.round((totalConferidos / itens.length) * 100) : 0;

  const handleScan = useCallback(async (codigoOpt?: string, qtdOpt?: number) => {
    const codigoAtual = codigoOpt ?? scanCodigoRef.current ?? scanRef.current?.value ?? scanCodigo;
    const codigo = codigoAtual.trim();
    const qtd = qtdOpt ?? (parseInt(scanQtd, 10) || 1);
    if (!codigo) return;
    scanCodigoRef.current = "";
    setScanCodigo("");
    try {
      console.log("[balanco-scan] processando", { codigo, qtd, via: codigoOpt ? "direto" : "estado" });
      const dep = filtroDeposito !== "Todos" ? filtroDeposito : undefined;
      const r = await bipar({
        balancoId,
        codigo,
        quantidade: qtd,
        deposito: dep,
        contagem: balanco?.dupla_conferencia ? contagemAtiva : 1,
        usuario: profile?.nome || "—",
      });

      if (r.tipo === "ok") {
        if (somAtivo) playBeep(true);
        setUltimoBip({
          nome: r.item.perfume_nome,
          deposito: r.item.deposito,
          qtd: r.novaQtd,
          ok: true,
          ts: Date.now(),
        });
        // recálculo dos totais a cada N leituras
      } else if (r.tipo === "produto_fora_balanco") {
        if (somAtivo) playBeep(false);
        toast.warning(`Produto encontrado mas fora deste balanço (filtro/depósito).`);
      } else {
        if (somAtivo) playBeep(false);
        setNaoEncontrado({ codigo });
      }
    } catch (e: any) {
      if (somAtivo) playBeep(false);
      toast.error(e?.message || "Erro ao processar leitura");
    } finally {
      resetScanCapture();
      setTimeout(() => scanRef.current?.focus(), 50);
    }
  }, [balancoId, scanCodigo, scanQtd, filtroDeposito, somAtivo, profile, contagemAtiva, balanco?.dupla_conferencia, bipar, resetScanCapture]);

  const scheduleAutoScan = useCallback((codigo: string) => {
    if (tab !== "scan" || !editavel) return;
    if (scanIdleTimeoutRef.current) window.clearTimeout(scanIdleTimeoutRef.current);

    const valor = codigo.trim();
    if (!valor) return;

    scanIdleTimeoutRef.current = window.setTimeout(() => {
      const meta = scanCaptureRef.current;
      const elapsed = meta.lastAt - meta.startedAt;
      const avgInterval = meta.count > 1 ? elapsed / (meta.count - 1) : 999;
      const scannerProvavel = meta.count >= 2 && avgInterval <= 60;

      if (!scannerProvavel || autoSubmittingRef.current) return;

      autoSubmittingRef.current = true;
      void handleScan(valor, parseInt(scanQtd, 10) || 1).finally(() => {
        autoSubmittingRef.current = false;
      });
    }, 90);
  }, [tab, editavel, handleScan, scanQtd]);

  // Captura bip do leitor mesmo quando a aba Lista/busca estiver focada.
  useEffect(() => {
    if (!isBarras || !editavel || naoEncontrado) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (document.activeElement === scanRef.current) return;

      const agora = performance.now();
      const meta = scanCaptureRef.current;
      if (!meta.lastAt || agora - meta.lastAt > 120) {
        scanCaptureRef.current = { startedAt: agora, lastAt: agora, count: 0 };
        globalScanBufferRef.current = "";
      }

      if (e.key === "Enter") {
        const codigo = globalScanBufferRef.current.trim();
        const atual = scanCaptureRef.current;
        const elapsed = atual.lastAt - atual.startedAt;
        const avgInterval = atual.count > 1 ? elapsed / (atual.count - 1) : 999;
        if (codigo.length >= 4 && atual.count >= 4 && avgInterval <= 70) {
          e.preventDefault();
          primeBeep();
          void handleScan(codigo, parseInt(scanQtd, 10) || 1);
        }
        globalScanBufferRef.current = "";
        return;
      }

      if (e.key.length !== 1) return;
      globalScanBufferRef.current += e.key;
      scanCaptureRef.current = {
        startedAt: scanCaptureRef.current.startedAt || agora,
        lastAt: agora,
        count: scanCaptureRef.current.count + 1,
      };
      if (globalScanTimeoutRef.current) window.clearTimeout(globalScanTimeoutRef.current);
      globalScanTimeoutRef.current = window.setTimeout(() => {
        globalScanBufferRef.current = "";
      }, 180);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [editavel, handleScan, isBarras, naoEncontrado, scanQtd]);

  const handleSalvarItem = async (item: BalancoItem) => {
    const e = edits[item.id];
    if (!e || e.qtd === "") return;
    const qtd = parseInt(e.qtd, 10);
    if (isNaN(qtd) || qtd < 0) {
      toast.error("Quantidade inválida");
      return;
    }
    const diff = qtd - item.estoque_sistema;
    if (!isCega && diff !== 0 && !e.just.trim()) {
      toast.error("Justificativa obrigatória para divergência");
      return;
    }
    await atualizarItem({
      itemId: item.id,
      quantidade_contada: qtd,
      contagem: balanco?.dupla_conferencia ? contagemAtiva : 1,
      justificativa: e.just,
      conferido_por: profile?.nome || "—",
      estoque_sistema: item.estoque_sistema,
      custo_unitario: item.custo_unitario,
    });
    setEdits((p) => {
      const n = { ...p };
      delete n[item.id];
      return n;
    });
    toast.success("Item conferido");
  };

  const handleSalvarTudo = async () => {
    let count = 0;
    for (const [itemId, e] of Object.entries(edits)) {
      if (e.qtd === "") continue;
      const item = itens.find((i) => i.id === itemId);
      if (!item) continue;
      const qtd = parseInt(e.qtd, 10);
      if (isNaN(qtd) || qtd < 0) continue;
      const diff = qtd - item.estoque_sistema;
      if (!isCega && diff !== 0 && !e.just.trim()) continue;
      await atualizarItem({
        itemId: item.id,
        quantidade_contada: qtd,
        contagem: balanco?.dupla_conferencia ? contagemAtiva : 1,
        justificativa: e.just,
        conferido_por: profile?.nome || "—",
        estoque_sistema: item.estoque_sistema,
        custo_unitario: item.custo_unitario,
      });
      count++;
    }
    setEdits({});
    await recalcularTotais(balancoId);
    toast.success(`${count} itens salvos`);
  };

  const handleConcluir = async () => {
    if (!balanco) return;
    if (totalConferidos < itens.length) {
      const ok = confirm(
        `${itens.length - totalConferidos} itens ainda não foram conferidos. Concluir mesmo assim?`
      );
      if (!ok) return;
    }
    await concluirBalanco({ balancoId, usuario: profile?.nome || "—" });
    toast.success("Balanço concluído");
  };

  const handleAplicar = async () => {
    if (!balanco || !isMaster) return;
    await aplicarAjustes({ balancoId, usuario: profile?.nome || "—" });
    toast.success("Ajustes aplicados ao estoque");
    setShowRevisao(false);
  };

  // Recalcular totais periodicamente em modo scan
  useEffect(() => {
    if (!editavel) return;
    const h = setInterval(() => recalcularTotais(balancoId), 8000);
    return () => clearInterval(h);
  }, [balancoId, editavel, recalcularTotais]);

  if (!balanco) return null;

  const divergentes = itens.filter((i) => i.status === "sobra" || i.status === "falta");
  const divergenciasContadores = itens.filter((i) => i.divergencia_contadores);

  return (
    <div className="px-4 pt-4 pb-32 md:pb-12 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onBack} className="p-2 rounded-xl hover:bg-surface-raised transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <p className="page-subtitle flex items-center gap-2">
              Balanço {isCega && <span className="inline-flex items-center gap-1 text-[10px] bg-muted px-1.5 py-0.5 rounded"><EyeOff size={10}/> cega</span>}
              {balanco.dupla_conferencia && <span className="text-[10px] bg-gold/15 text-gold px-1.5 py-0.5 rounded">dupla</span>}
            </p>
            <h1 className="page-title truncate">{balanco.nome}</h1>
          </div>
        </div>
        <button
          onClick={() => onOpenHistorico(balancoId)}
          className="btn-secondary px-3 py-2 text-xs hidden md:inline-flex"
        >
          Auditoria
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        <KpiBox label="Itens" value={itens.length.toString()} />
        <KpiBox label="Contados" value={totalConferidos.toString()} accent="gold" />
        <KpiBox label="Pendentes" value={pendentes.toString()} accent={pendentes ? "warning" : "success"} />
        <KpiBox label="Sobras" value={sobras.toString()} accent={sobras ? "warning" : "muted"} />
        <KpiBox label="Faltas" value={faltas.toString()} accent={faltas ? "destructive" : "muted"} />
        <KpiBox label="Impacto" value={`R$ ${valorDiverg.toFixed(0)}`} accent={valorDiverg ? "destructive" : "muted"} />
      </div>

      {/* Progresso */}
      <div className="card-premium p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">Progresso</span>
          <span className="text-xs font-semibold text-gold">{progresso}%</span>
        </div>
        <div className="h-2 bg-surface rounded-full overflow-hidden">
          <div
            className="h-full transition-all duration-300"
            style={{ width: `${progresso}%`, background: "var(--gradient-gold)" }}
          />
        </div>
      </div>

      {/* Tabs scan/lista (só se modo barras) */}
      {isBarras && editavel && (
        <div className="flex gap-2">
          <button
            onClick={() => setTab("scan")}
            className={`pill ${tab === "scan" ? "pill-active" : "pill-inactive"}`}
          >
            <ScanBarcode size={14} /> Contagem rápida
          </button>
          <button
            onClick={() => setTab("lista")}
            className={`pill ${tab === "lista" ? "pill-active" : "pill-inactive"}`}
          >
            <Layers size={14} /> Lista
          </button>
        </div>
      )}

      {/* MODO SCAN */}
      {tab === "scan" && editavel && (
        <div className="space-y-3">
          <div className="card-premium p-4 space-y-3 border-gold/40 border-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ScanBarcode className="text-gold" size={18} />
                <span className="font-display text-sm">Modo contagem rápida</span>
              </div>
              <div className="flex items-center gap-2">
                {balanco.dupla_conferencia && (
                  <div className="flex bg-surface rounded-lg p-0.5">
                    <button
                      onClick={() => setContagemAtiva(1)}
                      className={`px-2 py-1 text-[11px] rounded ${contagemAtiva === 1 ? "bg-gold text-background" : "text-muted-foreground"}`}
                    >1ª contagem</button>
                    <button
                      onClick={() => setContagemAtiva(2)}
                      className={`px-2 py-1 text-[11px] rounded ${contagemAtiva === 2 ? "bg-gold text-background" : "text-muted-foreground"}`}
                    >2ª contagem</button>
                  </div>
                )}
                <button
                  onClick={() => {
                    primeBeep();
                    setSomAtivo((s) => !s);
                  }}
                  className="p-2 rounded-lg bg-surface hover:bg-surface-raised"
                  title={somAtivo ? "Desativar som" : "Ativar som"}
                >
                  {somAtivo ? <Volume2 size={14} /> : <VolumeX size={14} />}
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <ScanBarcode size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gold" />
                <input
                  ref={scanRef}
                  value={scanCodigo}
                  onFocus={primeBeep}
                  onClick={primeBeep}
                  onChange={(e) => {
                    const valor = e.target.value;
                    const agora = performance.now();
                    const anterior = scanCodigo;

                    if (!valor) {
                      resetScanCapture();
                      scanCodigoRef.current = "";
                      setScanCodigo("");
                      return;
                    }

                    const acrescentou = valor.startsWith(anterior) && valor.length > anterior.length;
                    if (!acrescentou || agora - scanCaptureRef.current.lastAt > 120) {
                      scanCaptureRef.current = { startedAt: agora, lastAt: agora, count: valor.length };
                    } else {
                      scanCaptureRef.current = {
                        startedAt: scanCaptureRef.current.startedAt || agora,
                        lastAt: agora,
                        count: scanCaptureRef.current.count + (valor.length - anterior.length),
                      };
                    }

                    scanCodigoRef.current = valor;
                    setScanCodigo(valor);
                    scheduleAutoScan(valor);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      primeBeep();
                      const valorAtual = e.currentTarget.value;
                      scanCodigoRef.current = valorAtual;
                      handleScan(valorAtual);
                    }
                  }}
                  placeholder="Bipe ou digite o código (GTIN/SKU)"
                  className="input-premium pl-10 pr-3 py-3.5 w-full text-base font-mono"
                  autoComplete="off"
                />
              </div>
              <input
                value={scanQtd}
                onChange={(e) => setScanQtd(e.target.value.replace(/[^0-9]/g, ""))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    // Ao apertar Enter na quantidade, devolve foco ao código (não bipa)
                    scanRef.current?.focus();
                  }
                }}
                onBlur={() => {
                  if (!scanQtd) setScanQtd("1");
                  // Sempre devolve o foco ao campo de código
                  setTimeout(() => scanRef.current?.focus(), 50);
                }}
                className="input-premium px-3 py-3.5 w-20 text-center"
                placeholder="1"
                inputMode="numeric"
                title="Quantidade por leitura"
              />
              <button onClick={() => {
                primeBeep();
                const valorAtual = scanRef.current?.value ?? scanCodigoRef.current ?? scanCodigo;
                scanCodigoRef.current = valorAtual;
                handleScan(valorAtual);
              }} className="btn-primary px-4 text-sm">
                Bipar
              </button>
            </div>

            {/* Filtro de depósito durante scan (caso multi-depósito) */}
            {depositos.length > 2 && (
              <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
                <span className="text-[10px] text-muted-foreground self-center mr-1">Depósito:</span>
                {depositos.map((d) => (
                  <button
                    key={d}
                    onClick={() => setFiltroDeposito(d)}
                    className={`pill ${filtroDeposito === d ? "pill-active" : "pill-inactive"} text-[10px] py-1 px-2`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            )}

            {/* Feedback visual da última leitura */}
            {ultimoBip && (
              <div
                key={ultimoBip.ts}
                className={`rounded-xl p-3 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200 ${
                  ultimoBip.ok
                    ? "bg-success/15 border border-success/40"
                    : "bg-destructive/15 border border-destructive/40"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{ultimoBip.nome}</p>
                  <p className="text-[11px] text-muted-foreground">{ultimoBip.deposito}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[10px] text-muted-foreground uppercase">Total contado</p>
                  <p className="text-2xl font-display font-bold text-success">{ultimoBip.qtd}</p>
                </div>
              </div>
            )}
          </div>

          {/* Painel ao vivo dos contadores (dupla conferência) */}
          {balanco.dupla_conferencia && (
            <LivePainel
              leituras={leituras}
              itens={itens}
              meuUsuario={profile?.nome || "—"}
              minhaContagem={contagemAtiva}
            />
          )}
        </div>
      )}

      {/* Filtros + lista (sempre disponíveis em tab=lista, ou para modo manual) */}
      {(tab === "lista" || !isBarras || !editavel) && (
        <div className="space-y-3">
          {/* Lançamento rápido: bipe + busca manual lado a lado */}
          {editavel && (
            <div className="card-premium p-4 space-y-3 border border-gold/30">
              <div className="flex items-center gap-2">
                <ScanBarcode className="text-gold" size={16} />
                <span className="font-display text-sm">Lançar contagem</span>
                <span className="text-[10px] text-muted-foreground ml-auto">Bipe ou selecione o perfume</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Coluna 1: bipe por código */}
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Código (GTIN/SKU)</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <ScanBarcode size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gold" />
                      <input
                        ref={listaCodigoRef}
                        value={listaCodigo}
                        onChange={(e) => setListaCodigo(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const v = listaCodigo.trim();
                            if (!v) return;
                            setListaCodigo("");
                            void handleScan(v, parseInt(listaQtd, 10) || 1);
                            setTimeout(() => listaCodigoRef.current?.focus(), 50);
                          }
                        }}
                        placeholder="Bipe ou digite o código"
                        className="input-premium pl-9 pr-3 py-2.5 w-full text-sm font-mono"
                        autoComplete="off"
                      />
                    </div>
                    <button
                      onClick={() => {
                        const v = listaCodigo.trim();
                        if (!v) return;
                        setListaCodigo("");
                        void handleScan(v, parseInt(listaQtd, 10) || 1);
                        setTimeout(() => listaCodigoRef.current?.focus(), 50);
                      }}
                      className="btn-primary px-3 text-xs"
                    >
                      Bipar
                    </button>
                  </div>
                </div>

                {/* Coluna 2: busca manual de perfume */}
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Buscar perfume</label>
                  <div className="flex gap-2">
                    <div className="flex-1 min-w-0">
                      <PerfumeSearchSelect
                        perfumes={perfumes}
                        value={listaPerfumeId}
                        onChange={setListaPerfumeId}
                        concentracoesConfig={concentracoesConfig}
                        placeholder="Pesquise marca, nome ou SKU…"
                      />
                    </div>
                    <button
                      onClick={async () => {
                        if (!listaPerfumeId) {
                          toast.error("Selecione um perfume");
                          return;
                        }
                        const p = perfumes.find((x) => x.id === listaPerfumeId);
                        if (!p) return;
                        await handleScan(p.codigo, parseInt(listaQtd, 10) || 1);
                        setListaPerfumeId("");
                      }}
                      className="btn-primary px-3 text-xs"
                    >
                      Lançar
                    </button>
                  </div>
                </div>
              </div>

              {/* Quantidade compartilhada */}
              <div className="flex items-center gap-2">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Qtd</label>
                <input
                  value={listaQtd}
                  onChange={(e) => setListaQtd(e.target.value.replace(/[^0-9]/g, ""))}
                  onBlur={() => { if (!listaQtd) setListaQtd("1"); }}
                  onWheel={(e) => (e.target as HTMLInputElement).blur()}
                  inputMode="numeric"
                  className="input-premium px-2 py-1.5 w-16 text-center text-sm"
                />
                {ultimoBip && (
                  <div className={`flex-1 text-right text-[11px] truncate ${ultimoBip.ok ? "text-success" : "text-destructive"}`}>
                    {ultimoBip.ok ? "✓" : "✗"} {ultimoBip.nome} · total {ultimoBip.qtd}
                  </div>
                )}
              </div>
            </div>
          )}


          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={buscaRef}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, código ou marca"
              className="input-premium pl-10 pr-3 py-3 w-full"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {depositos.map((d) => (
              <button
                key={d}
                onClick={() => setFiltroDeposito(d)}
                className={`pill ${filtroDeposito === d ? "pill-active" : "pill-inactive"}`}
              >
                {d}
              </button>
            ))}
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide items-center">
            {["Todos", "pendente", "sem_divergencia", "sobra", "falta"].map((s) => (
              <button
                key={s}
                onClick={() => setFiltroStatus(s)}
                className={`pill ${filtroStatus === s ? "pill-active" : "pill-inactive"}`}
              >
                {s === "Todos" ? "Todos" : STATUS_LABEL[s]}
              </button>
            ))}
            <button
              onClick={() => setOrdenarDivergencia((v) => !v)}
              className={`pill ${ordenarDivergencia ? "pill-active" : "pill-inactive"} ml-auto`}
              title="Ordenar por maior divergência"
            >
              <AlertTriangle size={12} /> Divergência
            </button>
          </div>
        </div>
      )}

      {/* Lista de itens (oculta em scan se vazio?) */}
      {(tab === "lista" || !isBarras || !editavel) && (
        isLoading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Carregando…</div>
        ) : filtrados.length === 0 ? (
          <div className="card-premium p-12 text-center">
            <p className="text-sm text-muted-foreground">Nenhum item encontrado</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtrados.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                isCega={isCega}
                editavel={!!editavel}
                edits={edits}
                setEdits={setEdits}
                onSalvar={handleSalvarItem}
                onConferir={(qtd) =>
                  atualizarItem({
                    itemId: item.id,
                    quantidade_contada: qtd,
                    contagem: balanco.dupla_conferencia ? contagemAtiva : 1,
                    justificativa: item.justificativa,
                    conferido_por: profile?.nome || "—",
                    estoque_sistema: item.estoque_sistema,
                    custo_unitario: item.custo_unitario,
                  }).then(() => toast.success("Conferido"))
                }
                contagemAtiva={contagemAtiva}
                duplaConferencia={!!balanco.dupla_conferencia}
                concentracoesConfig={concentracoesConfig}
                casaLabelMap={casaLabelMap}
              />
            ))}
          </div>
        )
      )}

      {/* Atalho: salvar todos os itens editados de uma vez */}
      {editavel && Object.keys(edits).length > 1 && (
        <div className="card-premium p-3 flex items-center gap-3">
          <p className="text-xs text-muted-foreground flex-1">
            {Object.keys(edits).length} itens com contagem pendente de salvar
          </p>
          <button onClick={handleSalvarTudo} className="btn-primary px-4 py-2 text-xs">
            <Save size={14} /> Salvar todos
          </button>
        </div>
      )}

      {balanco.status === "em_andamento" && Object.keys(edits).length === 0 && (
        <button onClick={handleConcluir} className="btn-primary w-full py-3.5 text-sm">
          <CheckCircle2 size={16} /> Concluir balanço
        </button>
      )}

      {balanco.status === "concluido" && isMaster && (
        <button onClick={() => setShowRevisao(true)} className="btn-primary w-full py-3.5 text-sm">
          <AlertTriangle size={16} /> Revisar e aplicar ajustes ({divergentes.length})
        </button>
      )}

      {balanco.status === "ajustado" && (
        <div className="card-premium p-4 text-center text-sm text-success border border-success/30">
          <CheckCircle2 size={20} className="mx-auto mb-2" />
          Ajustes aplicados em {balanco.ajustado_em ? new Date(balanco.ajustado_em).toLocaleString("pt-BR") : "—"} por {balanco.ajustado_por}
        </div>
      )}

      {balanco.dupla_conferencia && divergenciasContadores.length > 0 && (
        <div className="card-premium p-4 border border-warning/30">
          <p className="text-sm font-semibold text-warning mb-2 flex items-center gap-2">
            <AlertTriangle size={16} /> Divergências entre contadores: {divergenciasContadores.length}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Itens onde a 1ª e a 2ª contagem não bateram. Revise antes de concluir.
          </p>
        </div>
      )}

      {/* Modal não encontrado */}
      {naoEncontrado && (
        <NaoEncontradoModal
          codigo={naoEncontrado.codigo}
          onClose={() => {
            setNaoEncontrado(null);
            setTimeout(() => scanRef.current?.focus(), 50);
          }}
          onVinculado={async () => {
            setNaoEncontrado(null);
            // bipar de novo agora que está vinculado
            await handleScan(naoEncontrado.codigo, parseInt(scanQtd, 10) || 1);
          }}
          usuario={profile?.nome || "—"}
        />
      )}

      {/* Modal de revisão */}
      {showRevisao && (
        <div className="fixed inset-0 z-[80] bg-background/80 backdrop-blur-sm flex items-end md:items-center justify-center p-4">
          <div className="card-premium w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="p-5 border-b border-border">
              <h3 className="font-display text-xl">Revisão de ajustes</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Confirme os ajustes que serão aplicados ao estoque
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-2">
              {divergentes.map((it) => (
                <div key={it.id} className="bg-surface rounded-lg p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate">{it.perfume_nome}</p>
                    <p className="text-[11px] text-muted-foreground">{it.deposito} · {it.justificativa || "Sem justificativa"}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs">{it.estoque_sistema} → {it.quantidade_contada}</p>
                    <p className={`text-[11px] font-semibold ${it.diferenca > 0 ? "text-warning" : "text-destructive"}`}>
                      {it.diferenca > 0 ? `+${it.diferenca}` : it.diferenca}
                    </p>
                  </div>
                </div>
              ))}
              {divergentes.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">Nenhuma divergência</p>
              )}
            </div>
            <div className="p-5 border-t border-border flex gap-2">
              <button onClick={() => setShowRevisao(false)} className="btn-secondary flex-1 py-2.5 text-sm">
                Cancelar
              </button>
              <button
                onClick={handleAplicar}
                disabled={divergentes.length === 0}
                className="btn-primary flex-1 py-2.5 text-sm"
              >
                Aplicar ajustes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ----------- Linha de item ----------- */
function ItemRow({
  item, isCega, editavel, edits, setEdits, onSalvar, onConferir, contagemAtiva, duplaConferencia,
  concentracoesConfig, casaLabelMap,
}: {
  item: BalancoItem;
  isCega: boolean;
  editavel: boolean;
  edits: Record<string, { qtd: string; just: string }>;
  setEdits: React.Dispatch<React.SetStateAction<Record<string, { qtd: string; just: string }>>>;
  onSalvar: (i: BalancoItem) => void;
  onConferir: (qtd: number) => void;
  contagemAtiva: 1 | 2;
  duplaConferencia: boolean;
  concentracoesConfig: Record<string, string>;
  casaLabelMap: Record<string, string>;
}) {
  const atualQtd =
    duplaConferencia && contagemAtiva === 2 ? item.quantidade_contada_2 : item.quantidade_contada;
  const e = edits[item.id] || { qtd: atualQtd?.toString() ?? "", just: item.justificativa || "" };
  const qtdNum = e.qtd === "" ? null : parseInt(e.qtd, 10);
  const diffPreview =
    !isCega && qtdNum !== null && !isNaN(qtdNum) ? qtdNum - item.estoque_sistema : null;
  const casa = item.casa_sigla ? casaLabelMap[item.casa_sigla] || item.casa_sigla : "—";
  const concentracao = item.concentracao ? concentracoesConfig[item.concentracao] || item.concentracao : "—";
  const volume = item.volume ? `${item.volume}ml` : item.tamanho || "—";
  const codigoBarras = item.codigo_barras?.trim();

  const adjust = (delta: number) => {
    const cur = parseInt(e.qtd || "0", 10) || 0;
    const novo = Math.max(0, cur + delta);
    setEdits((p) => ({ ...p, [item.id]: { qtd: novo.toString(), just: e.just } }));
  };

  return (
    <div className="card-premium p-3">
      <div className="flex items-start gap-3 mb-3">
        <div className="h-16 w-16 rounded-lg border border-border bg-surface overflow-hidden flex-shrink-0 flex items-center justify-center">
          {item.image_url ? (
            <img
              src={item.image_url}
              alt={`Foto ${item.perfume_nome}`}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <ImageOff size={18} className="text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className="text-sm font-semibold text-foreground truncate">{item.perfume_nome}</p>
            <span className={`text-[10px] px-2 py-1 rounded-full font-semibold flex-shrink-0 ${STATUS_STYLE[item.status]}`}>
              {STATUS_LABEL[item.status]}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground truncate">
            {item.perfume_codigo} · {item.marca} · {item.deposito}
          </p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            <span className="rounded-full bg-surface px-2 py-1 text-[10px] text-muted-foreground">Concentração: {concentracao}</span>
            <span className="rounded-full bg-surface px-2 py-1 text-[10px] text-muted-foreground">Casa: {casa}</span>
            <span className="rounded-full bg-surface px-2 py-1 text-[10px] text-muted-foreground">Volume: {volume}</span>
          </div>
          {codigoBarras && (
            <p className="mt-1.5 text-[10px] text-muted-foreground font-mono truncate">Barras: {codigoBarras}</p>
          )}
        </div>
      </div>

      <div className={`grid ${isCega ? "grid-cols-2" : "grid-cols-3"} gap-2 mb-2`}>
        {!isCega && <Field label="Sistema" value={item.estoque_sistema.toString()} />}
        <Field
          label={duplaConferencia ? `Contado ${contagemAtiva === 2 ? "(2ª)" : "(1ª)"}` : "Contado"}
          value={
            editavel ? (
              <div className="flex items-center gap-1">
                <button onClick={() => adjust(-1)} className="p-1 rounded bg-surface hover:bg-surface-raised">
                  <Minus size={11} />
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  value={e.qtd}
                  onChange={(ev) =>
                    setEdits((p) => ({ ...p, [item.id]: { qtd: ev.target.value, just: e.just } }))
                  }
                  onWheel={(ev) => (ev.target as HTMLInputElement).blur()}
                  className="input-premium px-1 py-1 text-sm w-full text-center"
                  min={0}
                />
                <button onClick={() => adjust(1)} className="p-1 rounded bg-surface hover:bg-surface-raised">
                  <Plus size={11} />
                </button>
              </div>
            ) : (
              atualQtd?.toString() ?? "—"
            )
          }
        />
        {!isCega && (
          <Field
            label="Diferença"
            value={
              diffPreview !== null
                ? diffPreview > 0 ? `+${diffPreview}` : diffPreview.toString()
                : item.diferenca !== 0 ? (item.diferenca > 0 ? `+${item.diferenca}` : item.diferenca.toString()) : "0"
            }
            color={
              (diffPreview ?? item.diferenca) > 0
                ? "warning"
                : (diffPreview ?? item.diferenca) < 0
                ? "destructive"
                : "success"
            }
          />
        )}
      </div>

      {editavel && !isCega && diffPreview !== null && diffPreview !== 0 && (
        <input
          value={e.just}
          onChange={(ev) =>
            setEdits((p) => ({ ...p, [item.id]: { qtd: e.qtd, just: ev.target.value } }))
          }
          placeholder="Justificativa obrigatória para divergência"
          className="input-premium px-3 py-2 text-xs w-full mb-2"
        />
      )}

      {editavel && (
        <div className="flex justify-between items-center text-xs gap-2">
          <span className="text-muted-foreground truncate">
            {!isCega && (
              <>Custo R$ {Number(item.custo_unitario).toFixed(2)} · Impacto R$ {item.impacto_financeiro.toFixed(2)}</>
            )}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => onConferir(0)}
              className="btn-secondary px-2 py-1 text-[11px]"
              title="Marcar como conferido com 0"
            >
              Zerar
            </button>
            <button
              onClick={() => onSalvar(item)}
              disabled={!edits[item.id] || edits[item.id].qtd === ""}
              className="btn-primary px-3 py-1 text-[11px]"
            >
              Salvar
            </button>
          </div>
        </div>
      )}

      {duplaConferencia && item.divergencia_contadores && (
        <p className="text-[10px] text-warning mt-1 flex items-center gap-1">
          <AlertTriangle size={11} /> Divergência entre 1ª ({item.quantidade_contada}) e 2ª ({item.quantidade_contada_2})
        </p>
      )}
      {!editavel && item.justificativa && (
        <p className="text-xs text-muted-foreground italic mt-1">"{item.justificativa}"</p>
      )}
      {item.ajuste_aplicado && (
        <p className="text-[10px] text-success mt-1 flex items-center gap-1">
          <CheckCircle2 size={11} /> Ajuste aplicado ao estoque
        </p>
      )}
    </div>
  );
}

/* ----------- Modal: código não encontrado ----------- */
function NaoEncontradoModal({
  codigo, onClose, onVinculado, usuario,
}: {
  codigo: string;
  onClose: () => void;
  onVinculado: () => void;
  usuario: string;
}) {
  const { perfumes } = usePerfumes();
  const [busca, setBusca] = useState("");
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const { adicionarGtin } = useProdutoGtins(selecionado);

  const sugestoes = useMemo(() => {
    if (!busca.trim()) return [];
    const b = busca.toLowerCase();
    return perfumes
      .filter((p) =>
        p.nome.toLowerCase().includes(b) ||
        p.marca.toLowerCase().includes(b) ||
        p.codigo.toLowerCase().includes(b),
      )
      .slice(0, 8);
  }, [perfumes, busca]);

  const vincular = async () => {
    if (!selecionado) return;
    try {
      await adicionarGtin({
        produto_id: selecionado,
        gtin: codigo,
        criado_por: usuario,
      });
      toast.success("GTIN vinculado");
      onVinculado();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao vincular");
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-background/80 backdrop-blur-sm flex items-end md:items-center justify-center p-4">
      <div className="card-premium w-full max-w-lg flex flex-col max-h-[85vh]">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg">Código não encontrado</h3>
            <p className="text-xs text-muted-foreground mt-1 font-mono">{codigo}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface">
            <X size={16} />
          </button>
        </div>
        <div className="p-5 space-y-3 overflow-y-auto">
          <p className="text-xs text-muted-foreground">
            Vincule este código a um produto existente para que futuras leituras sejam reconhecidas automaticamente.
          </p>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar produto por nome, SKU ou marca"
              className="input-premium pl-9 pr-3 py-2.5 w-full text-sm"
            />
          </div>
          <div className="space-y-1 max-h-72 overflow-y-auto">
            {sugestoes.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelecionado(p.id)}
                className={`w-full text-left p-2.5 rounded-lg border transition-colors ${
                  selecionado === p.id
                    ? "border-gold bg-gold/10"
                    : "border-border bg-surface hover:bg-surface-raised"
                }`}
              >
                <p className="text-sm font-semibold truncate">{p.nome}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {p.codigo} · {p.marca}
                </p>
              </button>
            ))}
            {busca && sugestoes.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhum produto encontrado</p>
            )}
          </div>
        </div>
        <div className="p-5 border-t border-border flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1 py-2.5 text-sm">
            Ignorar
          </button>
          <button
            onClick={vincular}
            disabled={!selecionado}
            className="btn-primary flex-1 py-2.5 text-sm"
          >
            <LinkIcon size={14} /> Vincular código
          </button>
        </div>
      </div>
    </div>
  );
}

function KpiBox({ label, value, accent = "default" }: { label: string; value: string; accent?: string }) {
  const color =
    accent === "gold" ? "text-gold" :
    accent === "warning" ? "text-warning" :
    accent === "destructive" ? "text-destructive" :
    accent === "success" ? "text-success" :
    "text-foreground";
  return (
    <div className="kpi-card !py-2">
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <p className={`text-base md:text-lg font-display font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function Field({ label, value, color }: { label: string; value: any; color?: string }) {
  const c =
    color === "warning" ? "text-warning" :
    color === "destructive" ? "text-destructive" :
    color === "success" ? "text-success" :
    "text-foreground";
  return (
    <div className="bg-surface rounded-lg p-2 text-center">
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-0.5">{label}</p>
      <div className={`text-sm font-semibold ${c}`}>{value}</div>
    </div>
  );
}

function LivePainel({
  leituras,
  itens,
  meuUsuario,
  minhaContagem,
}: {
  leituras: Array<{ contagem: number; usuario: string; perfume_id: string | null; criado_em: string; codigo_lido: string; encontrado: boolean }>;
  itens: BalancoItem[];
  meuUsuario: string;
  minhaContagem: 1 | 2;
}) {
  const c1 = leituras.filter((l) => l.contagem === 1);
  const c2 = leituras.filter((l) => l.contagem === 2);
  const usuariosC1 = Array.from(new Set(c1.map((l) => l.usuario).filter(Boolean)));
  const usuariosC2 = Array.from(new Set(c2.map((l) => l.usuario).filter(Boolean)));
  const itensC1 = itens.filter((i) => i.quantidade_contada !== null).length;
  const itensC2 = itens.filter((i) => i.quantidade_contada_2 !== null).length;

  const Coluna = ({
    titulo, leituras, usuarios, itensCount, ativo,
  }: { titulo: string; leituras: typeof c1; usuarios: string[]; itensCount: number; ativo: boolean }) => (
    <div className={`rounded-xl p-3 border ${ativo ? "border-gold/50 bg-gold/5" : "border-border bg-surface"}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold">{titulo} {ativo && <span className="text-[9px] text-gold">(você)</span>}</p>
        <span className="text-[10px] text-muted-foreground">{leituras.length} bipes</span>
      </div>
      <p className="text-[10px] text-muted-foreground mb-1.5">
        {usuarios.length ? usuarios.join(", ") : "—"}
      </p>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-display font-bold text-gold">{itensCount}</span>
        <span className="text-[10px] text-muted-foreground">itens contados</span>
      </div>
      <div className="mt-2 space-y-0.5 max-h-24 overflow-y-auto">
        {leituras.slice(0, 5).map((l, idx) => (
          <div key={idx} className="text-[10px] flex items-center justify-between gap-2 text-muted-foreground">
            <span className="truncate">{l.usuario || "—"}</span>
            <span className="font-mono flex-shrink-0">{l.codigo_lido.slice(-6)}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="card-premium p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
        Atividade ao vivo dos contadores
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Coluna titulo="1ª contagem" leituras={c1} usuarios={usuariosC1} itensCount={itensC1} ativo={minhaContagem === 1} />
        <Coluna titulo="2ª contagem" leituras={c2} usuarios={usuariosC2} itensCount={itensC2} ativo={minhaContagem === 2} />
      </div>
    </div>
  );
}
