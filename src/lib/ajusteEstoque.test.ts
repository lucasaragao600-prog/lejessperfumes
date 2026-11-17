import { describe, it, expect } from "vitest";
import { erroMotivoAjuste } from "./ajusteEstoque";

describe("motivo do ajuste", () => {
  it("exige categoria", () => expect(erroMotivoAjuste("", "Contagem física na vitrine")).not.toBeNull());
  it("exige 10 caracteres úteis", () => expect(erroMotivoAjuste("Outro", "faltou 1 ")).not.toBeNull());
  it("recusa motivo genérico", () => expect(erroMotivoAjuste("Outro", "1234567890")).not.toBeNull());
  it("aceita motivo descrito", () => expect(erroMotivoAjuste("Furto", "Sumiu 1 frasco da vitrine")).toBeNull());
});
