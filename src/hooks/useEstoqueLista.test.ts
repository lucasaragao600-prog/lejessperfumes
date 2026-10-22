import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { depositosDoFiltro, limparFiltros, rowToItemEstoque } from "./useEstoqueLista";

describe("depositosDoFiltro", () => {
  const depositos = ["Casa", "Sumaúma", "AMAZONAS SHOPPING"];
  it("Todos mantém todos os depósitos", () => {
    expect(depositosDoFiltro(depositos, "Todos")).toEqual(depositos);
  });
  it.each(depositos)("ao filtrar %s não apresenta saldos dos demais depósitos", (unidade) => {
    expect(depositosDoFiltro(depositos, unidade)).toEqual([unidade]);
  });
});

describe("limparFiltros", () => {
  it("remove vazios, 'Todos' e ordem padrão", () => {
    expect(
      limparFiltros({ busca: " vanilla ", unidade: "Todos", tipo: "", alertas: false, ordem: "none", custo_min: "10" })
    ).toEqual({ busca: "vanilla", custo_min: "10" });
  });
  it("mantém unidade, alertas e ordenação", () => {
    expect(limparFiltros({ unidade: "Casa", alertas: true, ordem: "desc" })).toEqual({ unidade: "Casa", alertas: true, ordem: "desc" });
  });
});

describe("rowToItemEstoque", () => {
  it("preenche lojas sem saldo com zero", () => {
    const it = rowToItemEstoque(
      { id: "1", nome: "X", custo: "10", preco_venda: "20", estoques: { Casa: 2 }, testers: { Casa: 1 }, qtd: 2, tester_qtd: 1 },
      ["Casa", "Sumaúma"]
    );
    expect(it.estoques).toEqual({ Casa: 2, Sumaúma: 0 });
    expect(it.qtd).toBe(2);
    expect(it.testers.Casa).toBe(1);
  });
});
