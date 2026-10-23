import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, PackageCheck, ShieldAlert, FlaskConical, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useMinhasPermissoes } from "@/hooks/useAcessosUnidade";
import { PERMISSOES_TROCAS, podeAcao } from "@/lib/permissoesVenda";
import { nomeCondicao } from "@/lib/devolucao";
import { invalidarVendasRelacionadas } from "@/hooks/useDevolucoes";

const db = supabase as any;

interface ItemQuarentena {
  id: string;
  devolucao_numero: string;
  unidade_nome: string;
  produto_nome: string;
  quantidade: number;
  condicao: string;
  motivo: string;
  created_at: string;
}

const DECISOES = [
  { value: "reintegrar", label: "Volta ao estoque", icon: PackageCheck },
  { value: "tester", label: "Vira tester", icon: FlaskConical },
  { value: "perda", label: "Baixar como perda", icon: Trash2 },
] as const;

export default function QuarentenaDevolucao({ aberto, onClose }: { aberto: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [obs, setObs] = useState<Record<string, string>>({});

  const lista = useQuery({
    queryKey: ["devolucao_quarentena"],
    enabled: aberto,
    queryFn: async (): Promise<ItemQuarentena[]> => {
      const { data, error } = await db.rpc("fn_devolucao_quarentena_listar", { p_unidade_id: null, p_status: "pendente" });
      if (error) throw error;
      return (data || []) as ItemQuarentena[];
    },
  });

  const decidir = useMutation({
    mutationFn: async (p: { id: string; decisao: string; observacao: string }) => {
      const { error } = await db.rpc("fn_devolucao_quarentena_decidir", {
        p_id: p.id, p_decisao: p.decisao, p_observacao: p.observacao,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Decisão registrada");
      qc.invalidateQueries({ queryKey: ["devolucao_quarentena"] });
      invalidarVendasRelacionadas(qc);
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao registrar decisão"),
  });

  const itens = lista.data || [];

  return (
    <Dialog open={aberto} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldAlert size={18} className="text-gold" /> Quarentena de devoluções</DialogTitle>
          <DialogDescription>Itens devolvidos com avaria, vencidos ou incompletos aguardando decisão.</DialogDescription>
        </DialogHeader>

        {lista.isLoading ? (
          <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>
        ) : itens.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum item em quarentena.</p>
        ) : (
          <div className="space-y-2">
            {itens.map(q => (
              <div key={q.id} className="rounded-xl p-3 space-y-2 bg-surface-raised">
                <div className="flex justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate font-medium">{q.produto_nome}</span>
                  <span className="text-muted-foreground whitespace-nowrap">{q.quantidade}x</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {q.devolucao_numero} · {q.unidade_nome} · {nomeCondicao(q.condicao)}
                </p>
                {q.motivo && <p className="text-[11px] text-muted-foreground italic">"{q.motivo}"</p>}
                <input
                  value={obs[q.id] || ""}
                  onChange={e => setObs(o => ({ ...o, [q.id]: e.target.value }))}
                  placeholder="Observação da decisão (opcional)"
                  className="input w-full text-xs"
                />
                <div className="flex gap-1.5 flex-wrap">
                  {DECISOES.map(d => (
                    <button
                      key={d.value}
                      disabled={decidir.isPending}
                      onClick={() => decidir.mutate({ id: q.id, decisao: d.value, observacao: (obs[q.id] || "").trim() })}
                      className="text-[10px] px-2.5 py-1.5 rounded-full border border-gold-muted text-gold flex items-center gap-1 disabled:opacity-50">
                      <d.icon size={11} /> {d.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
