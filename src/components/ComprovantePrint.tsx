import { forwardRef } from "react";
import { formatCurrency } from "@/data/mockData";
import type { Cliente } from "@/hooks/useClientes";

export interface ComprovanteData {
  // Store info
  nomeFantasia: string;
  razaoSocial: string;
  cnpj: string;
  inscricaoEstadual: string;
  endereco: string;
  cidade: string;
  telefone: string;
  // Sale info
  pedido: string;
  data: string;
  hora: string;
  dataPrevista?: string;
  vendedor: string;
  operador: string;
  cliente: Cliente | null;
  // Items
  itens: {
    item: number;
    descricao: string;
    codigo: string;
    quantidade: number;
    valorUnitario: number;
    total: number;
  }[];
  // Payments
  pagamentos: {
    forma: string;
    codigoFiscal: string;
    parcelas: number;
    valor: number;
    dataParcelas?: { data: string; valor: number }[];
  }[];
  // Totals
  subtotal: number;
  desconto: number;
  acrescimo: number;
  total: number;
  troco: number;
  // Footer
  observacao?: string;
}

// ──────────────────────────────────────────────
// PRINT VERSION (hidden, triggered by window.print)
// ──────────────────────────────────────────────
const ComprovantePrint = forwardRef<HTMLDivElement, { data: ComprovanteData }>(({ data }, ref) => {
  return (
    <div ref={ref} className="hidden print:block" style={{
      width: "80mm",
      fontFamily: "'Courier New', monospace",
      fontSize: "11px",
      lineHeight: "1.4",
      color: "#000",
      background: "#fff",
      padding: "4mm",
    }}>
      <ReceiptContent data={data} />
    </div>
  );
});

ComprovantePrint.displayName = "ComprovantePrint";
export default ComprovantePrint;

// ──────────────────────────────────────────────
// SCREEN PREVIEW (for the modal)
// ──────────────────────────────────────────────
export function ComprovantePreview({ data }: { data: ComprovanteData }) {
  return (
    <div style={{
      width: "100%",
      maxWidth: "360px",
      fontFamily: "'Courier New', monospace",
      fontSize: "10px",
      lineHeight: "1.4",
      color: "hsl(var(--foreground))",
      background: "hsl(var(--card))",
      padding: "16px",
      borderRadius: "12px",
      border: "1px solid hsl(var(--border))",
      margin: "0 auto",
      maxHeight: "60vh",
      overflowY: "auto",
    }}>
      <ReceiptContent data={data} preview />
    </div>
  );
}

