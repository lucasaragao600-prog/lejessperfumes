import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { registrarAuditoria } from "@/lib/audit";

export type TransferenciaStatus =
  | "RASCUNHO"
  | "AGUARDANDO_SEPARACAO"
  | "EM_SEPARACAO"
  | "PRONTO_PARA_ENVIO"
  | "EM_TRANSITO"
  | "AGUARDANDO_CONFERENCIA"
  | "AGUARDANDO_TRATAMENTO"
  | "RECEBIDO"
  | "CANCELADA";

export const TRF_STATUS_META: Record<TransferenciaStatus, { label: string; className: string }> = {
  RASCUNHO: { label: "Rascunho", className: "bg-muted text-muted-foreground border-border" },
  AGUARDANDO_SEPARACAO: { label: "Aguardando separação", className: "bg-amber-500/10 text-amber-500 border-amber-500/30" },
  EM_SEPARACAO: { label: "Em separação", className: "bg-amber-500/10 text-amber-500 border-amber-500/30" },
  PRONTO_PARA_ENVIO: { label: "Pronto para envio", className: "bg-sky-500/10 text-sky-400 border-sky-500/30" },
  EM_TRANSITO: { label: "Em trânsito", className: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  AGUARDANDO_CONFERENCIA: { label: "Aguardando conferência", className: "bg-violet-500/10 text-violet-400 border-violet-500/30" },
  AGUARDANDO_TRATAMENTO: { label: "Divergência", className: "bg-destructive/10 text-destructive border-destructive/30" },
  RECEBIDO: { label: "Recebido", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  CANCELADA: { label: "Cancelada", className: "bg-muted text-muted-foreground border-border" },
};

export const RESOLUCOES_DIVERGENCIA = [
  { chave: "CONFIRMAR_DIFERENCA", label: "Confirmar diferença", descricao: "A origem baixa apenas o que foi recebido; o restante volta a ficar disponível." },
  { chave: "REGISTRAR_PERDA", label: "Registrar perda", descricao: "A origem baixa o que foi enviado e a diferença vira perda." },
  { chave: "RECONTAR", label: "Recontar", descricao: "Volta para conferência no destino." },
  { chave: "DEVOLVER_ITEM", label: "Devolver item", descricao: "Conclui e gera uma transferência inversa do excedente." },
  { chave: "CORRIGIR_EXPEDICAO", label: "Corrigir expedição", descricao: "Ajusta a quantidade enviada para a conferida e conclui." },
] as const;

export interface Transferencia {
  id: string;
  numero: string;
  origem_unidade_id: string;
  destino_unidade_id: string;
  implantacao_id: string | null;
  status: TransferenciaStatus;
  observacao: string;
  transportador: string;
  criado_por_nome: string;
  separado_por_nome: string | null;
  separado_em: string | null;
  enviado_por_nome: string | null;
  enviado_em: string | null;
  recebido_por_nome: string | null;
  recebido_em: string | null;
  cancelado_motivo: string;
  created_at: string;
}

export interface TransferenciaItem {
  id: string;
  transferencia_id: string;
  produto_id: string;
  produto_nome: string;
  quantidade_solicitada: number;
  quantidade_separada: number | null;
  quantidade_enviada: number | null;
  quantidade_recebida: number | null;
  status: string;
}

export interface TransferenciaEvento {
  id: string;
  transferencia_id: string;
  evento: string;
  detalhes: string;
  usuario_nome: string;
  created_at: string;
}

export interface NovoItemTransferencia {
  produto_id: string;
  produto_nome: string;
  quantidade: number;
}

export function useTransferencias() {
  const qc = useQueryClient();

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["transferencias"] });
    qc.invalidateQueries({ queryKey: ["transferencia-itens"] });
    qc.invalidateQueries({ queryKey: ["transferencia-eventos"] });
    qc.invalidateQueries({ queryKey: ["estoque-unidades"] });
    qc.invalidateQueries({ queryKey: ["perfumes"] });
    qc.invalidateQueries({ queryKey: ["movimentacoes"] });
  };

  const transferencias = useQuery({
    queryKey: ["transferencias"],
    queryFn: async (): Promise<Transferencia[]> => {
      const { data, error } = await supabase
        .from("transferencias")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Transferencia[];
    },
  });

  const criar = useMutation({
    mutationFn: async (input: {
      origem: string;
      destino: string;
      itens: NovoItemTransferencia[];
      observacao?: string;
      implantacaoId?: string | null;
    }) => {
      const { data, error } = await supabase.rpc("fn_transferencia_criar", {
        p_origem: input.origem,
        p_destino: input.destino,
        p_itens: input.itens as never,
        p_observacao: input.observacao ?? "",
        p_implantacao_id: input.implantacaoId ?? null,
      });
      if (error) throw error;
      const id = data as unknown as string;
      await registrarAuditoria({
        acao: "TRANSFERENCIA_CRIADA",
        entidade: "transferencias",
        entidadeId: id,
        unidadeId: input.origem,
        dadosNovos: { destino: input.destino, itens: input.itens.length },
      });
      return id;
    },
    onSuccess: invalidar,
  });

  const confirmar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("fn_transferencia_confirmar", { p_id: id });
      if (error) throw error;
    },
    onSuccess: invalidar,
  });

  const separarItem = useMutation({
    mutationFn: async (input: { itemId: string; quantidade: number; autorizado?: boolean }) => {
      const { error } = await supabase.rpc("fn_transferencia_separar_item", {
        p_item_id: input.itemId,
        p_quantidade: input.quantidade,
        p_autorizado: input.autorizado ?? false,
      });
      if (error) throw error;
    },
    onSuccess: invalidar,
  });

  const finalizarSeparacao = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("fn_transferencia_finalizar_separacao", { p_id: id });
      if (error) throw error;
      await registrarAuditoria({ acao: "TRANSFERENCIA_SEPARADA", entidade: "transferencias", entidadeId: id });
    },
    onSuccess: invalidar,
  });

  const enviar = useMutation({
    mutationFn: async (input: { id: string; transportador?: string; observacao?: string }) => {
      const { error } = await supabase.rpc("fn_transferencia_enviar", {
        p_id: input.id,
        p_transportador: input.transportador ?? "",
        p_observacao: input.observacao ?? "",
      });
      if (error) throw error;
      await registrarAuditoria({ acao: "TRANSFERENCIA_ENVIADA", entidade: "transferencias", entidadeId: input.id });
    },
    onSuccess: invalidar,
  });

  const iniciarConferencia = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("fn_transferencia_iniciar_conferencia", { p_id: id });
      if (error) throw error;
    },
    onSuccess: invalidar,
  });

  const receber = useMutation({
    mutationFn: async (input: { id: string; conferencias: { item_id: string; quantidade: number }[] }) => {
      const { data, error } = await supabase.rpc("fn_transferencia_receber", {
        p_id: input.id,
        p_conferencias: input.conferencias as never,
      });
      if (error) throw error;
      const status = data as unknown as string;
      await registrarAuditoria({
        acao: status === "RECEBIDO" ? "TRANSFERENCIA_RECEBIDA" : "DIVERGENCIA_CRIADA",
        entidade: "transferencias",
        entidadeId: input.id,
        dadosNovos: { status },
      });
      return status;
    },
    onSuccess: invalidar,
  });

  const resolverDivergencia = useMutation({
    mutationFn: async (input: { id: string; resolucao: string; justificativa: string }) => {
      const { data, error } = await supabase.rpc("fn_transferencia_resolver_divergencia", {
        p_id: input.id,
        p_resolucao: input.resolucao,
        p_justificativa: input.justificativa,
      });
      if (error) throw error;
      await registrarAuditoria({
        acao: "DIVERGENCIA_RESOLVIDA",
        entidade: "transferencias",
        entidadeId: input.id,
        dadosNovos: { resolucao: input.resolucao, justificativa: input.justificativa },
      });
      return data as unknown as string;
    },
    onSuccess: invalidar,
  });

  const cancelar = useMutation({
    mutationFn: async (input: { id: string; motivo: string }) => {
      const { error } = await supabase.rpc("fn_transferencia_cancelar", {
        p_id: input.id,
        p_motivo: input.motivo,
      });
      if (error) throw error;
    },
    onSuccess: invalidar,
  });

  return {
    transferencias: transferencias.data || [],
    isLoading: transferencias.isLoading,
    criar,
    confirmar,
    separarItem,
    finalizarSeparacao,
    enviar,
    iniciarConferencia,
    receber,
    resolverDivergencia,
    cancelar,
  };
}

