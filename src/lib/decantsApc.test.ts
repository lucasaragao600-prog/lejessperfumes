import { describe, it, expect } from "vitest";
import { validarDivisao, tamanhosVendaveis } from "./decantsApc";

describe("dividir frasco", () => {
  it("100 ml → 80 decants + 20 APC é válido", () => {
    expect(validarDivisao({ disponivel: 100, mlDecants: 80, mlApc: 20, precoApc: 300, precos: [] })).toEqual([]);
  });
  it("frasco com 90 ml não aceita 80 + 20", () => {
    expect(validarDivisao({ disponivel: 90, mlDecants: 80, mlApc: 20, precoApc: 300, precos: [] }).length).toBe(1);
  });
  it("APC sem preço é rejeitado", () => {
    expect(validarDivisao({ disponivel: 100, mlDecants: 80, mlApc: 20, precoApc: null, precos: [] })).toContain("Informe o preço total do APC.");
  });
  it("volume negativo é rejeitado", () => {
    expect(validarDivisao({ disponivel: 100, mlDecants: -1, mlApc: 0, precoApc: null, precos: [] }).length).toBe(1);
  });
  it("saldo de 7 ml vende só 5 ml", () => {
    expect(tamanhosVendaveis(7)).toEqual([5]);
  });
});

describe("venda do frasco", () => {
  it("5, 8 e 10 ml a partir de 80 ml deixam 57 ml", () => {
    expect(80 - (5 + 8 + 10)).toBe(57);
  });
  it("6×5 + 5×8 + 1×10 consome exatamente 80 ml", () => {
    expect(6 * 5 + 5 * 8 + 1 * 10).toBe(80);
    expect(tamanhosVendaveis(0)).toEqual([]);
  });
});

import { resumoFicha } from "./decantsApc";
describe("resumoFicha", () => {
  it("ordena tamanhos e calcula resultado com custo", () => {
    const r = resumoFicha({ vendas_sob_demanda: { "10": { qtd: 1, receita: 50 }, "5": { qtd: 2, receita: 60 } }, receita_total: 410, custo_frasco: 300, custo_rateio_decants: 200, custo_rateio_apc: 100 });
    expect(r.tamanhos.map((t) => t.ml)).toEqual([5, 10]);
    expect(r.resultado).toBe(110);
  });
  it("sem permissão de custo não calcula resultado", () => {
    expect(resumoFicha({ receita_total: 100 }).resultado).toBeNull();
  });
});
