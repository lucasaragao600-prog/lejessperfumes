import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type StatusUnidade =
  | "EM_IMPLANTACAO"
  | "EM_CONFIGURACAO"
  | "EM_TESTE"
  | "OPERACIONAL"
  | "INATIVA";

export interface Unidade {
  id: string;
  codigo: string;
  codigoLegado: string | null;
  nome: string;
  nomeExibicao: string;
  tipo: string;
  status: StatusUnidade;
  permiteVenda: boolean;
  permiteEstoque: boolean;
  permiteTransferencia: boolean;
  ordem: number;
  motivoInativacao: string;
  cnpj: string;
  telefone: string;
  cidade: string;
  uf: string;
}

/** Chave de texto usada nas tabelas operacionais (vendas.deposito, etc.) */
export function chaveUnidade(u: Unidade): string {
  return u.codigoLegado || u.codigo;
}

export function rotuloUnidade(u: Unidade): string {
  if (u.status === "INATIVA") return `${u.nomeExibicao} — Unidade Inativa`;
  if (u.status === "EM_TESTE") return `${u.nomeExibicao} (em teste)`;
  if (u.status === "EM_IMPLANTACAO" || u.status === "EM_CONFIGURACAO")
    return `${u.nomeExibicao} (em implantação)`;
  return u.nomeExibicao;
}

function rowToUnidade(row: any): Unidade {
  return {
    id: row.id,
    codigo: row.codigo,
    codigoLegado: row.codigo_legado,
    nome: row.nome,
    nomeExibicao: row.nome_exibicao || row.nome,
    tipo: row.tipo,
    status: row.status as StatusUnidade,
    permiteVenda: !!row.permite_venda,
    permiteEstoque: !!row.permite_estoque,
    permiteTransferencia: !!row.permite_transferencia,
    ordem: row.ordem ?? 0,
    motivoInativacao: row.motivo_inativacao || "",
    cnpj: row.cnpj || "",
    telefone: row.telefone || "",
    cidade: row.cidade || "",
    uf: row.uf || "",
  };
}

export interface UseUnidadesOptions {
  /** "operacional" = apenas unidades que podem operar hoje. "historico" = todas, inclusive INATIVA. */
  contexto?: "operacional" | "historico";
}

export function useUnidades(options: UseUnidadesOptions = {}) {
  const contexto = options.contexto ?? "operacional";

  const { data: todas = [], isLoading } = useQuery({
    queryKey: ["unidades"],
    queryFn: async () => {
      const { data, error } = await supabase.from("unidades").select("*").order("ordem");
      if (error) throw error;
      return (data || []).map(rowToUnidade);
    },
    staleTime: 5 * 60 * 1000,
  });

  const unidades = useMemo(
    () => (contexto === "historico" ? todas : todas.filter((u) => u.status !== "INATIVA")),
    [todas, contexto]
  );

  const nomes = useMemo(() => unidades.map(chaveUnidade), [unidades]);
  const todosNomes = useMemo(() => todas.map(chaveUnidade), [todas]);

  const byChave = useMemo(() => {
    const m = new Map<string, Unidade>();
    for (const u of todas) {
      m.set(chaveUnidade(u), u);
      m.set(u.codigo, u);
      m.set(u.nome, u);
    }
    return m;
  }, [todas]);

  const get = (chave?: string | null) => (chave ? byChave.get(chave) : undefined);

  return {
    unidades,
    todas,
    nomes,
    todosNomes,
    isLoading,
    get,
    rotulo: (chave: string) => {
      const u = get(chave);
      return u ? rotuloUnidade(u) : chave;
    },
    unidadesVenda: useMemo(
      () => unidades.filter((u) => u.permiteVenda && (u.status === "OPERACIONAL" || u.status === "EM_TESTE")),
      [unidades]
    ),
    unidadesEstoque: useMemo(() => unidades.filter((u) => u.permiteEstoque), [unidades]),
    unidadesTransferencia: useMemo(
      () => unidades.filter((u) => u.permiteTransferencia),
      [unidades]
    ),
    podeVender: (chave?: string | null) => {
      const u = get(chave);
      return !!u && u.permiteVenda && (u.status === "OPERACIONAL" || u.status === "EM_TESTE");
    },
    podeEstoque: (chave?: string | null) => {
      const u = get(chave);
      return !!u && u.permiteEstoque && u.status !== "INATIVA";
    },
    podeTransferir: (chave?: string | null) => {
      const u = get(chave);
      return !!u && u.permiteTransferencia && u.status !== "INATIVA";
    },
    emTeste: (chave?: string | null) => get(chave)?.status === "EM_TESTE",
  };
}

/** Lista de nomes de unidades para telas operacionais (sem INATIVA). */
export function useNomesUnidades(contexto: "operacional" | "historico" = "operacional") {
  const { nomes } = useUnidades({ contexto });
  return nomes;
}
