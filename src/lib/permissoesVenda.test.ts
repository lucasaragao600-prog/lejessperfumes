import { describe, expect, it } from "vitest";
import { PERMISSOES_TROCAS, podeAcao } from "./permissoesVenda";

describe("permissoesVenda", () => {
  it("master pode qualquer ação mesmo sem concessões", () => {
    expect(podeAcao(true, [], PERMISSOES_TROCAS.trocar)).toBe(true);
    expect(podeAcao(true, [], PERMISSOES_TROCAS.quarentena)).toBe(true);
  });

  it("vendedor sem concessão não pode trocar nem devolver", () => {
    expect(podeAcao(false, [], PERMISSOES_TROCAS.trocar)).toBe(false);
    expect(podeAcao(false, [], PERMISSOES_TROCAS.devolver)).toBe(false);
    expect(podeAcao(false, [], PERMISSOES_TROCAS.cancelar)).toBe(false);
  });

  it("vendedor com concessão em qualquer unidade pode a ação", () => {
    const perms = [{ permissao: "venda.trocar" }, { permissao: "estoque.visualizar" }];
    expect(podeAcao(false, perms, PERMISSOES_TROCAS.trocar)).toBe(true);
    expect(podeAcao(false, perms, PERMISSOES_TROCAS.devolver)).toBe(false);
  });

  it("quarentena exige a permissão específica", () => {
    const perms = [{ permissao: "devolucao.quarentena" }];
    expect(podeAcao(false, perms, PERMISSOES_TROCAS.quarentena)).toBe(true);
    expect(podeAcao(false, [{ permissao: "venda.devolver" }], PERMISSOES_TROCAS.quarentena)).toBe(false);
  });
});
