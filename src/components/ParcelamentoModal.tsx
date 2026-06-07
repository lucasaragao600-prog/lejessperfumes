import { Percent, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { calcularParcelamento, PARCELAS_SEM_JUROS_LIMITE } from "@/lib/parcelamento";
import { formatCurrency } from "@/data/mockData";

interface ParcelamentoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  valor: number;
  titulo?: string;
}

export default function ParcelamentoModal({ open, onOpenChange, valor, titulo }: ParcelamentoModalProps) {
  const opcoes = calcularParcelamento(valor);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Percent size={16} className="text-gold" />
            Parcelamento{titulo ? ` — ${titulo}` : ""}
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto -mx-6 px-6">
          <div className="rounded-xl overflow-hidden border border-border">
            <div className="grid grid-cols-[60px_1fr_1fr] gap-2 px-3 py-2 bg-surface-overlay text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              <span>Parcelas</span>
              <span className="text-right">Valor / parcela</span>
              <span className="text-right">Total</span>
            </div>

            {opcoes.map((op) => {
              const isFirstComJuros = op.parcelas === PARCELAS_SEM_JUROS_LIMITE + 1;
              return (
                <div key={op.parcelas}>
                  {isFirstComJuros && (
                    <div className="px-3 py-1.5 bg-amber-500/5 border-y border-amber-500/20">
                      <p className="text-[10px] text-amber-400 font-semibold tracking-wide text-center">
                        ───── Com juros a partir de 7x ─────
                      </p>
                    </div>
                  )}
                  <div className="grid grid-cols-[60px_1fr_1fr] gap-2 px-3 py-2 items-center border-t border-border first:border-t-0 hover:bg-surface-overlay/40">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-sm font-bold ${op.temJuros ? "text-amber-400" : "text-foreground"}`}>
                        {op.parcelas}x
                      </span>
                    </div>
                    <span className={`text-xs text-right font-medium ${op.temJuros ? "text-amber-300" : "text-foreground"}`}>
                      {formatCurrency(op.valorParcela)}
                    </span>
                    <div className="flex items-center justify-end gap-2">
                      <span className={`text-xs font-bold ${op.temJuros ? "text-amber-400" : "text-foreground"}`}>
                        {formatCurrency(op.valorTotal)}
                      </span>
                      {op.temJuros ? (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-bold whitespace-nowrap">
                          +{op.taxa.toFixed(2).replace(".", ",")}%
                        </span>
                      ) : (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold whitespace-nowrap">
                          Sem juros
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-[10px] text-muted-foreground text-center mt-3 mb-1">
            Taxas aplicadas conforme maquininha (MDR)
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
