import { describe, it, expect } from "vitest";
import { validarItem, gtinValido } from "../../supabase/functions/fiscal-sefaz/validacao";

describe("validação fiscal", () => {
  it("aceita perfume com ST", () => {
    expect(validarItem({ ncm: "33030010", cfop: "5405", csosn: "500", origem: "0", gtin: "3494802520038" }, "1")).toEqual([]);
  });
  it("aponta CSOSN 500 com CFOP 5102", () => {
    expect(validarItem({ ncm: "33030010", cfop: "5102", csosn: "500" }, "1").some((e) => e.campo === "cfop" && e.grave)).toBe(true);
  });
  it("aponta CFOP 5405 com CSOSN 102", () => {
    expect(validarItem({ ncm: "33030010", cfop: "5405", csosn: "102" }, "1").some((e) => e.campo === "csosn")).toBe(true);
  });
  it("NCM curto é grave, ausente não", () => {
    expect(validarItem({ ncm: "3303", cfop: "5102", csosn: "102" }, "1")[0].grave).toBe(true);
    expect(validarItem({ cfop: "5102", csosn: "102" }, "1")[0].grave).toBe(false);
  });
  it("não emite nota bloqueia", () => {
    expect(validarItem({ emite_nota: false }, "1")[0].grave).toBe(true);
  });
  it("GTIN", () => {
    expect(gtinValido("3494802520038")).toBe(true);
    expect(gtinValido("3494802520039")).toBe(false);
    expect(gtinValido("SEM GTIN")).toBe(true);
  });
});
