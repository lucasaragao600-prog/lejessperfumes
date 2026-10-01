import { useState } from "react";
import { History, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNtAtiva } from "@/hooks/useNotasTransferencia";

interface Pendente { tipo: "transferencia" | "reposicao"; id: string; numero: string; origem_nome: string; destino_nome: string; concluido_em: string; itens: number }

/** Emissão administrativa de NT para operações já finalizadas — uma por vez, nunca em lote. */
export default function NtRetroativas() {
  const { data: ativa } = useNtAtiva();
  const qc = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [tipo, setTipo] = useState("");
  const [pagina, setPagina] = useState(0);
  const [motivo, setMotivo] = useState<Record<string, string>>({});
  const { data, isLoading } = useQuery({
    queryKey: ["nt-retroativas", tipo, pagina], enabled: aberto && !!ativa,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fn_nt_retroativas_pendentes" as never, { p_tipo: tipo || null, p_limite: 30, p_offset: pagina * 30 } as never);
      if (error) throw error;
      return data as unknown as { total: number; itens: Pendente[] };
    },
  });
  const emitir = useMutation({
    mutationFn: async (p: Pendente) => {
      const { data, error } = await supabase.rpc("fn_nt_emitir_retroativa" as never, { p_tipo: p.tipo, p_origem_id: p.id, p_motivo: motivo[p.id] || "" } as never);
      if (error) throw error;
      return data as unknown as { numero: string };
    },
    onSuccess: (r) => { toast.success(`Nota ${r.numero} emitida retroativamente.`); qc.invalidateQueries({ queryKey: ["nt-retroativas"] }); qc.invalidateQueries({ queryKey: ["notas-transferencia"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível emitir."),
  });
  if (!ativa) return null;
  const total = data?.total ?? 0;

  return (
    <section className="card-premium p-5 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5"><History size={14} className="text-gold" /> Notas retroativas</h2>
          <p className="text-[10px] text-muted-foreground mt-0.5">Gera a nota de transferências e reposições já concluídas, uma por vez. Não mexe no estoque.</p>
        </div>
        <button onClick={() => setAberto(!aberto)} className="text-xs text-gold underline whitespace-nowrap">{aberto ? "Fechar" : "Ver pendentes"}</button>
      </div>
      {aberto && <>
        <select value={tipo} onChange={(e) => { setTipo(e.target.value); setPagina(0); }} className="input-premium px-3 py-2 text-xs">
          <option value="">Transferências e reposições</option><option value="transferencia">Só transferências</option><option value="reposicao">Só reposições</option>
        </select>
        {isLoading && <p className="text-xs text-muted-foreground">Carregando…</p>}
        {!isLoading && total === 0 && <p className="text-xs text-muted-foreground">Nenhuma operação concluída sem nota.</p>}
        {data?.itens.map((p) => (
          <div key={p.id} className="rounded-xl border border-border p-3 space-y-2 text-xs">
            <p className="text-foreground"><span className="font-medium">{p.numero}</span> · {p.tipo === "reposicao" ? "Reposição" : "Transferência"}</p>
            <p className="text-muted-foreground">{p.origem_nome} → {p.destino_nome} · {p.itens} item(ns) · {new Date(p.concluido_em).toLocaleDateString("pt-BR", { timeZone: "America/Manaus" })}</p>
            <div className="flex gap-2">
              <input value={motivo[p.id] || ""} onChange={(e) => setMotivo({ ...motivo, [p.id]: e.target.value })} placeholder="Motivo (obrigatório)" className="input-premium flex-1 px-3 py-1.5 text-xs" />
              <button disabled={emitir.isPending || (motivo[p.id] || "").trim().length < 5} onClick={() => emitir.mutate(p)}
                className="btn-primary px-3 py-1.5 text-xs flex items-center gap-1 disabled:opacity-50">
                {emitir.isPending && emitir.variables?.id === p.id && <Loader2 size={12} className="animate-spin" />} Emitir nota
              </button>
            </div>
          </div>
        ))}
        {total > 30 && (
          <div className="flex items-center justify-center gap-3 text-xs">
            <button disabled={pagina === 0} onClick={() => setPagina(pagina - 1)} className="px-3 py-1 border border-border rounded disabled:opacity-40">Anterior</button>
            <span className="text-muted-foreground">{pagina + 1} / {Math.ceil(total / 30)}</span>
            <button disabled={(pagina + 1) * 30 >= total} onClick={() => setPagina(pagina + 1)} className="px-3 py-1 border border-border rounded disabled:opacity-40">Próxima</button>
          </div>
        )}
      </>}
    </section>
  );
}
