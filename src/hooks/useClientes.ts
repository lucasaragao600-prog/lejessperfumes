import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Cliente {
  id: string;
  nome: string;
  cpfCnpj: string;
  telefone: string;
  email: string;
  dataNascimento: string | null;
}

function rowToCliente(row: any): Cliente {
  return {
    id: row.id,
    nome: row.nome,
    cpfCnpj: row.cpf_cnpj || "",
    telefone: row.telefone || "",
    email: row.email || "",
    dataNascimento: row.data_nascimento,
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
