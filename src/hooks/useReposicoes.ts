import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ReposicaoStatus = "sugerida" | "em_transito" | "recebida" | "cancelada";

export interface Reposicao {
  id: string;
  produto_id: string;
  produto_nome: string;
  origem: string;
  destino: string;
  quantidade_sugerida: number;
  quantidade_enviada: number | null;
  quantidade_recebida: number | null;
  status: ReposicaoStatus;
  solicitado_por: string;
  conferido_por: string | null;
  recebido_por: string | null;
  foto_saida_url: string | null;
  foto_chegada_url: string | null;
  observacao: string | null;
  enviado_em: string | null;
  recebido_em: string | null;
  created_at: string;
  updated_at: string;
}

export function useReposicoes() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["reposicoes"] });

  const { data: reposicoes = [], isLoading } = useQuery({
    queryKey: ["reposicoes"],
    queryFn: async () => {
      const all: any[] = [];
      let from = 0;
      const PAGE = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("reposicoes")
          .select("*")
          .order("created_at", { ascending: false })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        all.push(...(data || []));
        if ((data?.length || 0) < PAGE) break;
        from += PAGE;
      }
      return all as Reposicao[];
    },
  });

  const criar = useMutation({
    mutationFn: async (r: {
      produto_id: string;
      produto_nome: string;
      origem: string;
      destino: string;
      quantidade_sugerida: number;
      solicitado_por: string;
      observacao?: string | null;
    }) => {
      const { error } = await supabase.from("reposicoes").insert({
        produto_id: r.produto_id,
        produto_nome: r.produto_nome,
        origem: r.origem,
        destino: r.destino,
        quantidade_sugerida: r.quantidade_sugerida,
        solicitado_por: r.solicitado_por,
        observacao: r.observacao || null,
        status: "sugerida",
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const atualizar = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Reposicao> }) => {
      const { error } = await supabase.from("reposicoes").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("reposicoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    reposicoes,
    isLoading,
    criar: criar.mutateAsync,
    atualizar: atualizar.mutateAsync,
    remover: remover.mutateAsync,
  };
}

/** Upload photo to reposicoes-fotos bucket and return storage path. */
export async function uploadReposicaoFoto(file: File, reposicaoId: string, tipo: "saida" | "chegada"): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${reposicaoId}/${tipo}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("reposicoes-fotos").upload(path, file, { upsert: true });
  if (error) throw error;
  return path;
}

/** Generate a signed URL to view a photo. */
export async function getReposicaoFotoUrl(path: string): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage.from("reposicoes-fotos").createSignedUrl(path, 3600);
  if (error) return null;
  return data?.signedUrl || null;
}
