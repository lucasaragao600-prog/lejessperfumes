import { describe, it, expect } from "vitest";
import { htmlTermica, linhasNota, totaisNota, viaCega } from "./notaTransferencia";
import type { NtDetalhe } from "@/hooks/useNotasTransferencia";

const un = { nome: "Casa", nome_exibicao: "Casa", cnpj: "", inscricao_estadual: "", telefone: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "", cep: "" };
const nt = (o: Partial<NtDetalhe> = {}): NtDetalhe => ({
  id: "1", numero: "NT-2026-000001", codigo_publico: "abc", revisao: 1, tipo_nota: "normal", motivo_revisao: "", nt_original_numero: null,
  tipo_origem: "transferencia", origem_numero: "TRF-1", status: "EMITIDA", origem: un, destino: { ...un, nome_exibicao: "Sumaúma" },
  cnpjs_diferentes: true, separado_por_nome: "Ana", emitido_por_nome: "Bia", emitido_em: "2026-10-01T12:00:00Z",
  recebido_por_nome: null, recebido_em: null, cancelado_por_nome: null, cancelado_em: null, cancelado_motivo: null,
  transportador: "Moto", observacao: "", reimpressoes: 0, mostrar_valores: false, conferencia_cega: false,
  itens: [
    { id: "a", tipo_item: "produto", codigo: "P1", descricao: "Perfume", unidade_medida: "un", quantidade_enviada: 3, quantidade_recebida: 2, custo_unitario: 99 },
    { id: "b", tipo_item: "frasco", codigo: "FR-1", descricao: "Frasco", unidade_medida: "ml", quantidade_enviada: 40, quantidade_recebida: null, custo_unitario: null },
  ], ...o,
});

describe("Nota de Transferência", () => {
  it("via do destino é cega enquanto em trânsito", () => {
    expect(viaCega(nt(), "destino")).toBe(true);
    expect(viaCega(nt(), "origem")).toBe(false);
    expect(viaCega(nt({ status: "RECEBIDA" }), "destino")).toBe(false);
  });
  it("linhas e totais trazem diferença, ml e ocultam enviado na via cega", () => {
    const l = linhasNota(nt().itens, false);
    expect(l[0].diferenca).toBe("-1");
    expect(l[1].enviado).toBe("40 ml");
    expect(linhasNota(nt().itens, true)[0].enviado).toBe("(conferência cega)");
    expect(totaisNota(nt().itens, false)).toMatchObject({ itens: 2, unidades: 3, ml: 40 });
    expect(totaisNota(nt().itens, true).unidades).toBeNull();
  });
  it("térmica: campos obrigatórios, marca de reimpressão e sem custo", () => {
    const h1 = htmlTermica(nt(), "origem", 1, "data:x", "");
    expect(h1).toContain("NOTA DE TRANSFERÊNCIA");
    expect(h1).toContain("NT-2026-000001");
    expect(h1).toContain("sem valor fiscal");
    expect(h1).toContain("CNPJs diferentes");
    expect(h1).not.toContain("REIMPRESSÃO");
    expect(h1).not.toContain("99");
    expect(htmlTermica(nt(), "origem", 2, "data:x", "")).toContain("2ª VIA / REIMPRESSÃO");
  });
});