export function useTransferenciaItens(transferenciaId?: string) {
  return useQuery({
    queryKey: ["transferencia-itens", transferenciaId],
    enabled: !!transferenciaId,
    queryFn: async (): Promise<TransferenciaItem[]> => {
      const { data, error } = await supabase
        .from("transferencia_itens")
        .select("*")
        .eq("transferencia_id", transferenciaId!)
        .order("produto_nome");
      if (error) throw error;
      return (data || []) as unknown as TransferenciaItem[];
    },
  });
}

export function useTransferenciaEventos(transferenciaId?: string) {
  return useQuery({
    queryKey: ["transferencia-eventos", transferenciaId],
    enabled: !!transferenciaId,
    queryFn: async (): Promise<TransferenciaEvento[]> => {
      const { data, error } = await supabase
        .from("transferencia_eventos")
        .select("*")
        .eq("transferencia_id", transferenciaId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as TransferenciaEvento[];
    },
  });
}

/** Saldo por produto em uma unidade (quantidade, reservada e disponível). */
export function useEstoqueUnidade(unidadeId?: string) {
  return useQuery({
    queryKey: ["estoque-unidades", unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const PAGE = 1000;
      let from = 0;
      const mapa = new Map<string, { quantidade: number; reservada: number; disponivel: number }>();
      while (true) {
        const { data, error } = await supabase
          .from("estoque_unidades")
          .select("produto_id, quantidade, quantidade_reservada")
          .eq("unidade_id", unidadeId!)
          .range(from, from + PAGE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        for (const r of data) {
          const q = r.quantidade ?? 0;
          const res = r.quantidade_reservada ?? 0;
          mapa.set(r.produto_id, { quantidade: q, reservada: res, disponivel: q - res });
        }
        if (data.length < PAGE) break;
        from += PAGE;
      }
      return mapa;
    },
  });
}
