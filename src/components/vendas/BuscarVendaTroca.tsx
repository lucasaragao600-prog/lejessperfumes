import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, ArrowLeftRight, RotateCcw, Receipt } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { usePedidosLista } from "@/hooks/useVendasLista";
import { useBuscarVendaTrocaTodas } from "@/hooks/useDevolucoes";
import { usePermissoesTrocas } from "@/hooks/usePermissoesTrocas";
import { useUnidades } from "@/hooks/useUnidades";
import { formatCurrency } from "@/data/mockData";
import AcoesVendaDialog, { type ModoAcaoVenda } from "./AcoesVendaDialog";

interface Selecao {
  grupoVenda: string;
  modo: ModoAcaoVenda;
  unidadeOperacaoId?: string | null;
  unidadeOperacaoNome?: string | null;
}

/**
 * Ponto de entrada central de Trocas e Devoluções fora do Histórico de Vendas.
 * Busca a venda original (número do pedido, cliente, produto) e abre o mesmo
 * fluxo de troca/devolução usado no PDV e nos Pedidos — sem duplicar regras.
 * Com a permissão venda.trocar_entre_unidades, permite buscar a venda em todas
 * as lojas e registrar a troca na loja onde o cliente está (Fase 6).
 */
export default function BuscarVendaTroca({ aberto, onClose }: { aberto: boolean; onClose: () => void }) {
  const [busca, setBusca] = useState("");
  const [buscaDeb, setBuscaDeb] = useState("");
  const [selecionado, setSelecionado] = useState<Selecao | null>(null);
  const [todasLojas, setTodasLojas] = useState(false);
  const [unidadeOpId, setUnidadeOpId] = useState("");
  const { podeTrocar, podeDevolver, podeTrocarEntreUnidades, unidadesTrocaEntreUnidades, isMaster } = usePermissoesTrocas();
  const { unidadesVenda } = useUnidades({ contexto: "operacional" });

  const unidadesOp = useMemo(
    () => (isMaster ? unidadesVenda : unidadesVenda.filter((u) => unidadesTrocaEntreUnidades.includes(u.id))),
    [isMaster, unidadesVenda, unidadesTrocaEntreUnidades],
  );
  const unidadeOp = unidadesOp.find((u) => u.id === unidadeOpId) || unidadesOp[0] || null;

  useEffect(() => {
    const t = setTimeout(() => setBuscaDeb(busca.trim()), 300);
    return () => clearTimeout(t);
  }, [busca]);

  useEffect(() => {
    if (!aberto) { setBusca(""); setBuscaDeb(""); setSelecionado(null); setTodasLojas(false); }
  }, [aberto]);

  const lista = usePedidosLista({ busca: buscaDeb || undefined });
  const listaTodas = useBuscarVendaTrocaTodas(todasLojas ? unidadeOp?.id ?? null : null, buscaDeb);

  const grupos = useMemo(() => {
    const pages = lista.data?.pages || [];
    const itens = pages.flatMap((p) => p.itens);
    return pages.flatMap((p) => p.grupos).map((g) => {
      const doGrupo = itens.filter((i) => i.grupoVenda === g.grupo);
      const total = doGrupo.reduce((s, i) => s + (i.total || 0), 0);
      const data = doGrupo[0]?.data || "";
      const deposito = doGrupo[0]?.deposito || "";
      return { ...g, total, data, deposito };
    });
  }, [lista.data]);

  const carregando = todasLojas ? listaTodas.isLoading : lista.isLoading;
  const erro = todasLojas ? listaTodas.isError : lista.isError;
  const vazia = todasLojas ? (listaTodas.data || []).length === 0 : grupos.length === 0;

  return (
    <>
      <Dialog open={aberto && !selecionado} onOpenChange={(o) => { if (!o) onClose(); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto z-[80]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight size={18} className="text-gold" /> Troca / Devolução
            </DialogTitle>
            <DialogDescription>Localize a venda original por número do pedido, cliente ou produto.</DialogDescription>
          </DialogHeader>

          {podeTrocarEntreUnidades && unidadesOp.length > 0 && (
            <div className="flex gap-2 items-center">
              <select
                value={todasLojas ? "todas" : "minhas"}
                onChange={(e) => setTodasLojas(e.target.value === "todas")}
                className="px-2 py-1.5 rounded-lg text-xs text-foreground outline-none bg-background border border-border"
                aria-label="Onde buscar a venda">
                <option value="minhas">Buscar nas minhas lojas</option>
                <option value="todas">Buscar em todas as lojas</option>
              </select>
              {todasLojas && (
                <select
                  value={unidadeOp?.id || ""}
                  onChange={(e) => setUnidadeOpId(e.target.value)}
                  className="px-2 py-1.5 rounded-lg text-xs text-foreground outline-none bg-background border border-border flex-1"
                  aria-label="Loja onde a troca acontece">
                  {unidadesOp.map((u) => <option key={u.id} value={u.id}>Troca em: {u.nomeExibicao}</option>)}
                </select>
              )}
            </div>
          )}

          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Nº do pedido, cliente ou produto..."
              autoFocus
              className="input-premium pl-9 pr-3 py-2.5 text-sm w-full"
            />
          </div>

          <div className="space-y-2 mt-1">
            {carregando && (
              <div className="py-8 flex justify-center"><Loader2 className="animate-spin text-gold" /></div>
            )}
            {erro && (
              <p className="text-sm text-destructive text-center py-4">Não foi possível buscar as vendas.</p>
            )}
            {!carregando && !erro && vazia && (
              <p className="text-sm text-muted-foreground text-center py-6">
                {buscaDeb ? "Nenhuma venda encontrada para esta busca." : "Digite para buscar ou veja as vendas recentes."}
              </p>
            )}

            {!todasLojas && grupos.map((g) => (
              <div key={g.grupo} className="card-premium p-3.5 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl border border-gold-muted bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Receipt size={15} className="text-gold" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {g.grupo.slice(0, 8).toUpperCase()}
                    {g.clienteNome ? ` · ${g.clienteNome}` : ""}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {g.data ? g.data.split("-").reverse().join("/") : ""} · {g.deposito} · {formatCurrency(g.total)}
                  </p>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                    {podeTrocar && (
                      <button
                        onClick={() => setSelecionado({ grupoVenda: g.grupo, modo: "trocar" })}
                        className="text-[10px] px-2.5 py-1.5 rounded-full border border-gold-muted text-gold flex items-center gap-1">
                        <ArrowLeftRight size={11} /> Trocar
                      </button>
                    )}
                    {podeDevolver && (
                      <button
                        onClick={() => setSelecionado({ grupoVenda: g.grupo, modo: "devolver" })}
                        className="text-[10px] px-2.5 py-1.5 rounded-full border border-border text-muted-foreground hover:text-foreground flex items-center gap-1">
                        <RotateCcw size={11} /> Devolver
                      </button>
                    )}
                    {!podeTrocar && !podeDevolver && (
                      <span className="text-[10px] text-muted-foreground">Sem permissão</span>
                    )}
                 </div>
              </div>
            ))}

            {todasLojas && (listaTodas.data || []).map((g) => (
              <div key={g.grupo_venda} className="card-premium p-3.5 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl border border-gold-muted bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Receipt size={15} className="text-gold" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {g.grupo_venda.slice(0, 8).toUpperCase()}
                    {g.cliente_nome ? ` · ${g.cliente_nome}` : ""}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {g.data ? String(g.data).slice(0, 10).split("-").reverse().join("/") : ""} · {g.unidade_nome || g.deposito} · {formatCurrency(g.total)}
                    {g.cancelada ? " · cancelada" : ""}
                  </p>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  {!g.cancelada && unidadeOp && (
                    <button
                      onClick={() => setSelecionado({
                        grupoVenda: g.grupo_venda, modo: "trocar",
                        unidadeOperacaoId: unidadeOp.id, unidadeOperacaoNome: unidadeOp.nomeExibicao,
                      })}
                      className="text-[10px] px-2.5 py-1.5 rounded-full border border-gold-muted text-gold flex items-center gap-1">
                      <ArrowLeftRight size={11} /> Trocar aqui
                    </button>
                  )}
                </div>
              </div>
            ))}

            {!todasLojas && lista.hasNextPage && (
              <button
                onClick={() => lista.fetchNextPage()}
                disabled={lista.isFetchingNextPage}
                className="btn-secondary w-full py-2 text-xs flex items-center justify-center gap-2">
                {lista.isFetchingNextPage ? <><Loader2 size={12} className="animate-spin" /> Carregando...</> : "Carregar mais"}
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {selecionado && (
        <AcoesVendaDialog
          grupoVenda={selecionado.grupoVenda}
          modo={selecionado.modo}
          unidadeOperacaoId={selecionado.unidadeOperacaoId ?? null}
          unidadeOperacaoNome={selecionado.unidadeOperacaoNome ?? null}
          onClose={() => setSelecionado(null)}
        />
      )}
    </>
  );
}
