import { supabase } from "@/integrations/supabase/client";

export const CATEGORIAS_AJUSTE = [
  "Contagem física / inventário",
  "Produto avariado / quebrado",
  "Perda ou extravio",
  "Furto",
  "Correção de lançamento errado",
  "Devolução ao fornecedor",
  "Uso interno / brinde",
  "Outro",
] as const;

const GENERICOS = ["ajuste", "acerto", "correção", "correcao", "teste", "ok"];

/** Mesma regra do banco: categoria + texto com 10 caracteres úteis, sem motivo genérico. */
export function erroMotivoAjuste(categoria: string, motivo: string): string | null {
  if (!CATEGORIAS_AJUSTE.includes(categoria as any)) return "Escolha a categoria do motivo";
  const t = motivo.trim();
  if (t.replace(/\s/g, "").length < 10) return "Descreva o motivo com pelo menos 10 caracteres";
  if (GENERICOS.includes(t.toLowerCase()) || /^[\d\s\W]+$/.test(t)) return "Motivo genérico demais. Descreva o que aconteceu";
  return null;
}

export async function registrarAjusteEstoque(args: {
  produtoId: string; unidade: string; quantidadeNova: number;
  categoria: string; motivo: string; origem: "acoes_rapidas" | "movimentacoes";
}) {
  const { data, error } = await supabase.rpc("fn_ajuste_estoque", {
    p_produto_id: args.produtoId, p_unidade: args.unidade, p_quantidade_nova: args.quantidadeNova,
    p_motivo_categoria: args.categoria, p_motivo: args.motivo, p_origem: args.origem,
  });
  if (error) throw new Error(error.message);
  return data as { anterior: number; nova: number; diferenca: number; ajuste_id: string };
}
