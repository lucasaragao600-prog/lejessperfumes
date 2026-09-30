import { useState } from "react";
import { Ban, RotateCcw, Repeat } from "lucide-react";
import AcoesVendaDialog, { type ModoAcaoVenda } from "./AcoesVendaDialog";

export default function AcoesVendaBotoes({ grupoVenda, compacto = false, onClose }: { grupoVenda: string; compacto?: boolean; onClose?: () => void }) {
  const [modo, setModo] = useState<ModoAcaoVenda | null>(null);
  const cls = compacto
    ? "text-[10px] px-2 py-1 rounded-full border border-border text-muted-foreground hover:text-foreground flex items-center gap-1"
    : "btn-secondary px-3 py-2 text-xs flex items-center gap-1.5";
  if (!grupoVenda) return null;
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button className={cls} onClick={() => setModo("devolver")}><RotateCcw size={12} /> Devolver itens</button>
        <button className={cls} onClick={() => setModo("trocar")}><Repeat size={12} /> Trocar itens</button>
        <button className={`${cls} hover:!text-destructive`} onClick={() => setModo("cancelar")}><Ban size={12} /> Cancelar venda</button>
      </div>
      {modo && (
        <AcoesVendaDialog grupoVenda={grupoVenda} modo={modo} onClose={() => { const m = modo; setModo(null); if (m === "cancelar") onClose?.(); }} />
      )}
    </>
  );
}
