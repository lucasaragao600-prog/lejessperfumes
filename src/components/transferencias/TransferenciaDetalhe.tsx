import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Camera, CheckCircle2, Loader2, Send, ShieldAlert, Truck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/context/AppContext";
import { useUnidades } from "@/hooks/useUnidades";
import ProdutoFoto from "@/components/ProdutoFoto";
import { BarcodeScannerDialog } from "@/components/BarcodeScannerDialog";
import {
  RESOLUCOES_DIVERGENCIA,
  TRF_STATUS_META,
  useTransferenciaEventos,
  useTransferenciaItens,
  useTransferencias,
  type Transferencia,
} from "@/hooks/useTransferencias";

interface Props {
  transferencia: Transferencia;
  onVoltar: () => void;
}

export default function TransferenciaDetalhe({ transferencia: t, onVoltar }: Props) {
  const { perfumes } = useApp();
  const { todas } = useUnidades({ contexto: "historico" });
  const { data: itens = [] } = useTransferenciaItens(t.id);
  const { data: eventos = [] } = useTransferenciaEventos(t.id);
  const {
    confirmar, separarItem, finalizarSeparacao, enviar, iniciarConferencia,
    receber, resolverDivergencia, cancelar,
  } = useTransferencias();

  const [conferido, setConferido] = useState<Record<string, number>>({});
  const [transportador, setTransportador] = useState(t.transportador || "");
  const [obsEnvio, setObsEnvio] = useState("");
  const [resolucao, setResolucao] = useState(RESOLUCOES_DIVERGENCIA[0].chave as string);
  const [justificativa, setJustificativa] = useState("");
  const [motivoCancelar, setMotivoCancelar] = useState("");
  const [scanner, setScanner] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const origem = todas.find((u) => u.id === t.origem_unidade_id);
  const destino = todas.find((u) => u.id === t.destino_unidade_id);
  const meta = TRF_STATUS_META[t.status];

  useEffect(() => {
    if (t.status === "AGUARDANDO_CONFERENCIA" || t.status === "EM_TRANSITO") {
      setConferido((prev) => {
        const base: Record<string, number> = { ...prev };
        for (const it of itens) if (base[it.id] === undefined) base[it.id] = it.quantidade_recebida ?? 0;
        return base;
      });
    }
  }, [itens.length, t.status]);

  const fotoDe = (produtoId: string) => perfumes.find((p) => p.id === produtoId)?.imageUrl;

  const totalEnviado = useMemo(() => itens.reduce((s, i) => s + (i.quantidade_enviada ?? 0), 0), [itens]);
  const divergentes = itens.filter((i) => (i.quantidade_recebida ?? 0) !== (i.quantidade_enviada ?? 0));

  const rodar = async (fn: () => Promise<unknown>, sucesso: string) => {
    setOcupado(true);
    try {
      await fn();
      toast.success(sucesso);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Operação não concluída.");
    } finally {
      setOcupado(false);
    }
  };

  const lerCodigo = (code: string) => {
    const p = perfumes.find((x) => x.codigoBarras === code || x.codigo === code);
    const item = p ? itens.find((i) => i.produto_id === p.id) : undefined;
    if (!item) {
      toast.error("Produto não faz parte desta transferência.");
      return;
    }
    if (t.status === "AGUARDANDO_SEPARACAO" || t.status === "EM_SEPARACAO") {
      const novo = (item.quantidade_separada ?? 0) + 1;
      void rodar(() => separarItem.mutateAsync({ itemId: item.id, quantidade: novo }), `${item.produto_nome}: ${novo}`);
    } else {
      setConferido((prev) => ({ ...prev, [item.id]: (prev[item.id] ?? 0) + 1 }));
    }
    setCodigo("");
  };

  const emSeparacao = t.status === "AGUARDANDO_SEPARACAO" || t.status === "EM_SEPARACAO";
  const emConferencia = t.status === "AGUARDANDO_CONFERENCIA";

  return (
    <div className="space-y-4 pb-28">
      <div className="flex items-center gap-3">
        <button onClick={onVoltar} className="p-2 rounded-lg border border-border text-muted-foreground">
          <ArrowLeft size={16} />
        </button>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">{t.numero}</h2>
          <p className="text-xs text-muted-foreground truncate">
            {origem?.nomeExibicao || "—"} → {destino?.nomeExibicao || "—"}
          </p>
        </div>
        <span className={`ml-auto text-[11px] px-2.5 py-1 rounded-full border ${meta.className}`}>{meta.label}</span>
      </div>

      {/* Leitura por código (leitor USB/Bluetooth sempre focado, ou câmera) */}
      {(emSeparacao || emConferencia) && (
        <div className="card p-3 flex gap-2">
          <input
            autoFocus
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && codigo.trim()) lerCodigo(codigo.trim()); }}
            placeholder="Bipe o código de barras"
            className="flex-1 bg-surface-raised text-foreground border border-border rounded-lg px-3 py-2 text-sm"
          />
          <button onClick={() => setScanner(true)} className="px-3 rounded-lg border border-border text-muted-foreground">
            <Camera size={16} />
          </button>
        </div>
      )}

      {/* Itens */}
      <div className="card p-4 space-y-2">
        <div className="hidden sm:grid grid-cols-[1fr_70px_70px_70px_80px] gap-2 text-[11px] uppercase tracking-wide text-muted-foreground px-1">
          <span>Produto</span><span className="text-center">Solic.</span><span className="text-center">Separado</span>
          <span className="text-center">Enviado</span><span className="text-center">Recebido</span>
        </div>
        {itens.map((it) => {
          const rec = conferido[it.id] ?? it.quantidade_recebida ?? 0;
          const dif = (it.quantidade_enviada ?? 0) - rec;
          return (
            <div key={it.id} className="border border-border rounded-lg p-2.5 space-y-2">
              <div className="flex items-center gap-2.5">
                <ProdutoFoto url={fotoDe(it.produto_id)} nome={it.produto_nome} />
                <p className="text-sm text-foreground flex-1 min-w-0 truncate">{it.produto_nome}</p>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div><p className="text-muted-foreground text-[10px]">Solicitado</p><p className="text-foreground">{it.quantidade_solicitada}</p></div>
                <div>
                  <p className="text-muted-foreground text-[10px]">Separado</p>
                  {emSeparacao ? (
                    <input
                      type="number"
                      value={it.quantidade_separada ?? ""}
                      onChange={(e) =>
                        void rodar(
                          () => separarItem.mutateAsync({ itemId: it.id, quantidade: Number(e.target.value) || 0 }),
                          "Separação registrada"
                        )
                      }
                      onWheel={(e) => e.currentTarget.blur()}
                      className="w-full text-center bg-surface-raised text-foreground border border-border rounded py-1"
                    />
                  ) : (
                    <p className="text-foreground">{it.quantidade_separada ?? "—"}</p>
                  )}
                </div>
                <div><p className="text-muted-foreground text-[10px]">Enviado</p><p className="text-foreground">{it.quantidade_enviada ?? "—"}</p></div>
                <div>
                  <p className="text-muted-foreground text-[10px]">Recebido</p>
                  {emConferencia ? (
                    <input
                      type="number"
                      value={rec}
                      onChange={(e) => setConferido((p) => ({ ...p, [it.id]: Number(e.target.value) || 0 }))}
                      onWheel={(e) => e.currentTarget.blur()}
                      className="w-full text-center bg-surface-raised text-foreground border border-border rounded py-1"
                    />
                  ) : (
                    <p className={dif !== 0 && it.quantidade_recebida !== null ? "text-destructive" : "text-foreground"}>
                      {it.quantidade_recebida ?? "—"}
                    </p>
                  )}
                </div>
              </div>
              {emConferencia && dif !== 0 && (
                <p className="text-[11px] text-destructive text-right">Diferença: {dif > 0 ? `-${dif}` : `+${-dif}`}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Ações por etapa */}
      <div className="card p-4 space-y-3">
        {t.status === "RASCUNHO" && (
          <button onClick={() => void rodar(() => confirmar.mutateAsync(t.id), "Estoque reservado na origem")}
            disabled={ocupado} className="btn-primary w-full py-2.5 rounded-lg text-sm font-medium">
            Confirmar e reservar estoque
          </button>
        )}

        {emSeparacao && (
          <button onClick={() => void rodar(() => finalizarSeparacao.mutateAsync(t.id), "Separação concluída")}
            disabled={ocupado} className="btn-primary w-full py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2">
            <CheckCircle2 size={15} /> Concluir separação
          </button>
        )}

        {t.status === "PRONTO_PARA_ENVIO" && (
          <div className="space-y-2">
            <input value={transportador} onChange={(e) => setTransportador(e.target.value)}
              placeholder="Transportador / responsável pelo envio"
              className="w-full bg-surface-raised text-foreground border border-border rounded-lg px-3 py-2 text-sm" />
            <input value={obsEnvio} onChange={(e) => setObsEnvio(e.target.value)} placeholder="Observação da expedição"
              className="w-full bg-surface-raised text-foreground border border-border rounded-lg px-3 py-2 text-sm" />
            <button onClick={() => void rodar(() => enviar.mutateAsync({ id: t.id, transportador, observacao: obsEnvio }), "Transferência despachada")}
              disabled={ocupado} className="btn-primary w-full py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2">
              <Send size={15} /> Registrar expedição
            </button>
          </div>
        )}

        {t.status === "EM_TRANSITO" && (
          <button onClick={() => void rodar(() => iniciarConferencia.mutateAsync(t.id), "Conferência iniciada")}
            disabled={ocupado} className="btn-primary w-full py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2">
            <Truck size={15} /> Registrar chegada e conferir
          </button>
        )}

        {emConferencia && (
          <button
            onClick={() =>
              void rodar(async () => {
                const status = await receber.mutateAsync({
                  id: t.id,
                  conferencias: itens.map((i) => ({ item_id: i.id, quantidade: conferido[i.id] ?? 0 })),
                });
                if (status === "AGUARDANDO_TRATAMENTO") toast.warning("Divergência registrada para tratamento.");
              }, "Conferência finalizada")
            }
            disabled={ocupado} className="btn-primary w-full py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2">
            {ocupado ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Finalizar conferência
          </button>
        )}

        {t.status === "AGUARDANDO_TRATAMENTO" && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-destructive flex items-center gap-2">
              <ShieldAlert size={15} /> {divergentes.length} item(ns) com diferença
            </p>
            <select value={resolucao} onChange={(e) => setResolucao(e.target.value)}
              className="w-full bg-surface-raised text-foreground border border-border rounded-lg px-3 py-2 text-sm">
              {RESOLUCOES_DIVERGENCIA.map((r) => (
                <option key={r.chave} value={r.chave}>{r.label}</option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground">
              {RESOLUCOES_DIVERGENCIA.find((r) => r.chave === resolucao)?.descricao}
            </p>
            <textarea value={justificativa} onChange={(e) => setJustificativa(e.target.value)} rows={2}
              placeholder="Justificativa (obrigatória)"
              className="w-full bg-surface-raised text-foreground border border-border rounded-lg px-3 py-2 text-sm" />
            <button
              onClick={() => void rodar(() => resolverDivergencia.mutateAsync({ id: t.id, resolucao, justificativa }), "Divergência tratada")}
              disabled={ocupado || justificativa.trim().length < 5}
              className="btn-primary w-full py-2.5 rounded-lg text-sm font-medium">
              Aplicar resolução
            </button>
          </div>
        )}

        {!["RECEBIDO", "CANCELADA"].includes(t.status) && (
          <div className="pt-2 border-t border-border space-y-2">
            <input value={motivoCancelar} onChange={(e) => setMotivoCancelar(e.target.value)}
              placeholder="Motivo do cancelamento"
              className="w-full bg-surface-raised text-foreground border border-border rounded-lg px-3 py-2 text-sm" />
            <button onClick={() => void rodar(() => cancelar.mutateAsync({ id: t.id, motivo: motivoCancelar }), "Transferência cancelada")}
              disabled={ocupado || !motivoCancelar.trim()}
              className="w-full py-2 rounded-lg text-sm border border-destructive/40 text-destructive flex items-center justify-center gap-2">
              <XCircle size={15} /> Cancelar transferência
            </button>
          </div>
        )}
      </div>

      {/* Resumo e histórico */}
      <div className="card p-4 space-y-1 text-xs text-muted-foreground">
        <p>Criada por {t.criado_por_nome || "—"}</p>
        {t.separado_por_nome && <p>Separada por {t.separado_por_nome}</p>}
        {t.enviado_por_nome && <p>Enviada por {t.enviado_por_nome} · {totalEnviado} unidades{t.transportador ? ` · ${t.transportador}` : ""}</p>}
        {t.recebido_por_nome && <p>Recebida por {t.recebido_por_nome}</p>}
        {t.cancelado_motivo && <p className="text-destructive">Cancelada: {t.cancelado_motivo}</p>}
      </div>

      <div className="card p-4 space-y-2">
        <p className="text-sm font-medium text-foreground">Histórico</p>
        {eventos.map((ev) => (
          <div key={ev.id} className="text-xs border-l-2 border-border pl-3 py-1">
            <p className="text-foreground">{ev.evento.replace(/_/g, " ").toLowerCase()}</p>
            {ev.detalhes && <p className="text-muted-foreground">{ev.detalhes}</p>}
            <p className="text-[10px] text-muted-foreground">
              {new Date(ev.created_at).toLocaleString("pt-BR", { timeZone: "America/Manaus" })} · {ev.usuario_nome || "—"}
            </p>
          </div>
        ))}
      </div>

      <BarcodeScannerDialog open={scanner} onClose={() => setScanner(false)} onDetected={(c) => { setScanner(false); lerCodigo(c); }} />
    </div>
  );
}
