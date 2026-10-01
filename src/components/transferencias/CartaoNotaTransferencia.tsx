import { useState } from "react";
import { FileText, Printer } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useNotasDaOrigem, useNtAtiva } from "@/hooks/useNotasTransferencia";
import { BadgeNota, DetalheNota } from "./NotasTransferencia";

/** Cartão "Nota de Transferência" exibido nos detalhes de Transferência, Reposição e Transferência de Decants. */
export default function CartaoNotaTransferencia({ tipo, origemId }: { tipo: "transferencia" | "reposicao" | "decant" | "manual"; origemId: string }) {
  const { data: ativa } = useNtAtiva();
  const { data: notas = [] } = useNotasDaOrigem(tipo, origemId, !!ativa);
  const [aberta, setAberta] = useState<string | null>(null);
  if (!ativa) return null;

  return (
    <div className="card p-3 space-y-2">
      <p className="flex items-center gap-1.5 text-xs font-medium text-foreground"><FileText size={14} className="text-gold" /> Nota de Transferência</p>
      {notas.length === 0 && <p className="text-[11px] text-muted-foreground">A nota é emitida automaticamente no envio.</p>}
      {notas.map((n) => (
        <div key={n.id} className="flex items-center gap-2 flex-wrap text-xs">
          <span className="font-medium text-foreground">{n.numero}</span>
          {n.revisao > 1 && <span className="text-[11px] text-muted-foreground">rev. {n.revisao}</span>}
          <BadgeNota status={n.status} />
          <button onClick={() => setAberta(n.id)}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gold/40 text-gold bg-gold/5">
            <Printer size={13} /> {n.reimpressoes > 0 ? "Reimprimir" : "Imprimir / PDF"}
          </button>
        </div>
      ))}
      <Dialog open={!!aberta} onOpenChange={(o) => !o && setAberta(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto z-[80]">
          <DialogHeader><DialogTitle>Nota de Transferência</DialogTitle></DialogHeader>
          {aberta && <DetalheNota id={aberta} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
