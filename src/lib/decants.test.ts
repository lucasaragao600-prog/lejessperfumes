import { describe, it, expect } from "vitest";
import { custoPorMl, saldoMl, skuDecant, volumeSku } from "./decants";

describe("decants", () => {
  it("custo/ml 100 ml por R$ 600 = 6,00", () => {
    expect(custoPorMl(600, 100)).toBe(6);
  });
  it("rendimento 90% recalcula", () => {
    expect(custoPorMl(600, 100, 90)).toBeCloseTo(6.666667, 6);
  });
  it("saldo 100 - 60 - 5 - 2 = 33", () => {
    expect(saldoMl([100, -60, -5, -2])).toBe(33);
  });
  it("conferência 33 -> 30 gera -3", () => {
    expect(saldoMl([30, -33])).toBe(-3);
  });
  it("SKU no padrão", () => {
    expect(skuDecant("1051", 5)).toBe("DEC-1051-005");
    expect(volumeSku(2.5)).toBe("2P5");
    expect(volumeSku(10)).toBe("010");
  });
  it("volume zero não divide", () => {
    expect(custoPorMl(600, 0)).toBe(0);
  });
});
