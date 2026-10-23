import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, ArrowLeftRight, RotateCcw, Receipt } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { usePedidosLista } from "@/hooks/useVendasLista";
import { formatCurrency } from "@/data/mockData";
import AcoesVendaDialog, { type ModoAcaoVenda } from "./AcoesVendaDialog";

/**
 * Ponto de entrada central de Trocas e Devoluções fora do Histórico de Vendas.
 * Busca a venda original (número do pedido, cliente, produto) e abre o mesmo
 * fluxo de troca/devolução usado no PDV e nos Pedidos — sem duplicar regras.
 */
export default function BuscarVendaTroca({ aberto, onClose }: { aberto: boolean; onClose: () => void }) {
  const [busca, setBusca] = useState("");
  const [buscaDeb, setBuscaDeb] = useState("");
  const [selecionado, setSelecionado] = useState<{ grupoVenda: string; modo: ModoAcaoVenda } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setBuscaDeb(busca.trim()), 300);
    return () => clearTimeout(t);
  }, [busca]);

  useEffect(() => {
    if (!aberto) { setBusca(""); setBuscaDeb(""); setSelecionado(null); }
  }, [aberto]);

  const lista = usePedidosLista({ busca: buscaDeb || undefined });

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
            {lista.isLoading && (
              <div className="py-8 flex justify-center"><Loader2 className="animate-spin text-gold" /></div>
            )}
            {lista.isError && (
              <p className="text-sm text-destructive text-center py-4">Não foi possível buscar as vendas.</p>
            )}
            {!lista.isLoading && !lista.isError && grupos.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                {buscaDeb ? "Nenhuma venda encontrada para esta busca." : "Digite para buscar ou veja as vendas recentes."}
              </p>
            )}
            {grupos.map((g) => (
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
                    <button
                      onClick={() => setSelecionado({ grupoVenda: g.grupo, modo: "trocar" })}
                      className="text-[10px] px-2.5 py-1.5 rounded-full border border-gold-muted text-gold flex items-center gap-1">
                      <ArrowLeftRight size={11} /> Trocar
                    </button>
                    <button
                      onClick={() => setSelecionado({ grupoVenda: g.grupo, modo: "devolver" })}
                      className="text-[10px] px-2.5 py-1.5 rounded-full border border-border text-muted-foreground hover:text-foreground flex items-center gap-1">
                      <RotateCcw size={11} /> Devolver
                    </button>
                  </div>
                )}
              </div>
            ))}
            {lista.hasNextPage && (
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
          onClose={() => setSelecionado(null)}
        />
      )}
    </>
  );
}