// ──────────────────────────────────────────────
// SHARED RECEIPT CONTENT
// ──────────────────────────────────────────────
function ReceiptContent({ data, preview = false }: { data: ComprovanteData; preview?: boolean }) {
  const sep = "─".repeat(52);
  const mutedColor = preview ? "hsl(var(--muted-foreground))" : "#666";
  const accentColor = preview ? "hsl(var(--gold))" : "#000";

  return (
    <>
      {/* ── HEADER: Logo left + Company info right ── */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "8px", alignItems: "flex-start" }}>
        {/* Logo placeholder */}
        <div style={{
          width: "60px",
          minWidth: "60px",
          height: "60px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: `1px solid ${mutedColor}`,
          borderRadius: "4px",
          fontSize: "8px",
          textAlign: "center",
          color: mutedColor,
        }}>
          <div>
            <div style={{ fontWeight: "bold", fontSize: "10px", color: accentColor }}>Le Jess</div>
            <div style={{ fontSize: "7px" }}>PERFUMES</div>
          </div>
        </div>

        {/* Company info */}
        <div style={{ flex: 1, textAlign: "right", fontSize: "9px" }}>
          <div style={{ fontWeight: "bold", fontSize: "10px" }}>
            {data.razaoSocial || data.nomeFantasia || "LE JESS PERFUMES"}
          </div>
          {data.cnpj && <div>{data.cnpj}</div>}
          {data.inscricaoEstadual && <div>{data.inscricaoEstadual}</div>}
          {data.telefone && <div>Tel.: {data.telefone}</div>}
          {data.endereco && <div>{data.endereco}</div>}
          {data.cidade && <div>{data.cidade}</div>}
        </div>
      </div>

      <div style={{ color: mutedColor, fontSize: "9px" }}>{sep}</div>

      {/* ── SALE INFO ── */}
      <div style={{ fontSize: "10px", margin: "6px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Pedido: {data.pedido}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Data: {data.data}</span>
          <span>Data prevista: {data.dataPrevista || "00/00/0000"}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Vendedor: {data.vendedor}</span>
        </div>
        {data.cliente && (
          <div>Cliente: {data.cliente.nome}</div>
        )}
      </div>

      <div style={{ color: mutedColor, fontSize: "9px" }}>{sep}</div>

      {/* ── ITEMS TABLE ── */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px", margin: "4px 0" }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${mutedColor}` }}>
            <th style={{ textAlign: "left", padding: "2px 0", fontWeight: "bold" }}>Item da venda</th>
            <th style={{ textAlign: "center", padding: "2px 4px", fontWeight: "bold", width: "40px" }}>Qtde</th>
            <th style={{ textAlign: "right", padding: "2px 4px", fontWeight: "bold", width: "60px" }}>Valor</th>
            <th style={{ textAlign: "right", padding: "2px 0", fontWeight: "bold", width: "60px" }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {data.itens.map((item, idx) => (
            <tr key={idx}>
              <td style={{ padding: "3px 0", fontSize: "9px" }}>{item.descricao}</td>
              <td style={{ textAlign: "center", padding: "3px 4px" }}>{item.quantidade}</td>
              <td style={{ textAlign: "right", padding: "3px 4px" }}>{formatCurrency(item.valorUnitario)}</td>
              <td style={{ textAlign: "right", padding: "3px 0" }}>{formatCurrency(item.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ color: mutedColor, fontSize: "9px" }}>{sep}</div>

      {/* ── PAYMENTS TABLE ── */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px", margin: "4px 0" }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${mutedColor}` }}>
            <th style={{ textAlign: "left", padding: "2px 0", fontWeight: "bold" }}>Data</th>
            <th style={{ textAlign: "left", padding: "2px 4px", fontWeight: "bold" }}>Forma pgto.</th>
            <th style={{ textAlign: "center", padding: "2px 4px", fontWeight: "bold" }}>Cód. fiscal</th>
            <th style={{ textAlign: "right", padding: "2px 0", fontWeight: "bold" }}>Valor</th>
          </tr>
        </thead>
        <tbody>
          {data.pagamentos.map((pag, idx) => {
            // If has installment dates, show each one
            if (pag.dataParcelas && pag.dataParcelas.length > 0) {
              return pag.dataParcelas.map((parcela, pIdx) => (
                <tr key={`${idx}-${pIdx}`}>
                  <td style={{ padding: "2px 0", fontSize: "9px" }}>{parcela.data}</td>
                  <td style={{ padding: "2px 4px", fontSize: "9px" }}>
                    {pag.forma}{pag.parcelas > 1 ? ` ${String(pIdx + 1).padStart(2, "0")}` : ""}
                  </td>
                  <td style={{ textAlign: "center", padding: "2px 4px", fontSize: "9px" }}>{pag.codigoFiscal}</td>
                  <td style={{ textAlign: "right", padding: "2px 0", fontSize: "9px" }}>{formatCurrency(parcela.valor)}</td>
                </tr>
              ));
            }
            // Single payment
            return (
              <tr key={idx}>
                <td style={{ padding: "2px 0", fontSize: "9px" }}>{data.data}</td>
                <td style={{ padding: "2px 4px", fontSize: "9px" }}>{pag.forma}</td>
                <td style={{ textAlign: "center", padding: "2px 4px", fontSize: "9px" }}>{pag.codigoFiscal}</td>
                <td style={{ textAlign: "right", padding: "2px 0", fontSize: "9px" }}>{formatCurrency(pag.valor)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ color: mutedColor, fontSize: "9px" }}>{sep}</div>

      {/* ── TOTALS ── */}
      <div style={{ fontSize: "10px", margin: "4px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Sub Total:</span>
          <span>{formatCurrency(data.subtotal)}</span>
        </div>
        {data.desconto > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Desconto:</span>
            <span>-{formatCurrency(data.desconto)}</span>
          </div>
        )}
        {data.acrescimo > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Acréscimo:</span>
            <span>+{formatCurrency(data.acrescimo)}</span>
          </div>
        )}
      </div>

      <div style={{ fontWeight: "bold", fontSize: "12px", display: "flex", justifyContent: "space-between", margin: "4px 0" }}>
        <span>Total:</span>
        <span>{formatCurrency(data.total)}</span>
      </div>

      {data.troco > 0 && (
        <div style={{ fontSize: "10px", display: "flex", justifyContent: "space-between" }}>
          <span>Troco:</span>
          <span>{formatCurrency(data.troco)}</span>
        </div>
      )}

      {data.observacao && (
        <>
          <div style={{ color: mutedColor, fontSize: "9px" }}>{sep}</div>
          <div style={{ fontSize: "9px", margin: "4px 0" }}>Obs: {data.observacao}</div>
        </>
      )}

      {/* ── FOOTER ── */}
      <div style={{ color: mutedColor, fontSize: "9px" }}>{sep}</div>
      <div style={{ textAlign: "center", fontSize: "9px", marginTop: "8px", color: mutedColor }}>
        <div>Obrigada pela preferência!</div>
        <div style={{ marginTop: "4px", fontSize: "8px" }}>{data.data} {data.hora}</div>
      </div>
    </>
  );
}
