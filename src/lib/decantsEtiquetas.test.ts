import { describe, it, expect } from "vitest";
import { htmlEtiquetas, type Etiqueta, type ModeloEtiqueta } from "./decantsEtiquetas";

const m: ModeloEtiqueta = { id: "m", nome: "50x30", largura_mm: 50, altura_mm: 30, mostrar_qr: true, mostrar_barras: true, padrao: true, ativo: true };
const e = (n: number): Etiqueta => ({ sku: "DEC-1051-005", tamanho: "5 ml", volume_ml: 5, marca: "Lattafa", nome: "Khamrah",
  concentracao: "Eau de Parfum", lote: "DEC-LOTE-000123", data_producao: "2026-10-01", n });

describe("etiquetas", () => {
  it("lote com 19 unidades gera 19 etiquetas com todos os campos", async () => {
    const html = await htmlEtiquetas(Array.from({ length: 19 }, (_, i) => e(i + 1)), m);
    expect(html.match(/class="etq"/g)?.length).toBe(19);
    for (const t of ["LE JESS", "Khamrah", "Lattafa", "Eau de Parfum", "5 ml", "DEC-1051-005", "DEC-LOTE-000123", "01/10/2026", "<svg", "data:image/png"])
      expect(html).toContain(t);
    expect(html).toContain("size: 50mm 30mm");
  });
});
