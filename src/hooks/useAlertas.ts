import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AlertaEstoque {
  id: string;
  produtoId: string;
  produtoNome?: string;
  loja: string;
  tipo: "ZEROU" | "BAIXO";
  status: "PENDENTE" | "ENVIADO" | "LIDO" | "RESOLVIDO";
  criadoEm: string;
  resolvidoEm?: string;
}

function rowToAlerta(row: any): AlertaEstoque {
  return {
    id: row.id,
    produtoId: row.produto_id,
    produtoNome: row.perfumes?.nome || "",
    loja: row.loja,
    tipo: row.tipo,
    status: row.status,
    criadoEm: row.criado_em,
    resolvidoEm: row.resolvido_em,
  };
}

export function useAlertas() {
  const queryClient = useQueryClient();

  const { data: alertas = [], isLoading } = useQuery({
    queryKey: ["alertas_estoque"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alertas_estoque")
        .select("*, perfumes(nome)")
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return (data || []).map(rowToAlerta);
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["alertas_estoque"] });

  const pendentes = alertas.filter((a) => a.status === "PENDENTE");

  const resolverAlerta = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("alertas_estoque")
        .update({ status: "RESOLVIDO", resolvido_em: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const criarAlerta = useMutation({
    mutationFn: async (alerta: { produtoId: string; loja: string; tipo: "ZEROU" | "BAIXO" }) => {
      // Check if there's already a pending alert for this product+loja+tipo
      const { data: existing } = await supabase
        .from("alertas_estoque")
        .select("id")
        .eq("produto_id", alerta.produtoId)
        .eq("loja", alerta.loja)
        .eq("tipo", alerta.tipo)
        .eq("status", "PENDENTE")
        .limit(1);

      if (existing && existing.length > 0) return; // Already has pending alert

      const { error } = await supabase.from("alertas_estoque").insert({
        produto_id: alerta.produtoId,
        loja: alerta.loja,
        tipo: alerta.tipo,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  // Check stock levels and create alerts if needed
  const verificarEstoque = async (
    perfumeId: string,
    perfumeNome: string,
    deposito: string,
    quantidadeAnterior: number,
    quantidadeNova: number,
    estoqueMinimo: number
  ) => {
    // Zerou: was > 0, now = 0
    if (quantidadeAnterior > 0 && quantidadeNova === 0) {
      await criarAlerta.mutateAsync({ produtoId: perfumeId, loja: deposito, tipo: "ZEROU" });
    }
    // Baixo: crossed minimum threshold
    if (quantidadeAnterior > estoqueMinimo && quantidadeNova <= estoqueMinimo && quantidadeNova > 0) {
      await criarAlerta.mutateAsync({ produtoId: perfumeId, loja: deposito, tipo: "BAIXO" });
    }
  };

  return {
    alertas,
    pendentes,
    isLoading,
    resolverAlerta: resolverAlerta.mutateAsync,
    verificarEstoque,
  };
}
