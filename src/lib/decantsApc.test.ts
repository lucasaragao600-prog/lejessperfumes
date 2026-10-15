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
