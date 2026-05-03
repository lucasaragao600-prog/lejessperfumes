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
    estoque_casa: p.estoques.Casa,
    estoque_sumauma: p.estoques["Sumaúma"],
    estoque_amazonas: p.estoques.Amazonas,
    estoque_minimo: p.estoqueMinimo,
    classificacao: (p as any).classificacao || "Compartilhável",
  };
}

const depositoColumn: Record<Deposito, string> = {
  Casa: "estoque_casa",
  Sumaúma: "estoque_sumauma",
  Amazonas: "estoque_amazonas",
};

export function usePerfumes() {
  const queryClient = useQueryClient();

  const { data: perfumes = [], isLoading } = useQuery({
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

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["perfumes"] });

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
      const { error } = await supabase.from("perfumes").insert(perfumeToRow(p));
      if (error) throw error;
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

  const atualizarEstoque = useMutation({
    mutationFn: async ({
      perfumeId,
      deposito,
      novaQuantidade,
    }: {
      perfumeId: string;
      deposito: Deposito;
      novaQuantidade: number;
    }) => {
      const col = depositoColumn[deposito];
      const { error } = await supabase
        .from("perfumes")
        .update({ [col]: novaQuantidade })
        .eq("id", perfumeId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  // Set stock to an exact value (for Ajuste)
  const ajustarEstoque = async (perfumeId: string, deposito: Deposito, novaQuantidade: number) => {
    await atualizarEstoque.mutateAsync({
      perfumeId,
      deposito,
      novaQuantidade: Math.max(0, novaQuantidade),
    });
  };

  // Helper functions matching AppContext API
  const baixarEstoque = async (perfumeId: string, deposito: Deposito, quantidade: number) => {
    const p = perfumes.find((x) => x.id === perfumeId);
    if (!p) return;
    const atual = p.estoques[deposito];
    await atualizarEstoque.mutateAsync({
      perfumeId,
      deposito,
      novaQuantidade: Math.max(0, atual - quantidade),
    });
  };

  const adicionarEstoque = async (perfumeId: string, deposito: Deposito, quantidade: number) => {
    const p = perfumes.find((x) => x.id === perfumeId);
    if (!p) return;
    await atualizarEstoque.mutateAsync({
      perfumeId,
      deposito,
      novaQuantidade: p.estoques[deposito] + quantidade,
    });
  };

  const transferirEstoque = async (
    perfumeId: string,
    origem: Deposito,
    destino: Deposito,
    quantidade: number
  ) => {
    const p = perfumes.find((x) => x.id === perfumeId);
    if (!p) return;
    const colOrigem = depositoColumn[origem];
    const colDestino = depositoColumn[destino];
    const { error } = await supabase
      .from("perfumes")
      .update({
        [colOrigem]: Math.max(0, p.estoques[origem] - quantidade),
        [colDestino]: p.estoques[destino] + quantidade,
      })
      .eq("id", perfumeId);
    if (error) throw error;
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
    adicionarEstoque,
    ajustarEstoque,
    transferirEstoque,
    proximaLinhaPorCasa,
    setPerfumes: () => {}, // no-op for backward compat
  };
}
