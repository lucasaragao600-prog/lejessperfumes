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

import { volumeNecessario, fichaTecnica, sugerirFifo } from "./decants";

describe("decants fase 2", () => {
  it("10×2 + 10×5 + 4×10 = 110 ml", () => {
    expect(volumeNecessario([{ volumeMl: 2, quantidade: 10 }, { volumeMl: 5, quantidade: 10 }, { volumeMl: 10, quantidade: 4 }])).toBe(110);
  });
  it("ficha técnica: 5 ml a R$ 6/ml, insumos R$ 4, mão de obra R$ 1, preço R$ 70", () => {
    const f = fichaTecnica({ volumeMl: 5, custoMl: 6, frasco: 2, atomizador: 0.5, etiqueta: 0.5, embalagem: 1, maoObra: 1, outros: 0, preco: 70 });
    expect(f.custoLiquido).toBe(30);
    expect(f.custoEmbalagem).toBe(4);
    expect(f.custoTotal).toBe(35);
    expect(f.lucroBruto).toBe(35);
    expect(f.margemPct).toBe(50);   // (70 − 35) ÷ 70
    expect(f.markupPct).toBe(100);  // (70 − 35) ÷ 35
  });
  it("FIFO: 20 ml do mais antigo + 40 ml do seguinte = 60 ml", () => {
    const r = sugerirFifo([
      { id: "B", aberto_em: "2026-09-02", disponivel_ml: 100 },
      { id: "A", aberto_em: "2026-09-01", disponivel_ml: 20 },
    ], 60);
    expect(r.distribuicao).toEqual([{ frasco_id: "A", ml: 20 }, { frasco_id: "B", ml: 40 }]);
    expect(r.falta).toBe(0);
  });
});

import { estoquePotencial } from "./decants";
describe("decants fase 3", () => {
  it("60 ml → 30×2 ou 12×5 ou 6×10 (simulação, não soma)", () => {
    expect(estoquePotencial(60, [2, 5, 10])).toEqual([
      { volumeMl: 2, quantidade: 30 }, { volumeMl: 5, quantidade: 12 }, { volumeMl: 10, quantidade: 6 }]);
  });
});

import { periodoPreset, rentabilidade, comparativoFechado } from "./decants";
describe("Fase 4", () => {
  it("rentabilidade do exemplo: 1.250 − 480 = 770", () => {
    expect(rentabilidade(1250, 480)).toEqual({ lucro: 770, margemPct: 61.6 });
    expect(rentabilidade(0, 0).margemPct).toBeNull();
  });
  it("períodos", () => {
    expect(periodoPreset("ontem", "2026-10-01")).toEqual({ ini: "2026-09-30", fim: "2026-09-30" });
    expect(periodoPreset("7d", "2026-10-01")).toEqual({ ini: "2026-09-25", fim: "2026-10-01" });
    expect(periodoPreset("mes", "2026-10-15")).toEqual({ ini: "2026-10-01", fim: "2026-10-15" });
  });
  it("comparativo fechado × decants só calcula", () => {
    const c = comparativoFechado({ precoFechado: 900, custoFrasco: 600, volumeMl: 100, rendimentoPct: 95, perdaPct: 5, tamanhoMl: 5, precoDecant: 70, insumosUnit: 4 });
    expect(c.mlUtil).toBe(90.25);
    expect(c.unidades).toBe(18);
    expect(c.receitaDecants).toBe(1260);
    expect(c.custoEmbalagens).toBe(72);
    expect(c.margemDecants).toBe(588);
    expect(c.margemFechado).toBe(300);
    expect(c.diferenca).toBe(288);
  });
});
