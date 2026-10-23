import { useState } from "react";
import { Ban, RotateCcw, Repeat } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useMinhasPermissoes } from "@/hooks/useAcessosUnidade";
import { PERMISSOES_TROCAS, podeAcao } from "@/lib/permissoesVenda";
import AcoesVendaDialog, { type ModoAcaoVenda } from "./AcoesVendaDialog";

export default function AcoesVendaBotoes({ grupoVenda, compacto = false, onClose }: { grupoVenda: string; compacto?: boolean; onClose?: () => void }) {
  const [modo, setModo] = useState<ModoAcaoVenda | null>(null);
  const { role } = useAuth();
  const minhas = useMinhasPermissoes();
  const isMaster = role === "master";
  const perms = minhas.data || [];
  const podeDevolver = podeAcao(isMaster, perms, PERMISSOES_TROCAS.devolver);
  const podeTrocar = podeAcao(isMaster, perms, PERMISSOES_TROCAS.trocar);
  const podeCancelar = podeAcao(isMaster, perms, PERMISSOES_TROCAS.cancelar);
  const cls = compacto
    ? "text-[10px] px-2 py-1 rounded-full border border-border text-muted-foreground hover:text-foreground flex items-center gap-1"
    : "btn-secondary px-3 py-2 text-xs flex items-center gap-1.5";
  if (!grupoVenda) return null;
  if (!podeDevolver && !podeTrocar && !podeCancelar) return null;
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {podeDevolver && <button className={cls} onClick={() => setModo("devolver")}><RotateCcw size={12} /> Devolver itens</button>}
        {podeTrocar && <button className={cls} onClick={() => setModo("trocar")}><Repeat size={12} /> Trocar itens</button>}
        {podeCancelar && <button className={`${cls} hover:!text-destructive`} onClick={() => setModo("cancelar")}><Ban size={12} /> Cancelar venda</button>}
      </div>
      {modo && (
        <AcoesVendaDialog grupoVenda={grupoVenda} modo={modo} onClose={() => { const m = modo; setModo(null); if (m === "cancelar") onClose?.(); }} />
      )}
    </>
  );
}
