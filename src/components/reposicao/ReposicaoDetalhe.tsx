import { useMemo, useState } from "react";
import { X, Copy, FileDown, Truck, PackageCheck, CheckCircle2, XCircle, Loader2, Clock } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { usePermissoes } from "@/hooks/usePermissoes";
import { useReposicao, STATUS_META, type Reposicao } from "@/hooks/useReposicao";
import { agruparPorCategoria, formatarDataHora, textoWhatsApp } from "@/lib/reposicaoUtils";
import { gerarPdfReposicao } from "@/lib/pdf/reposicao";
import ProdutoFoto from "@/components/ProdutoFoto";

export default function ReposicaoDetalhe({ reposicao, onClose }: { reposicao: Reposicao; onClose: () => void }) {
  const { perfumes } = useApp();
  const { profile, user } = useAuth();
  const { can, isMaster } = usePermissoes();
  const {
    reposicoes,
    itens,
    divergencias,
    historico,
    salvarSeparacao,
    confirmarEnvio,
    pularConferencia,
    finalizar,
    cancelar,
  } = useReposicao();


  const rep = reposicoes.find((r) => r.id === reposicao.id) || reposicao;
  const usuario = { id: user?.id, nome: profile?.nome || user?.email || "Sistema" };
  const meusItens = useMemo(() => itens.filter((i) => i.reposicao_id === rep.id), [itens, rep.id]);
  const minhasDivergencias = divergencias.filter((d) => d.reposicao_id === rep.id);
  const meuHistorico = historico.filter((h) => h.reposicao_id === rep.id);

  const [separados, setSeparados] = useState<Record<string, number>>({});
  const [motivoCancelar, setMotivoCancelar] = useState("");
  const [mostrarCancelar, setMostrarCancelar] = useState(false);
  const [carregando, setCarregando] = useState(false);

  const grupos = agruparPorCategoria(meusItens);
  const total = meusItens.reduce((s, i) => s + (i.quantidade_enviada ?? i.quantidade_solicitada), 0);
  const divergenciasPendentes = minhasDivergencias.filter((d) => !d.aprovado_em);
  const podeFinalizar =
    can("reposicao_finalizar") &&
    (rep.status === "conferida" || (rep.status === "com_divergencia" && divergenciasPendentes.length === 0));

  const copiarLista = async () => {
    await navigator.clipboard.writeText(textoWhatsApp(rep, meusItens, rep.criado_por_nome || usuario.nome));
    toast.success("Lista copiada para o WhatsApp.");
  };

  const baixarPdf = async () => {
    await gerarPdfReposicao(rep, meusItens, rep.status !== "rascunho");
  };

  const acao = async (fn: () => Promise<unknown>, msg: string) => {
    setCarregando(true);
    try {
      await fn();
      toast.success(msg);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível concluir a ação.");
    } finally {
      setCarregando(false);
    }
  };

  const concluirSeparacao = () =>
    acao(
      () =>
        salvarSeparacao({
          reposicao: rep,
          separados: Object.fromEntries(
            meusItens.map((i) => [i.id, separados[i.id] ?? i.quantidade_separada ?? i.quantidade_solicitada])
          ),
          usuario,
        }),
      "Separação concluída."
    );

  const enviar = () =>
    acao(
      () =>
        confirmarEnvio({
          reposicao: rep,
          enviados: Object.fromEntries(
            meusItens.map((i) => [i.id, i.quantidade_separada ?? i.quantidade_solicitada])
          ),
          usuario,
        }),
      "Envio confirmado. Aguardando conferência no destino."
    );

  const finalizarRep = () =>
    acao(
      () =>
        finalizar({
          reposicao: rep,
          itensRep: meusItens,
          estoques: Object.fromEntries(
            meusItens.map((i) => {
              const p = perfumes.find((x) => x.id === i.produto_id);
              return [i.produto_id, p ? { ...p.estoques } : {}];
            })
          ),
          usuario,
        }),
      "Reposição finalizada e estoques atualizados."
    );

  const mostrarQuantidades = rep.status !== "aguardando_conferencia" && rep.status !== "em_conferencia";
  const podeVerEsperado = mostrarQuantidades || can("reposicao_ver_itens_esperados");

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-start md:items-center justify-center overflow-y-auto p-0 md:p-6">
      <div className="w-full md:max-w-3xl bg-background md:rounded-2xl border border-border min-h-full md:min-h-0 md:max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">{rep.codigo}</p>
            <p className="text-[11px] text-muted-foreground">{rep.origem} → {rep.destino}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] px-2 py-1 rounded-full border ${STATUS_META[rep.status]?.className}`}>
              {STATUS_META[rep.status]?.label}
            </span>
            <button onClick={onClose} className="p-2 text-muted-foreground hover:text-foreground">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-[11px]">
            {[
              ["Criada em", formatarDataHora(rep.created_at)],
              ["Criada por", rep.criado_por_nome || "—"],
              ["Separada por", rep.separado_por_nome || "—"],
              ["Enviada em", formatarDataHora(rep.enviado_em)],
              ["Recebida por", rep.recebido_por_nome || "—"],
              ["Finalizada em", formatarDataHora(rep.finalizado_em)],
            ].map(([label, valor]) => (
              <div key={label} className="rounded-xl border border-border p-2.5">
                <p className="text-muted-foreground">{label}</p>
                <p className="text-foreground">{valor}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={copiarLista} className="btn-secondary px-3 py-2 text-xs flex items-center gap-2">
              <Copy size={14} /> Copiar lista
            </button>
            <button onClick={baixarPdf} className="btn-secondary px-3 py-2 text-xs flex items-center gap-2">
              <FileDown size={14} /> Gerar PDF
            </button>
          </div>

          {grupos.map((g) => (
            <div key={g.categoria} className="space-y-2">
              <p className="text-xs font-semibold text-gold tracking-wide">{g.categoria}</p>
              {g.itens.map((item) => {
                const esperado = item.quantidade_enviada ?? item.quantidade_solicitada;
                const recebido = item.quantidade_recebida;
                const situacao =
                  recebido == null ? null : recebido === esperado ? "OK" : recebido < esperado ? "FALTANDO" : "EXCEDENTE";
                return (
                  <div key={item.id} className="rounded-xl border border-border p-3 space-y-2">
                    <div className="flex items-center gap-3">
                      <ProdutoFoto url={perfumes.find((x) => x.id === item.produto_id)?.imageUrl} nome={item.produto_nome} />
                      <p className="text-sm text-foreground break-words flex-1">{item.produto_nome}</p>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                      <span>Solicitado: <span className="text-foreground">{item.quantidade_solicitada}</span></span>
                      {podeVerEsperado && (
                        <>
                          <span>Separado: <span className="text-foreground">{item.quantidade_separada ?? "—"}</span></span>
                          <span>Enviado: <span className="text-foreground">{item.quantidade_enviada ?? "—"}</span></span>
                        </>
                      )}
                      <span>Recebido: <span className="text-foreground">{item.quantidade_recebida ?? "—"}</span></span>
                      {situacao && (
                        <span className={situacao === "OK" ? "text-emerald-400" : "text-destructive"}>{situacao}</span>
                      )}
                    </div>
                    {rep.status === "em_separacao" && can("reposicao_separar") && (
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] text-muted-foreground">Separado:</label>
                        <input
                          type="number"
                          min={0}
                          value={separados[item.id] ?? item.quantidade_separada ?? item.quantidade_solicitada}
                          onChange={(e) =>
                            setSeparados((prev) => ({ ...prev, [item.id]: Math.max(0, Number(e.target.value) || 0) }))
                          }
                          className="input-premium w-20 bg-surface text-foreground"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          <p className="text-xs text-muted-foreground">Total: {meusItens.length} produto(s) · {total} unidade(s)</p>

          {minhasDivergencias.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-destructive">Divergências</p>
              {minhasDivergencias.map((d) => (
                <div key={d.id} className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-[11px] space-y-1">
                  <p className="text-sm text-foreground">{d.produto_nome}</p>
                  <p className="text-muted-foreground">{d.tipo} · esperado {d.quantidade_esperada}, recebido {d.quantidade_recebida}</p>
                  {d.justificativa && <p className="text-muted-foreground">“{d.justificativa}”</p>}
                  <p className="text-muted-foreground">
                    {d.aprovado_em ? `Aprovada por ${d.aprovado_por_nome} em ${formatarDataHora(d.aprovado_em)}` : "Aguardando aprovação"}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-semibold text-foreground flex items-center gap-2"><Clock size={13} /> Histórico</p>
            <div className="space-y-1.5">
              {meuHistorico.map((h) => (
                <div key={h.id} className="text-[11px] text-muted-foreground border-l-2 border-border pl-3">
                  <span className="text-foreground">{formatarDataHora(h.created_at)}</span> · {h.usuario_nome} — {h.acao}
                  {h.detalhes ? ` (${h.detalhes})` : ""}
                </div>
              ))}
              {meuHistorico.length === 0 && <p className="text-[11px] text-muted-foreground">Sem registros.</p>}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            {rep.status === "em_separacao" && can("reposicao_separar") && (
              <button onClick={concluirSeparacao} disabled={carregando} className="btn-primary px-4 py-2.5 text-xs flex items-center gap-2">
                {carregando ? <Loader2 size={14} className="animate-spin" /> : <PackageCheck size={14} />} Concluir separação
              </button>
            )}
            {rep.status === "pronta_envio" && can("reposicao_enviar") && (
              <button onClick={enviar} disabled={carregando} className="btn-primary px-4 py-2.5 text-xs flex items-center gap-2">
                {carregando ? <Loader2 size={14} className="animate-spin" /> : <Truck size={14} />} Confirmar envio
              </button>
            )}
            {podeFinalizar && (
              <button onClick={finalizarRep} disabled={carregando} className="btn-primary px-4 py-2.5 text-xs flex items-center gap-2">
                {carregando ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Finalizar e movimentar estoque
              </button>
            )}
            {rep.status === "com_divergencia" && divergenciasPendentes.length > 0 && (
              <p className="text-[11px] text-destructive self-center">
                Existem divergências aguardando aprovação antes da finalização.
              </p>
            )}
            {!["finalizada", "cancelada"].includes(rep.status) && can("reposicao_cancelar") && (
              <button onClick={() => setMostrarCancelar((v) => !v)} className="btn-secondary px-4 py-2.5 text-xs flex items-center gap-2">
                <XCircle size={14} /> Cancelar
              </button>
            )}
          </div>

          {mostrarCancelar && (
            <div className="rounded-xl border border-border p-3 space-y-2">
              <label className="text-[11px] text-muted-foreground">Justificativa do cancelamento</label>
              <textarea
                value={motivoCancelar}
                onChange={(e) => setMotivoCancelar(e.target.value)}
                rows={2}
                className="input-premium w-full bg-surface text-foreground"
              />
              <button
                onClick={() => {
                  if (motivoCancelar.trim().length < 5) return toast.error("Descreva o motivo do cancelamento.");
                  acao(() => cancelar({ reposicao: rep, motivo: motivoCancelar.trim(), usuario }), "Reposição cancelada.").then(onClose);
                }}
                className="btn-secondary px-4 py-2 text-xs"
              >
                Confirmar cancelamento
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
