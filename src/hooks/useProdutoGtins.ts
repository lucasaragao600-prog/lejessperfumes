import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProdutoGtin {
  id: string;
  produto_id: string;
  gtin: string;
  principal: boolean;
  criado_por: string;
  criado_em: string;
}

/** Resolve um código (GTIN ou SKU) → produto_id. Retorna { perfumeId, origem } */
export async function resolverCodigoProduto(codigo: string): Promise<
  { perfumeId: string; origem: "gtin" | "sku" } | null
> {
  const c = codigo.trim();
  if (!c) return null;

  // 1) GTIN
  const { data: g } = await supabase
    .from("produto_gtins")
    .select("produto_id")
    .eq("gtin", c)
    .maybeSingle();
  if (g?.produto_id) return { perfumeId: g.produto_id, origem: "gtin" };

  // 2) SKU (campo "codigo" do perfume)
  const { data: p } = await supabase
    .from("perfumes")
    .select("id")
    .eq("codigo", c)
    .maybeSingle();
  if (p?.id) return { perfumeId: p.id, origem: "sku" };

  return null;
}

export function useProdutoGtins(produtoId: string | null) {
  const qc = useQueryClient();

  const { data: gtins = [], isLoading } = useQuery({
    queryKey: ["produto-gtins", produtoId],
    enabled: !!produtoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produto_gtins")
        .select("*")
        .eq("produto_id", produtoId!)
        .order("principal", { ascending: false })
        .order("criado_em", { ascending: true });
      if (error) throw error;
      return (data || []) as ProdutoGtin[];
    },
  });

  const adicionar = useMutation({
    mutationFn: async (input: {
      produto_id: string;
      gtin: string;
      criado_por: string;
      principal?: boolean;
    }) => {
      const gtin = input.gtin.trim();
      if (!gtin) throw new Error("GTIN vazio");

      // Verificar duplicidade global
      const { data: existente } = await supabase
        .from("produto_gtins")
        .select("produto_id")
        .eq("gtin", gtin)
        .maybeSingle();
      if (existente && existente.produto_id !== input.produto_id) {
        throw new Error("Este GTIN já está vinculado a outro produto");
      }
      if (existente) return existente;

      const { data, error } = await supabase
        .from("produto_gtins")
        .insert({
          produto_id: input.produto_id,
          gtin,
          principal: input.principal ?? false,
          criado_por: input.criado_por,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["produto-gtins"] });
    },
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("produto_gtins").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["produto-gtins"] });
    },
  });

  return {
    gtins,
    isLoading,
    adicionarGtin: adicionar.mutateAsync,
    removerGtin: remover.mutateAsync,
  };
}
