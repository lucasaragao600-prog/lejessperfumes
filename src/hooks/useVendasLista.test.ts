import { describe, it, expect } from "vitest";
import { limparFiltrosVendas, agruparVendas } from "./useVendasLista";

describe("vendas lista", () => {
  it("remove filtros vazios e padrões", () => {
    expect(limparFiltrosVendas({ deposito: "Todos", vendedora: "Todas", busca: "  ", ordem: "recente", data_ini: "2026-09-01" }))
      .toEqual({ data_ini: "2026-09-01" });
  });
  it("agrupa por grupo de venda mantendo a ordem", () => {
    const g = agruparVendas([{ id: "1", grupoVenda: "a" }, { id: "2", grupoVenda: "b" }, { id: "3", grupoVenda: "a" }] as any);
    expect(g.map((x) => [x.grupoVenda, x.itens.length])).toEqual([["a", 2], ["b", 1]]);
  });
});
