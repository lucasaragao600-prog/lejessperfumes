import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BalancoLeitura {
  id: string;
  balanco_id: string;
  perfume_id: string | null;
  codigo_lido: string;
  encontrado: boolean;
  origem: "gtin" | "sku" | "manual" | "lote";
  quantidade: number;
  contagem: number;
  usuario: string;
  criado_em: string;
}

export async function registrarLeitura(input: Omit<BalancoLeitura, "id" | "criado_em">) {
  await supabase.from("balanco_leituras").insert(input);
}

export function useBalancoLeituras(balancoId: string | null) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!balancoId) return;
    const channel = supabase
      .channel(`balanco-leituras-${balancoId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "balanco_leituras", filter: `balanco_id=eq.${balancoId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["balanco-leituras", balancoId] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [balancoId, qc]);

  return useQuery({
    queryKey: ["balanco-leituras", balancoId],
    enabled: !!balancoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("balanco_leituras")
        .select("*")
        .eq("balanco_id", balancoId!)
        .order("criado_em", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as BalancoLeitura[];
    },
  });
}
