import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

export interface DecantConfig {
  ativo: boolean;
  visivel_vendedor: boolean;
  tolerancia_ml: number;
  rendimento_padrao: number;
  dias_aberto_alerta: number;
  conferencia_obrigatoria: boolean;
}

export interface FrascoAberto {
  id: string; codigo: string; produto_id: string; produto_codigo: string; marca: string; nome: string;
  concentracao: string; unidade_id: string; unidade_nome: string; lote_fabricante: string; validade: string | null;
  volume_nominal_ml: number; volume_inicial_ml: number; custo: number; custo_ml: number;
  status: "aberto" | "bloqueado"; aberto_em: string; aberto_por_nome: string; responsavel: string;
  saldo_ml: number; pendencias: number;
}

export interface DecantTamanho {
  id?: string; nome: string; volume_ml: number; frasco_descricao: string; custo_frasco: number;
  custo_atomizador: number; custo_etiqueta: number; custo_embalagem: number; custo_adicional: number;
  custo_mao_obra: number; ativo: boolean;
}

const msg = (e: any) => e?.message || "Erro ao processar";
const chave = () => crypto.randomUUID();

export function useDecantConfig() {
  return useQuery({
    queryKey: ["decant-config"],
    queryFn: async (): Promise<DecantConfig | null> => {
      const { data, error } = await db.from("configuracoes").select("valor").eq("chave", "decants").maybeSingle();
      if (error) throw error;
      return (data?.valor as DecantConfig) ?? null;
    },
    staleTime: 60_000,
  });
}

export function useSalvarDecantConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (valor: DecantConfig) => {
      const { error } = await db.from("configuracoes").update({ valor, updated_at: new Date().toISOString() }).eq("chave", "decants");
      if (error) throw new Error(msg(error));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["decant-config"] }),
  });
}

export function useFrascosAbertos(unidadeId: string | null) {
  return useQuery({
    queryKey: ["decant-frascos", unidadeId],
    queryFn: async (): Promise<FrascoAberto[]> => {
      const { data, error } = await db.rpc("fn_decant_frascos_listar", { p_unidade_id: unidadeId });
      if (error) throw error;
      return (data || []).map((f: any) => ({ ...f, saldo_ml: Number(f.saldo_ml), custo_ml: Number(f.custo_ml) }));
    },
  });
}

export function useFechadosSaldo() {
  return useQuery({
    queryKey: ["decant-fechados"],
    queryFn: async () => {
      const { data, error } = await db.from("decant_fechados_saldo").select("produto_id, unidade_id, quantidade").gt("quantidade", 0);
      if (error) throw error;
      return (data || []) as { produto_id: string; unidade_id: string; quantidade: number }[];
    },
  });
}

export function useHistoricoFrasco(frascoId: string | null) {
  return useQuery({
    queryKey: ["decant-historico", frascoId],
    enabled: !!frascoId,
    queryFn: async () => {
      const [mov, conf] = await Promise.all([
        db.from("decant_ml_ledger").select("*").eq("frasco_id", frascoId).order("created_at"),
        db.from("decant_conferencias").select("*").eq("frasco_id", frascoId).order("created_at", { ascending: false }),
      ]);
      if (mov.error) throw mov.error;
      if (conf.error) throw conf.error;
      return { movimentos: mov.data || [], conferencias: conf.data || [] };
    },
  });
}

export function usePerfumeConfigs() {
  return useQuery({
    queryKey: ["decant-perfume-config"],
    queryFn: async () => {
      const { data, error } = await db.from("decant_perfume_config").select("*");
      if (error) throw error;
      return (data || []) as { produto_id: string; elegivel: boolean; ativo: boolean; estoque_minimo_ml: number; rendimento_util: number }[];
    },
  });
}

export function useSalvarPerfumeConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (c: { produto_id: string; elegivel: boolean; ativo: boolean; estoque_minimo_ml: number; rendimento_util: number }) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await db.from("decant_perfume_config")
        .upsert({ ...c, atualizado_por: u.user?.id, updated_at: new Date().toISOString() }, { onConflict: "produto_id" });
      if (error) throw new Error(msg(error));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["decant-perfume-config"] }),
  });
}

export function useTamanhos() {
  return useQuery({
    queryKey: ["decant-tamanhos"],
    queryFn: async (): Promise<DecantTamanho[]> => {
      const { data, error } = await db.from("decant_tamanhos").select("*").order("volume_ml");
      if (error) throw error;
      return data || [];
    },
  });
}

export function useSalvarTamanho() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (t: DecantTamanho) => {
      const payload = { ...t, updated_at: new Date().toISOString() };
      const q = t.id ? db.from("decant_tamanhos").update(payload).eq("id", t.id) : db.from("decant_tamanhos").insert(payload);
      const { error } = await q;
      if (error) throw new Error(error.code === "23505" ? "Já existe um tamanho com esse volume" : msg(error));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["decant-tamanhos"] }),
  });
}

function useOperacao<T>(fn: (p: T) => Promise<any>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      ["decant-frascos", "decant-fechados", "decant-historico", "estoque-lista", "perfumes"].forEach((k) =>
        qc.invalidateQueries({ queryKey: [k] }));
    },
  });
}

async function rpc(nome: string, args: Record<string, unknown>) {
  const { data, error } = await db.rpc(nome, args);
  if (error) throw new Error(msg(error));
  return data;
}

export const useDestinar = () => useOperacao((p: { produtoId: string; unidadeId: string; quantidade: number; responsavel: string; data: string; observacao: string }) =>
  rpc("fn_decant_destinar", { p_produto_id: p.produtoId, p_unidade_id: p.unidadeId, p_quantidade: p.quantidade,
    p_responsavel: p.responsavel, p_data: p.data || null, p_observacao: p.observacao, p_idempotency_key: chave() }));

export const useAbrirFrasco = () => useOperacao((p: { produtoId: string; unidadeId: string; loteFabricante: string; validade: string; volumeInicial: number | null; responsavel: string; observacao: string }) =>
  rpc("fn_decant_abrir_frasco", { p_produto_id: p.produtoId, p_unidade_id: p.unidadeId, p_lote_fabricante: p.loteFabricante,
    p_validade: p.validade || null, p_volume_inicial: p.volumeInicial, p_responsavel: p.responsavel,
    p_observacao: p.observacao, p_idempotency_key: chave() }));

export const useSaidaMl = () => useOperacao((p: { frascoId: string; tipo: string; ml: number; motivo: string }) =>
  rpc("fn_decant_registrar_saida", { p_frasco_id: p.frascoId, p_tipo: p.tipo, p_ml: p.ml, p_motivo: p.motivo, p_idempotency_key: chave() }));

export const useConferir = () => useOperacao((p: { frascoId: string; saldoFisico: number; justificativa: string; acao: string }) =>
  rpc("fn_decant_conferir", { p_frasco_id: p.frascoId, p_saldo_fisico: p.saldoFisico, p_justificativa: p.justificativa, p_acao: p.acao }));

export const useDecidirConferencia = () => useOperacao((p: { id: string; aprovar: boolean; acao: string; obs: string }) =>
  rpc("fn_decant_decidir_conferencia", { p_conferencia_id: p.id, p_aprovar: p.aprovar, p_acao: p.acao, p_obs: p.obs }));
