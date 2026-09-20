import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { registrarAuditoria } from "@/lib/audit";

export interface PermissaoCatalogo {
  chave: string;
  modulo: string;
  descricao: string;
}

export interface UsuarioBasico {
  userId: string;
  nome: string;
  loja: string;
}

export interface VinculoUnidade {
  id: string;
  usuarioId: string;
  unidadeId: string;
  ativo: boolean;
}

export interface PermissaoConcedida {
  id: string;
  usuarioId: string;
  unidadeId: string;
  permissao: string;
}

export function useAcessosUnidade(unidadeId?: string) {
  const qc = useQueryClient();

  const catalogo = useQuery({
    queryKey: ["permissoes_catalogo"],
    queryFn: async (): Promise<PermissaoCatalogo[]> => {
      const { data, error } = await supabase
        .from("permissoes_catalogo")
        .select("chave, modulo, descricao")
        .order("chave");
      if (error) throw error;
      return (data || []) as PermissaoCatalogo[];
    },
  });

  const usuarios = useQuery({
    queryKey: ["profiles-basico"],
    queryFn: async (): Promise<UsuarioBasico[]> => {
      const { data, error } = await supabase.from("profiles").select("user_id, nome, loja").order("nome");
      if (error) throw error;
      return (data || []).map((p) => ({ userId: p.user_id, nome: p.nome, loja: p.loja }));
    },
  });

  const vinculos = useQuery({
    queryKey: ["usuario_unidades", unidadeId],
    enabled: !!unidadeId,
    queryFn: async (): Promise<VinculoUnidade[]> => {
      const { data, error } = await supabase
        .from("usuario_unidades")
        .select("id, usuario_id, unidade_id, ativo")
        .eq("unidade_id", unidadeId!);
      if (error) throw error;
      return (data || []).map((v) => ({
        id: v.id,
        usuarioId: v.usuario_id,
        unidadeId: v.unidade_id,
        ativo: v.ativo,
      }));
    },
  });

  const permissoes = useQuery({
    queryKey: ["usuario_unidade_permissoes", unidadeId],
    enabled: !!unidadeId,
    queryFn: async (): Promise<PermissaoConcedida[]> => {
      const { data, error } = await supabase
        .from("usuario_unidade_permissoes")
        .select("id, usuario_id, unidade_id, permissao")
        .eq("unidade_id", unidadeId!);
      if (error) throw error;
      return (data || []).map((p) => ({
        id: p.id,
        usuarioId: p.usuario_id,
        unidadeId: p.unidade_id,
        permissao: p.permissao,
      }));
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["usuario_unidades"] });
    qc.invalidateQueries({ queryKey: ["usuario_unidade_permissoes"] });
  };

  const definirAcesso = useMutation({
    mutationFn: async (p: { usuarioId: string; unidadeId: string; ativo: boolean }) => {
      const existente = (vinculos.data || []).find((v) => v.usuarioId === p.usuarioId);
      if (existente) {
        const { error } = await supabase
          .from("usuario_unidades")
          .update({ ativo: p.ativo })
          .eq("id", existente.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("usuario_unidades")
          .insert({ usuario_id: p.usuarioId, unidade_id: p.unidadeId, ativo: p.ativo });
        if (error) throw error;
      }
      await registrarAuditoria({
        acao: "PERMISSAO_ALTERADA",
        entidade: "usuario_unidades",
        entidadeId: p.usuarioId,
        unidadeId: p.unidadeId,
        dadosNovos: { acesso: p.ativo },
      });
    },
    onSuccess: invalidate,
  });

  const definirPermissao = useMutation({
    mutationFn: async (p: {
      usuarioId: string;
      unidadeId: string;
      permissao: string;
      concedida: boolean;
    }) => {
      if (p.concedida) {
        const { error } = await supabase
          .from("usuario_unidade_permissoes")
          .insert({ usuario_id: p.usuarioId, unidade_id: p.unidadeId, permissao: p.permissao });
        if (error && !error.message.includes("duplicate")) throw error;
      } else {
        const { error } = await supabase
          .from("usuario_unidade_permissoes")
          .delete()
          .eq("usuario_id", p.usuarioId)
          .eq("unidade_id", p.unidadeId)
          .eq("permissao", p.permissao);
        if (error) throw error;
      }
      await registrarAuditoria({
        acao: "PERMISSAO_ALTERADA",
        entidade: "usuario_unidade_permissoes",
        entidadeId: p.usuarioId,
        unidadeId: p.unidadeId,
        dadosNovos: { permissao: p.permissao, concedida: p.concedida },
      });
    },
    onSuccess: invalidate,
  });

  return {
    catalogo: catalogo.data || [],
    usuarios: usuarios.data || [],
    vinculos: vinculos.data || [],
    permissoes: permissoes.data || [],
    isLoading:
      catalogo.isLoading || usuarios.isLoading || vinculos.isLoading || permissoes.isLoading,
    definirAcesso: definirAcesso.mutateAsync,
    definirPermissao: definirPermissao.mutateAsync,
  };
}

/** Permissões do usuário logado, por unidade. Master tem tudo. */
export function useMinhasPermissoes() {
  return useQuery({
    queryKey: ["minhas-permissoes"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return [] as PermissaoConcedida[];
      const { data, error } = await supabase
        .from("usuario_unidade_permissoes")
        .select("id, usuario_id, unidade_id, permissao")
        .eq("usuario_id", uid);
      if (error) throw error;
      return (data || []).map((p) => ({
        id: p.id,
        usuarioId: p.usuario_id,
        unidadeId: p.unidade_id,
        permissao: p.permissao,
      })) as PermissaoConcedida[];
    },
  });
}
