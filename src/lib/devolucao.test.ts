import { describe, it, expect } from "vitest";
import { valorUnitarioLiquido, saldoDevolvivel, validarQuantidadeDevolucao, foraDoPrazo, diasEntre, diferencaTroca, vendasLiquidas } from "./devolucao";

describe("devolução", () => {
  it("valor unitário líquido considera desconto", () => {
    expect(valorUnitarioLiquido(199.98, 2)).toBe(99.99);
    expect(valorUnitarioLiquido(100, 3)).toBe(33.33);
    expect(valorUnitarioLiquido(10, 0)).toBe(0);
  });
  it("saldo devolvível desconta devoluções anteriores", () => {
    expect(saldoDevolvivel(3, 1)).toBe(2);
    expect(saldoDevolvivel(2, 5)).toBe(0);
  });
  it("bloqueia devolução acima do vendido e duplicada", () => {
    expect(validarQuantidadeDevolucao(1, 2, 0)).toBeNull();
    expect(validarQuantidadeDevolucao(3, 2, 0)).toMatch(/maior/);
    expect(validarQuantidadeDevolucao(1, 1, 1)).toMatch(/maior/);
    expect(validarQuantidadeDevolucao(0, 2, 0)).toMatch(/inválida/);
  });
  it("prazo em dias", () => {
    expect(diasEntre("2026-09-01", "2026-10-01")).toBe(30);
    expect(foraDoPrazo("2026-09-01", "2026-10-01", 30)).toBe(false);
    expect(foraDoPrazo("2026-09-01", "2026-10-02", 30)).toBe(true);
  });
  it("troca com diferença a pagar e a receber", () => {
    expect(diferencaTroca(100, 150)).toEqual({ diferenca: 50, aPagar: 50, aReceber: 0 });
    expect(diferencaTroca(150, 100.5)).toEqual({ diferenca: -49.5, aPagar: 0, aReceber: 49.5 });
    expect(diferencaTroca(100, 100).diferenca).toBe(0);
  });
  it("vendas líquidas", () => {
    expect(vendasLiquidas(1000, 250.25)).toBe(749.75);
  });
});
