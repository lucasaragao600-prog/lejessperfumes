import { describe, it, expect } from "vitest";
import { processarXmlNFe } from "./nfeXmlParser";

const xmlBase = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe">
  <NFe>
    <infNFe Id="NFe35200114200166000187550010000000015">
      <det nItem="1">
        <prod>
          <cProd>P1</cProd>
          <xProd>Perfume A 100ml</xProd>
          <qCom>10.0000</qCom>
          <vUnCom>100.0000</vUnCom>
          <vProd>1000.00</vProd>
        </prod>
        <imposto>
          <ICMS>
            <ICMS00>
              <vBC>1000.00</vBC>
              <pICMS>18.00</pICMS>
              <vICMS>180.00</vICMS>
            </ICMS00>
          </ICMS>
          <IPI>
            <IPITrib>
              <pIPI>5.00</pIPI>
              <vIPI>50.00</vIPI>
            </IPITrib>
          </IPI>
        </imposto>
      </det>
      <det nItem="2">
        <prod>
          <cProd>P2</cProd>
          <xProd>Perfume B 50ml</xProd>
          <qCom>5.0000</qCom>
          <vUnCom>200.0000</vUnCom>
          <vProd>1000.00</vProd>
        </prod>
        <imposto>
          <ICMS>
            <ICMS00>
              <vBC>1000.00</vBC>
              <pICMS>18.00</pICMS>
              <vICMS>180.00</vICMS>
            </ICMS00>
          </ICMS>
          <IPI>
            <IPITrib>
              <pIPI>10.00</pIPI>
              <vIPI>100.00</vIPI>
            </IPITrib>
          </IPI>
        </imposto>
      </det>
      <total>
        <ICMSTot>
          <vBC>2000.00</vBC>
          <vICMS>360.00</vICMS>
          <vProd>2000.00</vProd>
          <vFrete>100.00</vFrete>
          <vSeg>20.00</vSeg>
          <vDesc>40.00</vDesc>
          <vIPI>150.00</vIPI>
          <vOutro>10.00</vOutro>
          <vNF>2250.00</vNF>
        </ICMSTot>
      </total>
    </infNFe>
  </NFe>
</nfeProc>`;

describe("nfeXmlParser", () => {
  it("lê itens, ratea frete/despesas e calcula custo real", () => {
    const out = processarXmlNFe(xmlBase);
    expect(out.resultado).toHaveLength(2);
    const i1 = out.resultado[0];
    // 50% de cada total rateado
    expect(i1.frete_rateado).toBe(50);
    expect(i1.seguro_rateado).toBe(10);
    expect(i1.outros_rateado).toBe(5);
    expect(i1.desconto_rateado).toBe(20);
    expect(i1.icms_total).toBe(180);
    expect(i1.ipi_total).toBe(50);
    // custo total = 1000 + 180 + 50 + 50 + 10 + 5 - 20 = 1275
    expect(i1.custo_total_item).toBe(1275);
    // unitário = 1275 / 10 = 127.5
    expect(i1.custo_final_unitario).toBe(127.5);
    expect(i1.inconsistencia).toBe(false);
    expect(i1.ajustado).toBe(false);
  });

  it("preenche resumo da nota", () => {
    const out = processarXmlNFe(xmlBase);
    expect(out.resumo_nota.total_produtos).toBe(2000);
    expect(out.resumo_nota.total_icms).toBe(360);
    expect(out.resumo_nota.total_ipi).toBe(150);
    expect(out.resumo_nota.total_frete).toBe(100);
    expect(out.resumo_nota.valor_total_nota).toBe(2250);
  });

  it("retorna saída vazia para XML inválido", () => {
    const out = processarXmlNFe("<x/>");
    expect(out.resultado).toEqual([]);
    expect(out.resumo_nota.valor_total_nota).toBe(0);
  });
});
