import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const CAMPOS_FISCAIS = [
  { k: "ncm", l: "NCM", g: "basico" }, { k: "cest", l: "CEST", g: "basico" }, { k: "origem", l: "Origem (0–8)", g: "basico" },
  { k: "unidade_comercial", l: "Unidade comercial", g: "basico" }, { k: "unidade_tributavel", l: "Unidade tributável", g: "basico" },
  { k: "cfop", l: "CFOP", g: "basico" }, { k: "csosn", l: "CSOSN (Simples)", g: "basico" },
  { k: "cst_icms", l: "CST ICMS (regime normal)", g: "icms" }, { k: "aliq_icms", l: "Alíquota ICMS %", g: "icms", n: true },
  { k: "red_bc_icms", l: "Redução de base %", g: "icms", n: true }, { k: "mod_bc_icms", l: "Modalidade da base", g: "icms" },
  { k: "mva_st", l: "MVA ST %", g: "icms", n: true }, { k: "aliq_icms_st", l: "Alíquota ICMS ST %", g: "icms", n: true },
  { k: "cbenef", l: "Benefício fiscal (cBenef)", g: "icms" },
  { k: "cst_pis", l: "CST PIS", g: "pis" }, { k: "aliq_pis", l: "Alíquota PIS %", g: "pis", n: true },
  { k: "cst_cofins", l: "CST COFINS", g: "pis" }, { k: "aliq_cofins", l: "Alíquota COFINS %", g: "pis", n: true },
  { k: "cst_ipi", l: "CST IPI", g: "ipi" }, { k: "aliq_ipi", l: "Alíquota IPI %", g: "ipi", n: true }, { k: "enq_ipi", l: "Enquadramento IPI", g: "ipi" },
  { k: "cst_ibscbs", l: "CST IBS/CBS", g: "reforma" }, { k: "cclass_trib", l: "Classificação tributária", g: "reforma" },
  { k: "aliq_ibs_uf", l: "IBS estadual %", g: "reforma", n: true }, { k: "aliq_ibs_mun", l: "IBS municipal %", g: "reforma", n: true },
  { k: "aliq_cbs", l: "CBS %", g: "reforma", n: true }, { k: "aliq_is", l: "Imposto Seletivo %", g: "reforma", n: true },
] as const;
export type CampoFiscal = (typeof CAMPOS_FISCAIS)[number]["k"];
export const GRUPOS_FISCAIS: Record<string, string> = { basico: "Básico", icms: "ICMS avançado", pis: "PIS e COFINS", ipi: "IPI", reforma: "Reforma tributária (IBS, CBS, IS)" };

export type StatusFiscal = "completo" | "incompleto" | "erro" | "nao_emite";
export const STATUS_FISCAL: Record<StatusFiscal, { label: string; className: string }> = {
  completo: { label: "Completo", className: "border-emerald-500/40 text-emerald-500 bg-emerald-500/10" },
  incompleto: { label: "Incompleto", className: "border-amber-500/40 text-amber-500 bg-amber-500/10" },
  erro: { label: "Com erro", className: "border-destructive/40 text-destructive bg-destructive/10" },
  nao_emite: { label: "Não emite nota", className: "border-border text-muted-foreground" },
};

export interface PerfilTributario { id: string; nome: string; descricao: string; arquivado: boolean; categoria_padrao: string | null; [k: string]: unknown }
export interface ProdutoFiscalLinha {
  id: string; codigo: string; nome: string; marca: string; tipo: string; concentracao: string; volume: number;
  fiscal: Record<string, unknown> & { perfil_id?: string; perfil_nome?: string; vinculo?: string; emite_nota?: boolean; sobrescritos?: string[] };
  status: { status: StatusFiscal; erros: string[]; faltam: string[] };
}
export interface FiltrosFiscal { busca: string; status: string; perfil: string; tipo: string }

const rpc = async <T,>(fn: string, args: Record<string, unknown>) => {
  const { data, error } = await supabase.rpc(fn as never, args as never);
  if (error) throw error;
  return data as T;
};

export const listarProdutosFiscal = (f: FiltrosFiscal, limite: number, offset: number) =>
  rpc<{ total: number; resumo: Record<string, number> | null; itens: ProdutoFiscalLinha[]; ids: string[] | null }>("fn_produtos_fiscal_listar", {
    p_busca: f.busca, p_status: f.status, p_perfil: f.perfil || null, p_tipo: f.tipo, p_limite: limite, p_offset: offset,
  });

export function useProdutosFiscal(f: FiltrosFiscal, pagina: number) {
  return useQuery({ queryKey: ["produtos-fiscal", f, pagina], queryFn: () => listarProdutosFiscal(f, 30, pagina * 30) });
}

export function usePerfisTributarios() {
  return useQuery({
    queryKey: ["perfis-tributarios"],
    queryFn: async () => {
      const { data, error } = await supabase.from("perfil_tributario" as never).select("*").order("nome");
      if (error) throw error;
      return (data || []) as unknown as PerfilTributario[];
    },
  });
}

export function useHistoricoFiscal(pagina: number) {
  return useQuery({
    queryKey: ["historico-fiscal", pagina],
    queryFn: async () => {
      const { data, error, count } = await supabase.from("historico_fiscal" as never).select("*", { count: "exact" })
        .order("created_at", { ascending: false }).range(pagina * 30, pagina * 30 + 29);
      if (error) throw error;
      return { itens: (data || []) as unknown as Array<{ id: string; entidade: string; entidade_id: string; acao: string; antes: Record<string, unknown> | null; depois: Record<string, unknown> | null; usuario_nome: string; created_at: string }>, total: count ?? 0 };
    },
  });
}

export function useFiscalMutations() {
  const qc = useQueryClient();
  const inv = () => { qc.invalidateQueries({ queryKey: ["produtos-fiscal"] }); qc.invalidateQueries({ queryKey: ["perfis-tributarios"] }); qc.invalidateQueries({ queryKey: ["historico-fiscal"] }); };
  const salvarPerfil = useMutation({ mutationFn: (p: { id: string | null; dados: Record<string, unknown> }) => rpc<string>("fn_perfil_tributario_salvar", { p_id: p.id, p_dados: p.dados }), onSuccess: inv });
  const aplicar = useMutation({
    mutationFn: (p: { perfil: string; produtos: string[]; modo: "sobrescrever" | "vazios"; vinculo: "herdar" | "copiar"; previa: boolean }) =>
      rpc<{ total: number; alterados: number; amostra: Array<{ perfume_id: string; campos: Record<string, { de: unknown; para: unknown }> }> }>("fn_perfil_aplicar", {
        p_perfil: p.perfil, p_produtos: p.produtos, p_modo: p.modo, p_vinculo: p.vinculo, p_previa: p.previa,
      }),
    onSuccess: (_d, v) => { if (!v.previa) inv(); },
  });
  const salvarProduto = useMutation({ mutationFn: (p: { id: string; dados: Record<string, unknown> }) => rpc<unknown>("fn_produto_fiscal_salvar", { p_perfume_id: p.id, p_dados: p.dados }), onSuccess: inv });
  return { salvarPerfil, aplicar, salvarProduto };
}
