import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftRight, CheckCircle2, ChevronDown, Loader2, RotateCcw, Search, ShieldAlert, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { useConfirmarReembolso, useDevolucaoItens, useDevolucoesLista, type DevolucaoListaItem } from "@/hooks/useDevolucoes";
import { useUnidades } from "@/hooks/useUnidades";
import { usePermissoesTrocas } from "@/hooks/usePermissoesTrocas";
import { getHojeManaus } from "@/lib/dateUtils";
import { nomeCondicao } from "@/lib/devolucao";
import BuscarVendaTroca from "@/components/vendas/BuscarVendaTroca";
import QuarentenaDevolucao from "@/components/vendas/QuarentenaDevolucao";

const fmtMoeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function fmtDataHora(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Manaus", day: "2-digit", month: "2-digit", year: "2-digit",
      hour: "2-digit", minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

const DESTINO_LABEL: Record<string, string> = {
  estoque: "Voltou ao estoque",
  avaria: "Avaria / Quarentena",
  tester: "Virou tester",
};

function CardDevolucao({ d, rotulo, podeReembolso }: { d: DevolucaoListaItem; rotulo: (id: string) => string; podeReembolso: boolean }) {
  const [aberto, setAberto] = useState(false);
  const itens = useDevolucaoItens(aberto ? d.id : null);
  const confirmar = useConfirmarReembolso();
  const isTroca = d.tipo === "troca";
  const reembolsoPendente = !isTroca && d.reembolso_status === "pendente";

  const confirmarReembolso = async () => {
    if (!window.confirm(`Confirmar que o reembolso de ${fmtMoeda(d.valor_total)} (${d.forma_reembolso === "pix" ? "Pix" : "estorno no cartão"}) foi pago ao cliente?`)) return;
    try {
      await confirmar.mutateAsync({ devolucaoId: d.id });
      toast.success(`Reembolso da ${d.numero} confirmado`);
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível confirmar o reembolso");
    }
  };

  return (
    <div className="card p-4 space-y-2">
      <button onClick={() => setAberto((v) => !v)} className="w-full text-left">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                isTroca ? "text-gold bg-primary/10 border-gold-muted" : "text-orange-400 bg-orange-400/10 border-orange-400/30"
              }`}>
                {isTroca ? <ArrowLeftRight size={11} /> : <Undo2 size={11} />}
                {isTroca ? "Troca" : "Devolução"}
              </span>
              <span className="text-sm font-semibold text-foreground">{d.numero}</span>
              {d.fora_do_prazo && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/30">
                  Fora do prazo
                </span>
              )}
              {reembolsoPendente && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-400 border border-amber-400/30">
                  Reembolso pendente
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {fmtDataHora(d.created_at)} · {rotulo(d.unidade_id)}
              {d.cliente_nome ? ` · ${d.cliente_nome}` : ""}
            </p>
          </div>
          <ChevronDown size={16} className={`text-muted-foreground transition-transform flex-shrink-0 mt-1 ${aberto ? "rotate-180" : ""}`} />
        </div>
        <div className="flex items-center gap-4 mt-2 text-xs">
          <span className="text-foreground font-medium">{fmtMoeda(d.valor_total)}</span>
          {isTroca && d.valor_troca > 0 && (
            <span className="text-muted-foreground">Novo: {fmtMoeda(d.valor_troca)}</span>
          )}
          {isTroca && d.diferenca !== 0 && (
            <span className={d.diferenca > 0 ? "text-success" : "text-orange-400"}>
              {d.diferenca > 0 ? `Cliente pagou ${fmtMoeda(d.diferenca)}` : `Crédito ${fmtMoeda(Math.abs(d.diferenca))}`}
            </span>
          )}
          {!isTroca && d.forma_reembolso && (
            <span className="text-muted-foreground capitalize">{d.forma_reembolso.replace("_", " ")}</span>
          )}
        </div>
      </button>

      {aberto && (
        <div className="pt-2 border-t border-border space-y-1.5">
          {itens.isLoading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
              <Loader2 size={13} className="animate-spin" /> Carregando itens…
            </div>
          )}
          {(itens.data || []).map((i) => (
            <div key={i.id} className="flex items-start justify-between gap-2 text-xs py-1">
              <div className="min-w-0">
                <p className="text-foreground truncate">{i.produto_nome}</p>
                <p className="text-muted-foreground">
                  {i.quantidade}× {fmtMoeda(i.valor_unitario)} · {nomeCondicao(i.condicao)} · {DESTINO_LABEL[i.destino] || i.destino}
                </p>
              </div>
              <span className="text-foreground font-medium flex-shrink-0">{fmtMoeda(i.quantidade * i.valor_unitario)}</span>
            </div>
          ))}
          {d.motivo && <p className="text-[11px] text-muted-foreground pt-1">Motivo: {d.motivo}</p>}
          {d.registrado_por_nome && (
            <p className="text-[11px] text-muted-foreground">Registrado por {d.registrado_por_nome}</p>
          )}
          {reembolsoPendente && (
            <div className="pt-2">
              {podeReembolso ? (
                <button
                  onClick={confirmarReembolso}
                  disabled={confirmar.isPending}
                  className="btn-primary px-3 py-1.5 text-xs flex items-center gap-1.5"
                >
                  {confirmar.isPending ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                  Confirmar reembolso pago
                </button>
              ) : (
                <p className="text-[11px] text-amber-400">Aguardando confirmação de reembolso por quem tem permissão.</p>
              )}
            </div>
          )}
          {!reembolsoPendente && !isTroca && d.reembolso_confirmado_por && d.forma_reembolso && ["pix", "estorno_cartao"].includes(d.forma_reembolso) && (
            <p className="text-[11px] text-success pt-1">
              Reembolso confirmado por {d.reembolso_confirmado_por}
              {d.reembolso_confirmado_em ? ` em ${fmtDataHora(d.reembolso_confirmado_em)}` : ""}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function TrocasDevolucoes() {
  const { unidades, rotulo: rotuloChave } = useUnidades({ contexto: "historico" });
  const { podeAlgumaAcao } = usePermissoesTrocas();
  const hoje = getHojeManaus();
  const [desde, setDesde] = useState(hoje);
  const [ate, setAte] = useState(hoje);
  const [unidadeId, setUnidadeId] = useState<string>("");
  const [tipo, setTipo] = useState<string>("");
  const [busca, setBusca] = useState("");
  const [buscaDeb, setBuscaDeb] = useState("");
  const [showTroca, setShowTroca] = useState(false);
  const [showQuarentena, setShowQuarentena] = useState(false);

  useEffect(() => { const t = setTimeout(() => setBuscaDeb(busca), 300); return () => clearTimeout(t); }, [busca]);

  const lista = useDevolucoesLista({ desde, ate, unidadeId: unidadeId || null, tipo: tipo || null, busca: buscaDeb });
  const itens = useMemo(() => (lista.data?.pages || []).flatMap((p) => p.itens), [lista.data]);
  const total = lista.data?.pages[0]?.total ?? 0;
  const soma = useMemo(() => itens.reduce((s, d) => s + d.valor_total, 0), [itens]);

  const sentinela = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinela.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => {
      if (e[0].isIntersecting && lista.hasNextPage && !lista.isFetchingNextPage) lista.fetchNextPage();
    }, { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, [lista.hasNextPage, lista.isFetchingNextPage, lista.fetchNextPage]);

  const rotuloPorId = (id: string) => {
    const u = unidades.find((x) => x.id === id);
    return u ? rotuloChave(u.codigoLegado || u.codigo) : "—";
  };

  return (
    <div className="px-4 py-4 md:py-6 space-y-4 pb-24 md:pb-8">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="page-title">Trocas e Devoluções</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {total} registro{total === 1 ? "" : "s"} no período · {fmtMoeda(soma)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowQuarentena(true)} className="btn-secondary px-3 py-2 text-xs flex items-center gap-1.5">
            <ShieldAlert size={14} /> Quarentena
          </button>
          {podeAlgumaAcao && (
            <button onClick={() => setShowTroca(true)} className="btn-primary px-3 py-2 text-xs flex items-center gap-1.5">
              <RotateCcw size={14} /> Nova Troca / Devolução
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <input type="date" value={desde} onChange={(e) => setDesde(e.target.value || hoje)} className="input-premium text-xs" />
        <input type="date" value={ate} onChange={(e) => setAte(e.target.value || hoje)} className="input-premium text-xs" />
        <select value={unidadeId} onChange={(e) => setUnidadeId(e.target.value)} className="input-premium text-xs">
          <option value="">Todas as lojas</option>
          {unidades.map((u) => (
            <option key={u.id} value={u.id}>{rotuloChave(u.codigoLegado || u.codigo)}</option>
          ))}
        </select>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="input-premium text-xs">
          <option value="">Trocas e devoluções</option>
          <option value="troca">Só trocas</option>
          <option value="devolucao">Só devoluções</option>
        </select>
        <div className="relative col-span-2 md:col-span-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={busca} onChange={(e) => setBusca(e.target.value)}
            placeholder="Número ou produto…" className="input-premium text-xs pl-8 w-full"
          />
        </div>
      </div>

      {lista.isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground text-sm">
          <Loader2 size={16} className="animate-spin" /> Carregando…
        </div>
      ) : itens.length === 0 ? (
        <div className="card p-8 text-center text-sm text-muted-foreground">
          Nenhuma troca ou devolução no período.
        </div>
      ) : (
        <div className="space-y-2">
          {itens.map((d) => <CardDevolucao key={d.id} d={d} rotulo={rotuloPorId} />)}
          <div ref={sentinela} />
          {lista.isFetchingNextPage && (
            <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground text-xs">
              <Loader2 size={14} className="animate-spin" /> Carregando mais…
            </div>
          )}
        </div>
      )}

      {showTroca && <BuscarVendaTroca aberto={showTroca} onClose={() => setShowTroca(false)} />}
      {showQuarentena && <QuarentenaDevolucao aberto={showQuarentena} onClose={() => setShowQuarentena(false)} />}
    </div>
  );
}
