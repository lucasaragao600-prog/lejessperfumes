import { supabase } from "@/integrations/supabase/client";

export type AcaoAuditoria =
  | "UNIDADE_CRIADA"
  | "UNIDADE_ALTERADA"
  | "UNIDADE_LIBERADA"
  | "ESTOQUE_INICIAL_CRIADO"
  | "TRANSFERENCIA_CRIADA"
  | "TRANSFERENCIA_SEPARADA"
  | "TRANSFERENCIA_ENVIADA"
  | "TRANSFERENCIA_RECEBIDA"
  | "DIVERGENCIA_CRIADA"
  | "DIVERGENCIA_RESOLVIDA"
  | "AJUSTE_ESTOQUE"
  | "CONFIG_FISCAL_ALTERADA"
  | "CAIXA_CONFIGURADO"
  | "PERMISSAO_ALTERADA";

export interface EventoAuditoria {
  acao: AcaoAuditoria;
  entidade?: string;
  entidadeId?: string | null;
  unidadeId?: string | null;
  dadosAnteriores?: unknown;
  dadosNovos?: unknown;
}

/**
 * Registra um evento de auditoria. O IP é capturado no backend (Edge Function),
 * que também grava o registro com o usuário autenticado.
 */
export async function registrarAuditoria(evento: EventoAuditoria): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke("registrar-auditoria", {
      body: {
        acao: evento.acao,
        entidade: evento.entidade ?? "",
        entidade_id: evento.entidadeId ?? null,
        unidade_id: evento.unidadeId ?? null,
        dados_anteriores: evento.dadosAnteriores ?? null,
        dados_novos: evento.dadosNovos ?? null,
      },
    });
    if (error) throw error;
  } catch {
    // Falha de auditoria nunca deve interromper a operação do usuário.
    await supabase.rpc("fn_audit", {
      p_acao: evento.acao,
      p_entidade: evento.entidade ?? "",
      p_entidade_id: evento.entidadeId ?? null,
      p_unidade_id: evento.unidadeId ?? null,
      p_dados_anteriores: (evento.dadosAnteriores ?? null) as never,
      p_dados_novos: (evento.dadosNovos ?? null) as never,
      p_ip: "",
    });
  }
}
