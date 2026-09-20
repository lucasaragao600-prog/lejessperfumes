import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Perfume, Deposito } from "@/data/mockData";

// Map DB row to app Perfume type
function rowToPerfume(row: any): Perfume {
  return {
    id: row.id,
    codigo: row.codigo,
    codigoBarras: row.codigo_barras || "",
    nome: row.nome,
    marca: row.marca,
    casaSigla: row.casa_sigla,
    tipo: row.tipo,
    concentracao: row.concentracao,
    tamanho: row.tamanho,
    volume: row.volume,
    custo: Number(row.custo),
    precoVenda: Number(row.preco_venda),
    estoques: {
      Casa: row.estoque_casa,
      Sumaúma: row.estoque_sumauma,
      Amazonas: row.estoque_amazonas,
    },
    estoqueMinimo: row.estoque_minimo,
    imageUrl: row.image_url || "",
    custoMedio: Number(row.custo_medio) || 0,
    ultimoCustoEm: row.ultimo_custo_em || "",
    ncm: row.ncm || "",
    cfop: row.cfop || "",
    cstCsosn: row.cst_csosn || "",
    unidadeFiscal: row.unidade_fiscal || "UN",
    classificacao: (row.classificacao || "Compartilhável") as any,
    perfilOlfativo: row.perfil_olfativo || "",
    notasSaida: row.notas_saida || "",
    notasCoracao: row.notas_coracao || "",
    notasFundo: row.notas_fundo || "",
  };
}

function perfumeToRow(p: Perfume) {
  return {
    codigo: p.codigo,
    codigo_barras: p.codigoBarras || "",
    nome: p.nome,
    marca: p.marca,
    casa_sigla: p.casaSigla,
    tipo: p.tipo,
    concentracao: p.concentracao,
    tamanho: p.tamanho,
    volume: p.volume,
    custo: p.custo,
    preco_venda: p.precoVenda,
    estoque_casa: p.estoques?.["Casa"] ?? 0,
    estoque_sumauma: p.estoques?.["Sumaúma"] ?? 0,
    estoque_amazonas: p.estoques?.["Amazonas"] ?? 0,
    estoque_minimo: p.estoqueMinimo,
    classificacao: (p as any).classificacao || "Compartilhável",
    perfil_olfativo: p.perfilOlfativo || "",
    notas_saida: p.notasSaida || "",
    notas_coracao: p.notasCoracao || "",
    notas_fundo: p.notasFundo || "",
  };
}

