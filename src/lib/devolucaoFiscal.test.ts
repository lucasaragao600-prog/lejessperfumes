import { describe, expect, it } from "vitest";
import { chaveEntradaValida } from "./devolucaoFiscal";

function chaveModelo(modelo: string) {
  const base = `13261012345678000190${modelo}001000000123110000001`;
  let soma = 0;
  let peso = 2;
  for (let i = 42; i >= 0; i--) {
    soma += Number(base[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const d = 11 - soma % 11;
  return base + (d >= 10 ? 0 : d);
}

describe("NF-e de entrada de devolução", () => {
  it("aceita modelo 55 com 44 dígitos e verificador correto", () => {
    expect(chaveEntradaValida(chaveModelo("55"))).toBe(true);
  });
  it("recusa NFC-e modelo 65 mesmo com verificador correto", () => {
    expect(chaveEntradaValida(chaveModelo("65"))).toBe(false);
  });
  it("recusa chave com verificador adulterado", () => {
    const chave = chaveModelo("55");
    expect(chaveEntradaValida(chave.slice(0, 43) + ((Number(chave[43]) + 1) % 10))).toBe(false);
  });
  it("recusa chave sem os 44 dígitos", () => {
    expect(chaveEntradaValida("123456")).toBe(false);
  });
});