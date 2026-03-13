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
  logoUrl?: string;
  // Sale info
  pedido: string;
  data: string;
  hora: string;
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
  descontoLabel?: string;
  acrescimoLabel?: string;
  total: number;
  troco: number;
  // Footer
  observacao?: string;
}

const ComprovantePrint = forwardRef<HTMLDivElement, { data: ComprovanteData }>(({ data }, ref) => {
  return (
    <div ref={ref} className="hidden print:block" style={{
      width: "80mm",
      fontFamily: "'Courier New', Courier, monospace",
      fontSize: "16px",
      lineHeight: "1.6",
      color: "#000",
      background: "#fff",
      padding: "2mm",
      fontWeight: 900,
      WebkitPrintColorAdjust: "exact",
      printColorAdjust: "exact" as any,
      letterSpacing: "0.3px",
    }}>
      <ReceiptContent data={data} />
    </div>
  );
});

ComprovantePrint.displayName = "ComprovantePrint";
export default ComprovantePrint;

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

function ReceiptContent({ data, preview = false }: { data: ComprovanteData; preview?: boolean }) {
  const dash = "─".repeat(48);
  const doubleLine = "═".repeat(48);
  const mutedColor = preview ? "hsl(var(--muted-foreground))" : "#000";

  return (
    <>
      {/* ── LOGO CENTRALIZADA GRANDE ── */}
      {data.logoUrl ? (
        <div style={{ textAlign: "center", marginBottom: "8px" }}>
          <img src={data.logoUrl} alt="Logo" style={{
            width: "70%",
            maxHeight: "80px",
            objectFit: "contain",
            margin: "0 auto",
            display: "block",
          }} />
        </div>
      ) : (
        <div style={{ textAlign: "center", marginBottom: "8px", fontWeight: "bold", fontSize: "16px" }}>
          {data.nomeFantasia || "LE JESS PERFUMES"}
        </div>
      )}

      {/* ── DADOS DA EMPRESA ── */}
      <div style={{ textAlign: "center", fontSize: "14px", marginBottom: "6px", fontWeight: 900 }}>
        <div style={{ fontWeight: 900, fontSize: "15px" }}>
          {data.razaoSocial || data.nomeFantasia || "LE JESS PERFUMES"}
        </div>
        {data.cnpj && <div>CNPJ: {data.cnpj}</div>}
        {data.inscricaoEstadual && <div>IE: {data.inscricaoEstadual}</div>}
        {data.telefone && <div>Tel.: {data.telefone}</div>}
        {data.endereco && <div>{data.endereco}</div>}
        {data.cidade && <div>{data.cidade}</div>}
      </div>

      <div style={{ color: mutedColor, fontSize: "11px" }}>{dash}</div>

      {/* ── INFO DA VENDA ── */}
      <div style={{ fontSize: "15px", margin: "4px 0", fontWeight: 900 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Pedido: {data.pedido}</span>
          <span>{data.data}</span>
        </div>
        <div>Vendedor: {data.vendedor}</div>
        {data.cliente && <div>Cliente: {data.cliente.nome}</div>}
      </div>

      <div style={{ color: mutedColor, fontSize: "11px" }}>{dash}</div>

      {/* ── CABEÇALHO ITENS ── */}
      <div style={{ fontSize: "14px", fontWeight: 900, display: "flex", padding: "3px 0" }}>
        <span style={{ flex: 1 }}>ITEM</span>
        <span style={{ width: "36px", textAlign: "center" }}>QTD</span>
        <span style={{ width: "72px", textAlign: "right" }}>VALOR</span>
        <span style={{ width: "72px", textAlign: "right" }}>TOTAL</span>
      </div>
      <div style={{ color: mutedColor, fontSize: "11px" }}>{dash}</div>

      {/* ── ITENS ── */}
      {data.itens.map((item, idx) => (
        <div key={idx} style={{ fontSize: "14px", display: "flex", padding: "3px 0", alignItems: "flex-start", fontWeight: 900 }}>
          <span style={{ flex: 1, wordBreak: "break-word" }}>{item.descricao}</span>
          <span style={{ width: "36px", textAlign: "center", flexShrink: 0 }}>{item.quantidade}</span>
          <span style={{ width: "72px", textAlign: "right", flexShrink: 0 }}>{formatCurrency(item.valorUnitario)}</span>
          <span style={{ width: "72px", textAlign: "right", flexShrink: 0 }}>{formatCurrency(item.total)}</span>
        </div>
      ))}

      {/* ── PAGAMENTOS ── */}
      <div style={{ fontSize: "12px", fontWeight: "bold", display: "flex", padding: "3px 0", marginTop: "2px" }}>
        <span style={{ flex: 1 }}>FORMA PGTO.</span>
        <span style={{ width: "76px", textAlign: "right" }}>VALOR</span>
      </div>
      <div style={{ color: mutedColor, fontSize: "11px" }}>{dash}</div>
      {data.pagamentos.map((pag, idx) => {
        if (pag.dataParcelas && pag.dataParcelas.length > 0) {
          return pag.dataParcelas.map((parcela, pIdx) => (
            <div key={`${idx}-${pIdx}`} style={{ fontSize: "12px", display: "flex", padding: "2px 0" }}>
              <span style={{ flex: 1 }}>
                {pag.forma}{pag.parcelas > 1 ? ` ${String(pIdx + 1).padStart(2, "0")}` : ""} ({parcela.data})
              </span>
              <span style={{ width: "76px", textAlign: "right" }}>{formatCurrency(parcela.valor)}</span>
            </div>
          ));
        }
        return (
          <div key={idx} style={{ fontSize: "12px", display: "flex", padding: "2px 0" }}>
            <span style={{ flex: 1 }}>{pag.forma}</span>
            <span style={{ width: "76px", textAlign: "right" }}>{formatCurrency(pag.valor)}</span>
          </div>
        );
      })}

      <div style={{ color: mutedColor, fontSize: "11px" }}>{dash}</div>

      {/* ── SUBTOTAL / DESCONTO ── */}
      <div style={{ fontSize: "13px", margin: "4px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>SUBTOTAL:</span>
          <span>{formatCurrency(data.subtotal)}</span>
        </div>
        {data.desconto > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>DESCONTO{data.descontoLabel ? ` (${data.descontoLabel})` : ""}:</span>
            <span>-{formatCurrency(data.desconto)}</span>
          </div>
        )}
        {data.acrescimo > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>ACRÉSCIMO{data.acrescimoLabel ? ` (${data.acrescimoLabel})` : ""}:</span>
            <span>+{formatCurrency(data.acrescimo)}</span>
          </div>
        )}
      </div>

      {/* ── TOTAL DESTACADO ── */}
      <div style={{ fontSize: "11px", color: mutedColor }}>{doubleLine}</div>
      <div style={{ fontWeight: "bold", fontSize: "16px", display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
        <span>TOTAL:</span>
        <span>{formatCurrency(data.total)}</span>
      </div>
      <div style={{ fontSize: "11px", color: mutedColor }}>{doubleLine}</div>

      {data.troco > 0 && (
        <div style={{ fontSize: "13px", display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
          <span>TROCO:</span>
          <span>{formatCurrency(data.troco)}</span>
        </div>
      )}

      {data.observacao && (
        <>
          <div style={{ color: mutedColor, fontSize: "11px", marginTop: "4px" }}>{dash}</div>
          <div style={{ fontSize: "12px", margin: "4px 0" }}>Obs: {data.observacao}</div>
        </>
      )}

      {/* ── RODAPÉ ── */}
      <div style={{ color: mutedColor, fontSize: "11px", marginTop: "4px" }}>{dash}</div>
      <div style={{ textAlign: "center", fontSize: "12px", marginTop: "8px", color: mutedColor }}>
        <div>Obrigada pela preferência!</div>
        <div style={{ marginTop: "4px", fontSize: "11px" }}>{data.data} {data.hora}</div>
      </div>
    </>
  );
}
