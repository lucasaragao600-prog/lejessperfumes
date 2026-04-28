import { describe, it, expect } from "vitest";
import { processarFiscal, processarItem } from "./fiscalEngine";

describe("fiscalEngine", () => {
  it("calcula ICMS e IPI a partir das alíquotas (formato reduzido)", () => {
    const r = processarItem({
      produto: "Perfume A",
      quantidade: 10,
      valor_unitario: 100,
      aliquota_icms: 18,
      aliquota_ipi: 5,
    });
    expect(r.icms_unitario).toBe(18);
    expect(r.ipi_unitario).toBe(5);
    expect(r.custo_final_unitario).toBe(123);
    expect(r.icms_total).toBe(180);
    expect(r.ipi_total).toBe(50);
    expect(r.custo_final_total).toBe(1230);
    expect(r.carga_tributaria_percentual).toBe(23);
    expect(r.inconsistencia).toBe(false);
    expect(r.ajustado).toBe(false);
  });

  it("prioriza valor_icms / valor_ipi informados", () => {
    const r = processarItem({
      produto: "Perfume B",
      quantidade: 4,
      valor_unitario: 50,
      valor_total: 200,
      bc_icms: 200,
      aliquota_icms: 18,
      valor_icms: 36,
      aliquota_ipi: 10,
      valor_ipi: 20,
    });
    expect(r.icms_unitario).toBe(9);
    expect(r.ipi_unitario).toBe(5);
    expect(r.custo_final_unitario).toBe(64);
  });

  it("deriva alíquotas quando só vêm valores", () => {
    const r = processarItem({
      produto: "Perfume C",
      quantidade: 2,
      valor_unitario: 100,
      valor_total: 200,
      valor_icms: 36,
      valor_ipi: 10,
    });
    expect(r.aliquota_icms).toBe(18);
    expect(r.aliquota_ipi).toBe(5);
  });

  it("marca inconsistência quando valor_total diverge", () => {
    const r = processarItem({
      produto: "Perfume D",
      quantidade: 2,
      valor_unitario: 100,
      valor_total: 250, // deveria ser 200
      aliquota_icms: 18,
    });
    expect(r.inconsistencia).toBe(true);
  });

  it("marca ajustado quando recalcula por divergência grande", () => {
    const r = processarItem({
      produto: "Perfume E",
      quantidade: 10,
      valor_unitario: 100,
      aliquota_icms: 18,
      valor_icms: 999, // divergente do esperado (180)
    });
    expect(r.ajustado).toBe(true);
    expect(r.icms_total).toBe(180);
  });

  it("processa lista no formato { itens: [...] }", () => {
    const out = processarFiscal({
      itens: [
        { produto: "X", quantidade: 1, valor_unitario: 10, aliquota_icms: 10, aliquota_ipi: 0 },
        { produto: "Y", quantidade: 2, valor_unitario: 20, aliquota_icms: 0, aliquota_ipi: 5 },
      ],
    });
    expect(out.resultado).toHaveLength(2);
    expect(out.resultado[0].icms_unitario).toBe(1);
    expect(out.resultado[1].ipi_unitario).toBe(1);
  });

  it("normaliza valores negativos / NaN para 0", () => {
    const r = processarItem({
      produto: "Z",
      quantidade: -5 as any,
      valor_unitario: NaN as any,
      aliquota_icms: 18,
    });
    expect(r.quantidade).toBe(0);
    expect(r.valor_unitario).toBe(0);
    expect(r.custo_final_unitario).toBe(0);
  });
});
