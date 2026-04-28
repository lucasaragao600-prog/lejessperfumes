import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface NotaFiscal {
  id: string;
  numero: string;
  fornecedor: string;
  cnpj: string;
  dataEmissao: string | null;
  status: "pendente" | "conciliada" | "cancelada";
  xmlUrl?: string;
  depositoDestino?: string;
  conciliadaEm?: string;
  conciliadaPor?: string;
  itens: NotaFiscalItem[];
}

export interface NotaFiscalItem {
  id: string;
  notaId: string;
  descricaoXml: string;
  codigoXml?: string;
  quantidade: number;
  valorUnitario: number;
  perfumeId?: string;
  statusCorrespondencia: "pendente" | "correspondido" | "ignorado";
  valorProdutoUnit: number;
  valorIcmsUnit: number;
  valorIpiUnit: number;
  valorFreteUnit: number;
  valorSeguroUnit: number;
  valorOutrosUnit: number;
  valorDescontoUnit: number;
}

function rowToNota(row: any): NotaFiscal {
  return {
    id: row.id,
    numero: row.numero,
    fornecedor: row.fornecedor,
    cnpj: row.cnpj,
    dataEmissao: row.data_emissao,
    status: row.status,
    xmlUrl: row.xml_url,
    depositoDestino: row.deposito_destino,
    conciliadaEm: row.conciliada_em,
    conciliadaPor: row.conciliada_por,
    itens: (row.notas_fiscais_itens || []).map((i: any) => ({
      id: i.id,
      notaId: i.nota_id,
      descricaoXml: i.descricao_xml,
      codigoXml: i.codigo_xml,
      quantidade: Number(i.quantidade),
      valorUnitario: Number(i.valor_unitario),
      perfumeId: i.perfume_id,
      statusCorrespondencia: i.status_correspondencia,
      valorProdutoUnit: Number(i.valor_produto_unit ?? 0),
      valorIcmsUnit: Number(i.valor_icms_unit ?? 0),
      valorIpiUnit: Number(i.valor_ipi_unit ?? 0),
      valorFreteUnit: Number(i.valor_frete_unit ?? 0),
      valorSeguroUnit: Number(i.valor_seguro_unit ?? 0),
      valorOutrosUnit: Number(i.valor_outros_unit ?? 0),
      valorDescontoUnit: Number(i.valor_desconto_unit ?? 0),
    })),
  };
}

export function useNotasFiscais() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["notas_fiscais"] });

  const { data: notas = [], isLoading } = useQuery({
    queryKey: ["notas_fiscais"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notas_fiscais")
        .select("*, notas_fiscais_itens(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map(rowToNota);
    },
  });

  const criarNota = useMutation({
    mutationFn: async (nota: {
      numero: string;
      fornecedor: string;
      cnpj: string;
      dataEmissao?: string;
      itens: {
        descricaoXml: string;
        codigoXml?: string;
        quantidade: number;
        valorUnitario: number;
        valorProdutoUnit?: number;
        valorIcmsUnit?: number;
        valorIpiUnit?: number;
        valorFreteUnit?: number;
        valorSeguroUnit?: number;
        valorOutrosUnit?: number;
        valorDescontoUnit?: number;
      }[];
    }) => {
      const { data: notaData, error: notaErr } = await supabase
        .from("notas_fiscais")
        .insert({
          numero: nota.numero,
          fornecedor: nota.fornecedor,
          cnpj: nota.cnpj,
          data_emissao: nota.dataEmissao || null,
        })
        .select()
        .single();
      if (notaErr) throw notaErr;

      if (nota.itens.length > 0) {
        const { error: itensErr } = await supabase.from("notas_fiscais_itens").insert(
          nota.itens.map((i) => ({
            nota_id: notaData.id,
            descricao_xml: i.descricaoXml,
            codigo_xml: i.codigoXml || null,
            quantidade: i.quantidade,
            valor_unitario: i.valorUnitario,
            valor_produto_unit: i.valorProdutoUnit ?? 0,
            valor_icms_unit: i.valorIcmsUnit ?? 0,
            valor_ipi_unit: i.valorIpiUnit ?? 0,
            valor_frete_unit: i.valorFreteUnit ?? 0,
            valor_seguro_unit: i.valorSeguroUnit ?? 0,
            valor_outros_unit: i.valorOutrosUnit ?? 0,
            valor_desconto_unit: i.valorDescontoUnit ?? 0,
          }))
        );
        if (itensErr) throw itensErr;
      }
      return notaData.id;
    },
    onSuccess: invalidate,
  });

  const atualizarCorrespondencia = useMutation({
    mutationFn: async ({ itemId, perfumeId }: { itemId: string; perfumeId: string | null }) => {
      const { error } = await supabase
        .from("notas_fiscais_itens")
        .update({
          perfume_id: perfumeId,
          status_correspondencia: perfumeId ? "correspondido" : "pendente",
        })
        .eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const conciliarNota = useMutation({
    mutationFn: async ({ notaId, conciliadaPor }: { notaId: string; conciliadaPor: string }) => {
      const { error } = await supabase
        .from("notas_fiscais")
        .update({
          status: "conciliada",
          conciliada_em: new Date().toISOString(),
          conciliada_por: conciliadaPor,
        })
        .eq("id", notaId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const cancelarNota = useMutation({
    mutationFn: async (notaId: string) => {
      const { error } = await supabase
        .from("notas_fiscais")
        .update({ status: "cancelada" })
        .eq("id", notaId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    notas,
    isLoading,
    criarNota: criarNota.mutateAsync,
    atualizarCorrespondencia: atualizarCorrespondencia.mutateAsync,
    conciliarNota: conciliarNota.mutateAsync,
    cancelarNota: cancelarNota.mutateAsync,
  };
}
