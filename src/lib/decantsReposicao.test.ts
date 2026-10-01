import { describe, it, expect } from "vitest";
import { sugestaoReposicao } from "./decants";

describe("sugestaoReposicao", () => {
  it("mínimo 5, ideal 15, atual 3 → sugere 12", () => {
    const r = sugestaoReposicao({ minimo: 5, ideal: 15, atual: 3, volumeMl: 5, disponivelMl: 67 });
    expect(r.sugerido).toBe(12); expect(r.necessario).toBe(60); expect(r.deficit).toBe(0); expect(r.produzivel).toBe(12);
  });
  it("não sugere acima do mínimo", () => {
    expect(sugestaoReposicao({ minimo: 5, ideal: 15, atual: 6, volumeMl: 5, disponivelMl: 100 }).sugerido).toBe(0);
  });
  it("mostra déficit e limita o que dá para produzir", () => {
    const r = sugestaoReposicao({ minimo: 5, ideal: 15, atual: 3, volumeMl: 5, disponivelMl: 42 });
    expect(r.deficit).toBe(18); expect(r.produzivel).toBe(8);
  });
  it("desconta o que já está em produção", () => {
    expect(sugestaoReposicao({ minimo: 5, ideal: 15, atual: 3, emProducao: 10, volumeMl: 5, disponivelMl: 100 }).sugerido).toBe(2);
  });
});