export function usePerfumes() {
  const queryClient = useQueryClient();

  const { data: perfumesBase = [], isLoading } = useQuery({
    queryKey: ["perfumes"],
    queryFn: async () => {
      const PAGE_SIZE = 1000;
      let from = 0;
      const all: any[] = [];
      // Recursive pagination to bypass Supabase's 1000 row default limit
      while (true) {
        const { data, error } = await supabase
          .from("perfumes")
          .select("*")
          .order("nome")
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      return all.map(rowToPerfume);
    },
  });

  // Saldos por unidade (fonte de verdade: estoque_unidades)
  const { data: estoquePorProduto } = useQuery({
    queryKey: ["estoque_unidades"],
    queryFn: async () => {
      const { data: unidades, error: uErr } = await supabase
        .from("unidades")
        .select("id, codigo, codigo_legado")
        .order("ordem");
      if (uErr) throw uErr;
      const chavePorId = new Map<string, string>(
        (unidades || []).map((u: any) => [u.id, u.codigo_legado || u.codigo])
      );

      const PAGE_SIZE = 1000;
      let from = 0;
      const mapa = new Map<string, Record<string, number>>();
      while (true) {
        const { data, error } = await supabase
          .from("estoque_unidades")
          .select("produto_id, unidade_id, quantidade")
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        for (const row of data as any[]) {
          const chave = chavePorId.get(row.unidade_id);
          if (!chave) continue;
          const atual = mapa.get(row.produto_id) || {};
          atual[chave] = row.quantidade ?? 0;
          mapa.set(row.produto_id, atual);
        }
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      // garante que toda unidade apareça com 0 quando não há linha
      return { mapa, chaves: Array.from(chavePorId.values()) };
    },
    staleTime: 30 * 1000,
  });

  const perfumes = useMemo(() => {
    if (!estoquePorProduto) return perfumesBase;
    const { mapa, chaves } = estoquePorProduto;
    return perfumesBase.map((p) => {
      const porUnidade = mapa.get(p.id) || {};
      const estoques: Record<string, number> = {};
      for (const c of chaves) estoques[c] = porUnidade[c] ?? 0;
      return { ...p, estoques };
    });
  }, [perfumesBase, estoquePorProduto]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["perfumes"] });
    queryClient.invalidateQueries({ queryKey: ["estoque_unidades"] });
  };

  const atualizarPrecos = useMutation({
    mutationFn: async ({
      perfumeId,
      custo,
      precoVenda,
    }: {
      perfumeId: string;
      custo: number;
      precoVenda: number;
    }) => {
      const { error } = await supabase
        .from("perfumes")
        .update({ custo, preco_venda: precoVenda })
        .eq("id", perfumeId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const editarPerfume = useMutation({
    mutationFn: async (p: Partial<Perfume> & { id: string }) => {
      const updateData: Record<string, any> = {};
      if (p.nome !== undefined) updateData.nome = p.nome;
      if (p.marca !== undefined) updateData.marca = p.marca;
      if (p.casaSigla !== undefined) updateData.casa_sigla = p.casaSigla;
      if (p.tipo !== undefined) updateData.tipo = p.tipo;
      if (p.concentracao !== undefined) updateData.concentracao = p.concentracao;
      if (p.tamanho !== undefined) updateData.tamanho = p.tamanho;
      if (p.volume !== undefined) updateData.volume = p.volume;
      if (p.custo !== undefined) updateData.custo = p.custo;
      if (p.precoVenda !== undefined) updateData.preco_venda = p.precoVenda;
      if (p.estoqueMinimo !== undefined) updateData.estoque_minimo = p.estoqueMinimo;
      if (p.codigo !== undefined) updateData.codigo = p.codigo;
      if (p.imageUrl !== undefined) updateData.image_url = p.imageUrl;
      if (p.ncm !== undefined) updateData.ncm = p.ncm;
      if (p.cfop !== undefined) updateData.cfop = p.cfop;
      if (p.cstCsosn !== undefined) updateData.cst_csosn = p.cstCsosn;
      if (p.unidadeFiscal !== undefined) updateData.unidade_fiscal = p.unidadeFiscal;
      if (p.codigoBarras !== undefined) updateData.codigo_barras = p.codigoBarras;
      if ((p as any).classificacao !== undefined) updateData.classificacao = (p as any).classificacao;
      if (p.perfilOlfativo !== undefined) updateData.perfil_olfativo = p.perfilOlfativo;
      if (p.notasSaida !== undefined) updateData.notas_saida = p.notasSaida;
      if (p.notasCoracao !== undefined) updateData.notas_coracao = p.notasCoracao;
      if (p.notasFundo !== undefined) updateData.notas_fundo = p.notasFundo;
      const { error } = await supabase
        .from("perfumes")
        .update(updateData)
        .eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const adicionarPerfume = useMutation({
    mutationFn: async (p: Perfume) => {
      const { data, error } = await supabase
        .from("perfumes")
        .insert(perfumeToRow(p))
        .select("id")
        .single();
      if (error) throw error;
      // estoque inicial por unidade (via RPC transacional)
      for (const [unidade, qtd] of Object.entries(p.estoques || {})) {
        if (!qtd || qtd <= 0) continue;
        const { error: rpcErr } = await supabase.rpc("fn_ajustar_saldo", {
          p_produto_id: data.id,
          p_unidade: unidade,
          p_quantidade: qtd,
          p_modo: "set",
        });
        if (rpcErr) throw rpcErr;
      }
    },
    onSuccess: invalidate,
  });

  const excluirPerfume = useMutation({
    mutationFn: async (perfumeId: string) => {
      const { error } = await supabase.from("perfumes").delete().eq("id", perfumeId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const ajustarSaldoRpc = async (
    perfumeId: string,
    deposito: Deposito,
    quantidade: number,
    modo: "set" | "delta"
  ) => {
    const { error } = await supabase.rpc("fn_ajustar_saldo", {
      p_produto_id: perfumeId,
      p_unidade: deposito,
      p_quantidade: quantidade,
      p_modo: modo,
    });
    if (error) throw new Error(error.message);
    invalidate();
  };

  // Define o saldo exato (Ajuste)
  const ajustarEstoque = async (perfumeId: string, deposito: Deposito, novaQuantidade: number) => {
    await ajustarSaldoRpc(perfumeId, deposito, Math.max(0, novaQuantidade), "set");
  };

  const baixarEstoque = async (perfumeId: string, deposito: Deposito, quantidade: number) => {
    await ajustarSaldoRpc(perfumeId, deposito, -Math.abs(quantidade), "delta");
  };

  const adicionarEstoque = async (perfumeId: string, deposito: Deposito, quantidade: number) => {
    await ajustarSaldoRpc(perfumeId, deposito, Math.abs(quantidade), "delta");
  };

  /** Baixa de venda: atômica e protegida contra concorrência (UPDATE condicional na RPC). */
  const baixarVenda = async (
    perfumeId: string,
    deposito: Deposito,
    quantidade: number,
    isTeste = false
  ) => {
    const { error } = await supabase.rpc("fn_baixar_venda", {
      p_produto_id: perfumeId,
      p_unidade: deposito,
      p_quantidade: Math.abs(quantidade),
      p_is_teste: isTeste,
    });
    if (error) throw new Error(error.message);
    invalidate();
  };

  const transferirEstoque = async (
    perfumeId: string,
    origem: Deposito,
    destino: Deposito,
    quantidade: number
  ) => {
    const { error } = await supabase.rpc("fn_transferir", {
      p_produto_id: perfumeId,
      p_origem: origem,
      p_destino: destino,
      p_quantidade: Math.abs(quantidade),
    });
    if (error) throw new Error(error.message);
    invalidate();
  };

  const proximaLinhaPorCasa = (casaSigla: string): number => {
    const siglaLimpa = casaSigla.replace(/[^A-Z0-9]/gi, "").toUpperCase();
    const sigla = (/^[0-9]+$/.test(siglaLimpa) ? siglaLimpa.padStart(3, "0") : siglaLimpa.padEnd(3, "X")).slice(0, 3);
    let maxLinha = 0;
    for (const p of perfumes) {
      if (p.casaSigla !== casaSigla) continue;
      // Extract LLLL (positions 7-10) from code format TTMMMCCLLLLVVV
      const codigo = p.codigo || "";
      if (codigo.length >= 11) {
        const linhaStr = codigo.slice(7, 11);
        const linha = parseInt(linhaStr, 10);
        if (!isNaN(linha) && linha > maxLinha) {
          maxLinha = linha;
        }
      }
    }
    return maxLinha + 1;
  };

  return {
    perfumes,
    isLoading,
    adicionarPerfume: adicionarPerfume.mutateAsync,
    editarPerfume: editarPerfume.mutateAsync,
    excluirPerfume: excluirPerfume.mutateAsync,
    atualizarPrecos: atualizarPrecos.mutateAsync,
    baixarEstoque,
    baixarVenda,
    adicionarEstoque,
    ajustarEstoque,
    transferirEstoque,
    proximaLinhaPorCasa,
    setPerfumes: () => {}, // no-op for backward compat
  };
}
