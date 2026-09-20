import { useState } from "react";
import { FlaskConical, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { ItemChecklist } from "@/hooks/useImplantacoes";
import EtapaEstrutura from "./EtapaEstrutura";

interface Props {
  implantacaoId: string;
  unidadeStatus?: string;
  itens: ItemChecklist[];
  onSalvar: (id: string, campos: Partial<ItemChecklist>) => Promise<void>;
  onAtualizar: () => void;
}

export default function EtapaTestes({
  implantacaoId,
  unidadeStatus,
  itens,
  onSalvar,
  onAtualizar,
}: Props) {
  const [ocupado, setOcupado] = useState(false);

  const iniciarTestes = async () => {
    setOcupado(true);
    try {
      const { error } = await supabase.rpc("fn_implantacao_iniciar_testes", {
        p_implantacao_id: implantacaoId,
      });
      if (error) throw error;
      toast.success("Unidade colocada em modo de teste");
      onAtualizar();
    } catch (e: unknown) {
      toast.error("Não foi possível iniciar os testes", { description: (e as Error)?.message });
    } finally {
      setOcupado(false);
    }
  };

  const pendentes = itens.filter((i) => !["CONCLUIDO", "NAO_APLICAVEL"].includes(i.status)).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-background p-3">
        <FlaskConical className="w-4 h-4 text-primary" />
        <div className="flex-1 text-sm">
          <p className="font-medium text-foreground">
            Situação da unidade: {unidadeStatus === "EM_TESTE" ? "Em teste" : unidadeStatus}
          </p>
          <p className="text-muted-foreground">
            No modo de teste as vendas são registradas como teste, ficam fora dos relatórios e não
            baixam estoque real. {pendentes} item(ns) de teste pendente(s).
          </p>
        </div>
        {unidadeStatus !== "EM_TESTE" && (
          <button
            onClick={iniciarTestes}
            disabled={ocupado}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {ocupado && <Loader2 className="w-4 h-4 animate-spin" />} Colocar em modo de teste
          </button>
        )}
      </div>

      <EtapaEstrutura implantacaoId={implantacaoId} itens={itens} onSalvar={onSalvar} />
    </div>
  );
}
