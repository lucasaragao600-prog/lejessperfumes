import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { STATUS_DEVOLUCAO_FISCAL } from "@/lib/devolucaoFiscal";

interface NotaVinculada {
  id: string;
  numero: number | null;
  serie: number | null;
  chave: string | null;
  status: string;
  motivo: string | null;
}

export interface DevolucaoFiscalDetalhe {
  status: keyof typeof STATUS_DEVOLUCAO_FISCAL;
  observacao: string | null;
  chave_entrada: string | null;
  atualizado_por: string | null;
  atualizado_em: string | null;
  grupo_origem: string;
  grupo_saida: string | null;
  notas_origem: NotaVinculada[];
  notas_saida: NotaVinculada[];
  cnpjs_distintos: boolean | null;
  pode_tratar: boolean;
}

export function useDevolucaoFiscal(id: string) {
  const qc = useQueryClient();
  const detalhe = useQuery({
    queryKey: ["devolucao_fiscal", id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fn_devolucao_fiscal_detalhe", { p_devolucao_id: id });
      if (error) throw error;
      return data as unknown as DevolucaoFiscalDetalhe;
    },
  });
  const tratar = useMutation({
    mutationFn: async (p: { status: DevolucaoFiscalDetalhe["status"]; observacao: string; chave: string }) => {
      const { data, error } = await supabase.rpc("fn_devolucao_fiscal_tratar", {
        p_devolucao_id: id, p_status: p.status, p_observacao: p.observacao, p_chave_entrada: p.chave || undefined,
      });
      if (error) throw error;
      return data as unknown as DevolucaoFiscalDetalhe;
    },
    onSuccess: (data) => {
      qc.setQueryData(["devolucao_fiscal", id], data);
      qc.invalidateQueries({ queryKey: ["devolucoes_lista"] });
    },
  });
  return { detalhe, tratar };
}