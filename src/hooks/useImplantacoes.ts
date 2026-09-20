import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type StatusEtapa = "NAO_INICIADA" | "EM_ANDAMENTO" | "CONCLUIDA" | "BLOQUEADA";
export type StatusItemChecklist = "PENDENTE" | "EM_ANDAMENTO" | "CONCLUIDO" | "NAO_APLICAVEL";
export type Criticidade = "CRITICA" | "ALTA" | "NORMAL";

export interface Implantacao {
  id: string;
  unidade_id: string;
  status: string;
  responsavel_nome: string;
  data_prevista_inauguracao: string | null;
  data_inauguracao: string | null;
  observacoes: string;
  progresso: number;
  criado_por_nome: string;
  created_at: string;
  updated_at: string;
}

export interface Etapa {
  id: string;
  implantacao_id: string;
  numero: number;
  chave: string;
  nome: string;
  status: StatusEtapa;
  aplicavel: boolean;
  observacao: string;
}

export interface ItemChecklist {
  id: string;
  implantacao_id: string;
  etapa_chave: string;
  item: string;
  ordem: number;
  status: StatusItemChecklist;
  responsavel_nome: string;
  data_prevista: string | null;
  data_conclusao: string | null;
  observacao: string;
  anexo_url: string;
}

export interface Pendencia {
  id: string;
  implantacao_id: string;
  titulo: string;
  descricao: string;
  criticidade: Criticidade;
  origem: string;
  etapa_chave: string;
  responsavel_nome: string;
  prazo: string | null;
  status: string;
}

export interface Equipamento {
  id: string;
  unidade_id: string;
  implantacao_id: string | null;
  tipo: string;
  marca: string;
  modelo: string;
  numero_serie: string;
  patrimonio: string;
  ip: string;
  local: string;
  status: string;
  observacao: string;
}

export const ETAPAS_IMPLEMENTADAS = [
  "cadastro",
  "fiscal",
  "estrutura",
  "usuarios",
  "estoque",
  "caixa",
  "equipamentos",
];

export function useImplantacoes() {
  const qc = useQueryClient();

  const { data: implantacoes = [], isLoading } = useQuery({
    queryKey: ["implantacoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("implantacoes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Implantacao[];
    },
  });

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["implantacoes"] });
    qc.invalidateQueries({ queryKey: ["unidades"] });
  };

  const criar = useMutation({
    mutationFn: async (p: {
      unidadeId: string;
      responsavelNome?: string;
      dataPrevista?: string | null;
      observacoes?: string;
    }) => {
      const { data, error } = await supabase.rpc("fn_implantacao_criar", {
        p_unidade_id: p.unidadeId,
        p_responsavel_nome: p.responsavelNome || "",
        p_data_prevista: p.dataPrevista || null,
        p_observacoes: p.observacoes || "",
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: invalidar,
  });

  return { implantacoes, isLoading, criar: criar.mutateAsync, invalidar };
}

export function useImplantacaoDetalhe(implantacaoId?: string) {
  const qc = useQueryClient();
  const habilitado = !!implantacaoId;

  const etapas = useQuery({
    queryKey: ["implantacao-etapas", implantacaoId],
    enabled: habilitado,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("implantacao_etapas")
        .select("*")
        .eq("implantacao_id", implantacaoId!)
        .order("numero");
      if (error) throw error;
      return (data || []) as unknown as Etapa[];
    },
  });

  const checklist = useQuery({
    queryKey: ["implantacao-checklist", implantacaoId],
    enabled: habilitado,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("implantacao_checklist")
        .select("*")
        .eq("implantacao_id", implantacaoId!)
        .order("ordem");
      if (error) throw error;
      return (data || []) as unknown as ItemChecklist[];
    },
  });

  const pendencias = useQuery({
    queryKey: ["implantacao-pendencias", implantacaoId],
    enabled: habilitado,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("implantacao_pendencias")
        .select("*")
        .eq("implantacao_id", implantacaoId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Pendencia[];
    },
  });

  const recarregar = () => {
    qc.invalidateQueries({ queryKey: ["implantacao-etapas", implantacaoId] });
    qc.invalidateQueries({ queryKey: ["implantacao-checklist", implantacaoId] });
    qc.invalidateQueries({ queryKey: ["implantacao-pendencias", implantacaoId] });
    qc.invalidateQueries({ queryKey: ["implantacoes"] });
  };

  const salvarEtapa = async (id: string, campos: Partial<Etapa>) => {
    const { error } = await supabase.from("implantacao_etapas").update(campos as never).eq("id", id);
    if (error) throw error;
    if (implantacaoId) {
      await supabase.rpc("fn_implantacao_recalcular_progresso", { p_id: implantacaoId });
    }
    recarregar();
  };

  const salvarItem = async (id: string, campos: Partial<ItemChecklist>) => {
    const { error } = await supabase
      .from("implantacao_checklist")
      .update(campos as never)
      .eq("id", id);
    if (error) throw error;
    recarregar();
  };

  const criarPendencia = async (p: Partial<Pendencia> & { titulo: string }) => {
    const { error } = await supabase
      .from("implantacao_pendencias")
      .insert({ ...p, implantacao_id: implantacaoId } as never);
    if (error) throw error;
    recarregar();
  };

  const resolverPendencia = async (id: string) => {
    const { error } = await supabase
      .from("implantacao_pendencias")
      .update({ status: "RESOLVIDA", resolvido_em: new Date().toISOString() } as never)
      .eq("id", id);
    if (error) throw error;
    recarregar();
  };

  return {
    etapas: etapas.data || [],
    checklist: checklist.data || [],
    pendencias: pendencias.data || [],
    isLoading: etapas.isLoading || checklist.isLoading,
    salvarEtapa,
    salvarItem,
    criarPendencia,
    resolverPendencia,
    recarregar,
  };
}

export function useEquipamentos(unidadeId?: string) {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["equipamentos", unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipamentos_unidade")
        .select("*")
        .eq("unidade_id", unidadeId!)
        .order("created_at");
      if (error) throw error;
      return (data || []) as unknown as Equipamento[];
    },
  });

  const recarregar = () => qc.invalidateQueries({ queryKey: ["equipamentos", unidadeId] });

  const adicionar = async (e: Partial<Equipamento>) => {
    const { error } = await supabase.from("equipamentos_unidade").insert(e as never);
    if (error) throw error;
    recarregar();
  };

  const atualizar = async (id: string, e: Partial<Equipamento>) => {
    const { error } = await supabase.from("equipamentos_unidade").update(e as never).eq("id", id);
    if (error) throw error;
    recarregar();
  };

  return { equipamentos: data, isLoading, adicionar, atualizar };
}

export async function enviarAnexo(implantacaoId: string, itemId: string, file: File) {
  const caminho = `${implantacaoId}/${itemId}-${Date.now()}-${file.name}`;
  const { error } = await supabase.storage.from("implantacao-anexos").upload(caminho, file);
  if (error) throw error;
  return caminho;
}

export async function urlAnexo(caminho: string) {
  const { data, error } = await supabase.storage
    .from("implantacao-anexos")
    .createSignedUrl(caminho, 60 * 10);
  if (error) throw error;
  return data.signedUrl;
}
