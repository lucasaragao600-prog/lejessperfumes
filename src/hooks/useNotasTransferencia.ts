import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type NtStatus = "EMITIDA" | "RECEBIDA" | "RECEBIDA_COM_DIVERGENCIA" | "CANCELADA" | "SUBSTITUIDA";

export const NT_STATUS_META: Record<NtStatus, { label: string; className: string }> = {
  EMITIDA: { label: "Em trânsito", className: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  RECEBIDA: { label: "Recebida", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  RECEBIDA_COM_DIVERGENCIA: { label: "Recebida c/ divergência", className: "bg-destructive/10 text-destructive border-destructive/30" },
  CANCELADA: { label: "Cancelada", className: "bg-muted text-muted-foreground border-border" },
  SUBSTITUIDA: { label: "Substituída", className: "bg-muted text-muted-foreground border-border" },
};

export const NT_ORIGEM_LABEL: Record<string, string> = {
  transferencia: "Transferência", reposicao: "Reposição", decant: "Decants", manual: "Transferência manual",
};

export interface NtResumo {
  id: string; numero: string; revisao: number; tipo_nota: string; tipo_origem: string; origem_numero: string;
  status: NtStatus; origem_nome: string; destino_nome: string; emitido_em: string; emitido_por_nome: string;
  cnpjs_diferentes: boolean; total_itens: number;
}

export interface NtUnidade {
  nome: string; nome_exibicao: string; cnpj: string; inscricao_estadual: string; telefone: string;
  logradouro: string; numero: string; complemento: string; bairro: string; cidade: string; uf: string; cep: string;
}

export interface NtItem {
  id: string; tipo_item: string; codigo: string; descricao: string; unidade_medida: "un" | "ml";
  quantidade_enviada: number | null; quantidade_recebida: number | null; custo_unitario: number | null;
}

export interface NtDetalhe {
  id: string; numero: string; codigo_publico: string; revisao: number; tipo_nota: string; motivo_revisao: string;
  nt_original_numero: string | null; tipo_origem: string; origem_numero: string; status: NtStatus;
  origem: NtUnidade; destino: NtUnidade; cnpjs_diferentes: boolean;
  separado_por_nome: string; emitido_por_nome: string; emitido_em: string;
  recebido_por_nome: string | null; recebido_em: string | null;
  cancelado_por_nome: string | null; cancelado_em: string | null; cancelado_motivo: string | null;
  transportador: string; observacao: string;
  reimpressoes: number; mostrar_valores: boolean; conferencia_cega: boolean; itens: NtItem[];
}

export function useNtAtiva() {
  return useQuery({
    queryKey: ["nt-config"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fn__nt_cfg" as never);
      if (error) return false;
      return !!(data as { ativo?: boolean } | null)?.ativo;
    },
    staleTime: 60_000,
  });
}

export function useNotasLista(f: { status: string; unidade: string; busca: string; pagina: number }) {
  return useQuery({
    queryKey: ["notas-transferencia", f],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fn_nt_listar" as never, {
        p_status: f.status || null, p_unidade: f.unidade || null, p_busca: f.busca || null,
        p_limite: 30, p_offset: f.pagina * 30,
      } as never);
      if (error) throw error;
      return data as unknown as { total: number; itens: NtResumo[] };
    },
  });
}

export function useNotaDetalhe(id?: string | null) {
  return useQuery({
    queryKey: ["nota-transferencia", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fn_nt_detalhe" as never, { p_id: id } as never);
      if (error) throw error;
      return data as unknown as NtDetalhe;
    },
  });
}

export function useReimprimirNota() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id: string; via: string; formato: "a4" | "termica" }) => {
      const { data, error } = await supabase.rpc("fn_nt_registrar_impressao" as never, { p_id: p.id, p_via: p.via, p_formato: p.formato } as never);
      if (error) throw error;
      return data as unknown as number;
    },
    onSuccess: (_d, p) => qc.invalidateQueries({ queryKey: ["nota-transferencia", p.id] }),
  });
}
