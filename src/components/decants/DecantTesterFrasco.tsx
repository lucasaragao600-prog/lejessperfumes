import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTesters } from "@/hooks/useTesters";
import { useApp } from "@/context/AppContext";
import { useTesterParaFrasco } from "@/hooks/useDecants";

const num = (v: string) => (v.trim() === "" ? NaN : Number(v.replace(",", ".")));

/** Usa um tester já existente como frasco aberto de decant (baixa 1 tester e gera código FR). */
export function DialogoTesterFrasco({ onClose }: { onClose: () => void }) {
  const { testers, isLoading } = useTesters();
  const { perfumes } = useApp();
  const usar = useTesterParaFrasco();
  const [busca, setBusca] = useState("");
  const [id, setId] = useState("");
  const [f, setF] = useState({ ml: "", responsavel: "", observacao: "" });
  const [chave] = useState(() => crypto.randomUUID());
  const lista = testers.filter((t) => t.quantidade > 0 &&
    `${t.marca} ${t.perfumeNome} ${t.deposito}`.toLowerCase().includes(busca.toLowerCase()));
  const t = testers.find((x) => x.id === id);
  const vol = t ? perfumes.find((p) => p.id === t.perfumeId)?.volume : undefined;

  const salvar = async () => {
    if (!t) return toast.error("Escolha o tester.");
    const ml = num(f.ml);
    if (!(ml > 0)) return toast.error("Informe quantos ml ainda restam no tester.");
    if (vol && ml > vol) return toast.error(`O frasco tem no máximo ${vol} ml.`);
    try {
      const r = await usar.mutateAsync({ testerId: t.id, mlAtual: ml, responsavel: f.responsavel, observacao: f.observacao, chave });
      toast.success(`Tester virou o frasco ${r.codigo}.`);
      onClose();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Usar tester para decants</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">O tester sai da lista de testers da loja e vira um frasco aberto com código FR, com os ml que você informar.</p>
          <input className="input-premium" placeholder="Buscar perfume ou loja" value={busca} onChange={(e) => setBusca(e.target.value)} />
          <select className="input-premium" value={id} onChange={(e) => setId(e.target.value)} size={Math.min(Math.max(lista.length, 2), 6)}>
            {isLoading && <option disabled>Carregando…</option>}
            {!isLoading && lista.length === 0 && <option disabled>Nenhum tester disponível</option>}
            {lista.map((x) => <option key={x.id} value={x.id}>{x.marca} - {x.perfumeNome} · {x.deposito} ({x.quantidade})</option>)}
          </select>
          {t && (
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1"><span className="text-xs text-muted-foreground">ml que restam no tester{vol ? ` (máx. ${vol})` : ""}</span>
                <input inputMode="decimal" className="input-premium" value={f.ml} onChange={(e) => setF({ ...f, ml: e.target.value })} /></label>
              <label className="block space-y-1"><span className="text-xs text-muted-foreground">Responsável</span>
                <input className="input-premium" value={f.responsavel} onChange={(e) => setF({ ...f, responsavel: e.target.value })} /></label>
              <label className="block space-y-1 col-span-2"><span className="text-xs text-muted-foreground">Observação</span>
                <input className="input-premium" value={f.observacao} onChange={(e) => setF({ ...f, observacao: e.target.value })} /></label>
            </div>
          )}
          <button className="btn-primary w-full py-2.5" disabled={!t || usar.isPending} onClick={salvar}>
            {usar.isPending ? "Gerando…" : "Transformar em frasco de decant"}</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
