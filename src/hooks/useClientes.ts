import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Cliente {
  id: string;
  nome: string;
  cpfCnpj: string;
  telefone: string;
  email: string;
  dataNascimento: string | null;
  nomeSocial: string;
  genero: string;
  whatsapp: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  observacoes: string;
}

function rowToCliente(row: any): Cliente {
  return {
    id: row.id,
    nome: row.nome,
    cpfCnpj: row.cpf_cnpj || "",
    telefone: row.telefone || "",
    email: row.email || "",
    dataNascimento: row.data_nascimento,
    nomeSocial: row.nome_social || "",
    genero: row.genero || "",
    whatsapp: row.whatsapp || "",
    cep: row.cep || "",
    logradouro: row.logradouro || "",
    numero: row.numero || "",
    complemento: row.complemento || "",
    bairro: row.bairro || "",
    cidade: row.cidade || "",
    uf: row.uf || "",
    observacoes: row.observacoes || "",
  };
}

export function useClientes() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["clientes"] });

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .order("nome");
      if (error) throw error;
      return (data || []).map(rowToCliente);
    },
  });

  const adicionarCliente = useMutation({
    mutationFn: async (c: Omit<Cliente, "id">) => {
      const { data, error } = await supabase
        .from("clientes")
        .insert({
          nome: c.nome,
          cpf_cnpj: c.cpfCnpj,
          telefone: c.telefone,
          email: c.email,
          data_nascimento: c.dataNascimento || null,
          nome_social: c.nomeSocial || null,
          genero: c.genero || null,
          whatsapp: c.whatsapp || null,
          cep: c.cep || null,
          logradouro: c.logradouro || null,
          numero: c.numero || null,
          complemento: c.complemento || null,
          bairro: c.bairro || null,
          cidade: c.cidade || null,
          uf: c.uf || null,
          observacoes: c.observacoes || null,
        })
        .select()
        .single();
      if (error) throw error;
      return rowToCliente(data);
    },
    onSuccess: invalidate,
  });

  return {
    clientes,
    isLoading,
    adicionarCliente: adicionarCliente.mutateAsync,
  };
}
