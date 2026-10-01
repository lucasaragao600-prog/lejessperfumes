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
  margem_minima?: number;
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

/* ---------- Fase 2: produção ---------- */
export interface FichaSku {
  produto_id: string; produto_codigo: string; marca: string; nome: string; concentracao: string;
  tamanho_id: string; tamanho_nome: string; volume_ml: number; sku_id: string | null; sku: string;
  preco_venda: number; ativo: boolean; cadastrado: boolean; custo_ml: number | null;
  custo_frasco: number | null; custo_atomizador: number | null; custo_etiqueta: number | null;
  custo_embalagem: number | null; custo_mao_obra: number | null; custo_adicional: number | null;
  ver_custos: boolean; ver_margem: boolean;
}
export interface FrascoDisponivel { id: string; codigo: string; aberto_em: string; custo_ml: number; saldo_ml: number; reservado_ml: number; disponivel_ml: number }
export interface LoteDecant {
  id: string; codigo: string; produto_id: string; unidade_id: string; status: string; volume_total_ml: number;
  ml_consumido: number; perdas_ml: number; custo_liquido: number; custo_insumos: number; custo_total: number;
  responsavel_producao: string; responsavel_conferencia: string; observacao: string; motivo_cancelamento: string;
  fora_fifo: boolean; criado_por_nome: string; data_producao: string; created_at: string; conferido_em: string | null;
  produto_codigo: string; marca: string; nome: string; concentracao: string; unidade_nome: string; ver_custos: boolean;
  itens: { id: string; sku: string; volume_ml: number; qtd_planejada: number; qtd_fisica: number | null; diferenca: number | null; motivo: string; justificativa: string; custo_unitario: number }[];
  frascos: { frasco_id: string; codigo: string; ml_reservado: number; ml_consumido: number | null; custo_ml: number }[];
  eventos: { evento: string; dados: any; usuario: string; em: string }[];
}

export function useFichas() {
  return useQuery({
    queryKey: ["decant-fichas"],
    queryFn: async (): Promise<FichaSku[]> => (await rpc("fn_decant_fichas_listar", { p_produto_id: null })) || [],
  });
}

export function useFrascosDisponiveis(produtoId: string, unidadeId: string) {
  return useQuery({
    queryKey: ["decant-frascos-disp", produtoId, unidadeId],
    enabled: !!produtoId && !!unidadeId,
    queryFn: async (): Promise<FrascoDisponivel[]> =>
      ((await rpc("fn_decant_frascos_disponiveis", { p_produto_id: produtoId, p_unidade_id: unidadeId })) || [])
        .map((f: any) => ({ ...f, saldo_ml: Number(f.saldo_ml), reservado_ml: Number(f.reservado_ml), disponivel_ml: Number(f.disponivel_ml) })),
  });
}

export function useLotes(unidadeId: string | null, status: string | null) {
  return useQuery({
    queryKey: ["decant-lotes", unidadeId, status],
    queryFn: async (): Promise<LoteDecant[]> =>
      (await rpc("fn_decant_lotes_listar", { p_unidade_id: unidadeId, p_status: status, p_limite: 30, p_offset: 0 })) || [],
  });
}

function useOpLote<T>(fn: (p: T) => Promise<any>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => ["decant-lotes", "decant-frascos", "decant-frascos-disp", "decant-historico", "decant-fichas"]
      .forEach((k) => qc.invalidateQueries({ queryKey: [k] })),
  });
}

export const useSalvarSku = () => useOpLote((p: { produtoId: string; tamanhoId: string; sku: string; preco: number | null; ativo: boolean }) =>
  rpc("fn_decant_sku_salvar", { p_produto_id: p.produtoId, p_tamanho_id: p.tamanhoId, p_sku: p.sku, p_preco: p.preco, p_ativo: p.ativo }));

export const useCriarLote = () => useOpLote((p: { produtoId: string; unidadeId: string; itens: { tamanho_id: string; quantidade: number }[];
  frascos: { frasco_id: string; ml: number }[] | null; responsavel: string; observacao: string; chave: string }) =>
  rpc("fn_decant_lote_criar", { p_produto_id: p.produtoId, p_unidade_id: p.unidadeId, p_itens: p.itens, p_frascos: p.frascos,
    p_responsavel: p.responsavel, p_observacao: p.observacao, p_idempotency_key: p.chave }));

export const useIniciarLote = () => useOpLote((id: string) => rpc("fn_decant_lote_iniciar", { p_lote_id: id }));
export const useFinalizarLote = () => useOpLote((p: { id: string; consumo: { frasco_id: string; ml: number }[] | null }) =>
  rpc("fn_decant_lote_finalizar", { p_lote_id: p.id, p_consumo: p.consumo }));
export const useConferirLote = () => useOpLote((p: { id: string; itens: { item_id: string; qtd_fisica: number; motivo: string; justificativa: string }[]; responsavel: string }) =>
  rpc("fn_decant_lote_conferir", { p_lote_id: p.id, p_itens: p.itens, p_responsavel: p.responsavel }));
export const useCancelarLote = () => useOpLote((p: { id: string; motivo: string }) =>
  rpc("fn_decant_lote_cancelar", { p_lote_id: p.id, p_motivo: p.motivo }));
export const useEditarLote = () => useOpLote((p: { id: string; observacao: string; responsavel: string; motivo: string }) =>
  rpc("fn_decant_lote_editar", { p_lote_id: p.id, p_observacao: p.observacao, p_responsavel_producao: p.responsavel, p_motivo: p.motivo }));
