import { forwardRef } from "react";
import { formatCurrency } from "@/data/mockData";
import type { Cliente } from "@/hooks/useClientes";

export interface ComprovanteData {
  // Store info
  nomeFantasia: string;
  cnpj: string;
  endereco: string;
  cidade: string;
  telefone: string;
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
    parcelas: number;
    valor: number;
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

const ComprovantePrint = forwardRef<HTMLDivElement, { data: ComprovanteData }>(({ data }, ref) => {
  const separador = "─".repeat(48);
  const separadorDuplo = "═".repeat(48);

  return (
    <div ref={ref} className="hidden print:block" style={{
      width: "80mm",
      fontFamily: "'Courier New', monospace",
      fontSize: "12px",
      lineHeight: "1.4",
      color: "#000",
      background: "#fff",
      padding: "4mm",
    }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "4px" }}>
        <div style={{ fontSize: "16px", fontWeight: "bold", letterSpacing: "1px" }}>
          {data.nomeFantasia || "LE JESS PERFUMES"}
        </div>
        {data.cnpj && <div style={{ fontSize: "11px" }}>CNPJ: {data.cnpj}</div>}
        {data.endereco && <div style={{ fontSize: "10px" }}>{data.endereco}</div>}
        {data.cidade && <div style={{ fontSize: "10px" }}>{data.cidade}</div>}
        {data.telefone && <div style={{ fontSize: "10px" }}>Tel: {data.telefone}</div>}
      </div>

      <div style={{ textAlign: "center", fontSize: "11px", margin: "6px 0" }}>
        {separadorDuplo}
        <div style={{ fontWeight: "bold", fontSize: "13px" }}>COMPROVANTE NÃO FISCAL</div>
        {separadorDuplo}
      </div>

      {/* Sale info */}
      <div style={{ fontSize: "11px", marginBottom: "4px" }}>
        <div>Pedido: {data.pedido}</div>
        <div>Data: {data.data} {data.hora}</div>
        <div>Vendedor: {data.vendedor}</div>
        {data.operador && <div>Operador: {data.operador}</div>}
        {data.cliente && (
          <>
            <div>{separador}</div>
            <div>Cliente: {data.cliente.nome}</div>
            {data.cliente.cpfCnpj && <div>CPF/CNPJ: {data.cliente.cpfCnpj}</div>}
            {data.cliente.telefone && <div>Tel: {data.cliente.telefone}</div>}
          </>
        )}
      </div>

      <div style={{ fontSize: "10px" }}>{separador}</div>

      {/* Items header */}
      <div style={{ fontSize: "10px", display: "flex", justifyContent: "space-between", fontWeight: "bold", marginBottom: "2px" }}>
        <span style={{ width: "5%" }}>#</span>
        <span style={{ width: "45%", textAlign: "left" }}>DESCRIÇÃO</span>
        <span style={{ width: "10%", textAlign: "center" }}>QTD</span>
        <span style={{ width: "18%", textAlign: "right" }}>VALOR</span>
        <span style={{ width: "20%", textAlign: "right" }}>TOTAL</span>
      </div>

      <div style={{ fontSize: "10px" }}>{separador}</div>

      {/* Items */}
      {data.itens.map((item, idx) => (
        <div key={idx} style={{ fontSize: "11px", marginBottom: "2px" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ width: "5%" }}>{item.item}</span>
            <span style={{ width: "45%", textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {item.descricao}
            </span>
            <span style={{ width: "10%", textAlign: "center" }}>{item.quantidade}</span>
            <span style={{ width: "18%", textAlign: "right" }}>{formatCurrency(item.valorUnitario)}</span>
            <span style={{ width: "20%", textAlign: "right" }}>{formatCurrency(item.total)}</span>
          </div>
          <div style={{ fontSize: "9px", color: "#666", paddingLeft: "5%" }}>
            {item.codigo}
          </div>
        </div>
      ))}

      <div style={{ fontSize: "10px" }}>{separador}</div>

      {/* Payments */}
      <div style={{ fontSize: "11px", fontWeight: "bold", marginBottom: "2px" }}>PAGAMENTOS</div>
      {data.pagamentos.map((pag, idx) => (
        <div key={idx} style={{ fontSize: "11px", display: "flex", justifyContent: "space-between" }}>
          <span>{pag.forma}{pag.parcelas > 1 ? ` ${pag.parcelas}x` : ""}</span>
          <span>{formatCurrency(pag.valor)}</span>
        </div>
      ))}

      <div style={{ fontSize: "10px" }}>{separadorDuplo}</div>

      {/* Totals */}
      <div style={{ fontSize: "11px" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Subtotal:</span>
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

      <div style={{ fontSize: "14px", fontWeight: "bold", display: "flex", justifyContent: "space-between", margin: "4px 0" }}>
        <span>TOTAL:</span>
        <span>{formatCurrency(data.total)}</span>
      </div>

      {data.troco > 0 && (
        <div style={{ fontSize: "12px", display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
          <span>Troco:</span>
          <span>{formatCurrency(data.troco)}</span>
        </div>
      )}

      <div style={{ fontSize: "10px" }}>{separador}</div>

      {/* Observation */}
      {data.observacao && (
        <div style={{ fontSize: "10px", margin: "4px 0" }}>
          Obs: {data.observacao}
        </div>
      )}

      {/* Footer */}
      <div style={{ textAlign: "center", fontSize: "10px", marginTop: "8px" }}>
        <div>Obrigada pela preferência!</div>
        <div style={{ marginTop: "2px" }}>LE JESS PERFUMES</div>
        <div style={{ fontSize: "9px", color: "#999", marginTop: "4px" }}>
          Documento sem valor fiscal
        </div>
      </div>
    </div>
  );
});

ComprovantePrint.displayName = "ComprovantePrint";

export default ComprovantePrint;

// Screen preview version (for the modal)
export function ComprovantePreview({ data }: { data: ComprovanteData }) {
  const separador = "─".repeat(48);
  const separadorDuplo = "═".repeat(48);

  return (
    <div style={{
      width: "100%",
      maxWidth: "320px",
      fontFamily: "'Courier New', monospace",
      fontSize: "11px",
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
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "8px" }}>
        <div style={{ fontSize: "14px", fontWeight: "bold", letterSpacing: "1px", color: "hsl(var(--gold))" }}>
          {data.nomeFantasia || "LE JESS PERFUMES"}
        </div>
        {data.cnpj && <div style={{ fontSize: "10px", color: "hsl(var(--muted-foreground))" }}>CNPJ: {data.cnpj}</div>}
        {data.endereco && <div style={{ fontSize: "9px", color: "hsl(var(--muted-foreground))" }}>{data.endereco}</div>}
        {data.cidade && <div style={{ fontSize: "9px", color: "hsl(var(--muted-foreground))" }}>{data.cidade}</div>}
      </div>

      <div style={{ textAlign: "center", fontSize: "10px", color: "hsl(var(--muted-foreground))" }}>
        {separadorDuplo}
      </div>
      <div style={{ textAlign: "center", fontWeight: "bold", fontSize: "12px", margin: "4px 0" }}>
        COMPROVANTE NÃO FISCAL
      </div>
      <div style={{ textAlign: "center", fontSize: "10px", color: "hsl(var(--muted-foreground))" }}>
        {separadorDuplo}
      </div>

      {/* Sale info */}
      <div style={{ fontSize: "10px", margin: "8px 0", color: "hsl(var(--muted-foreground))" }}>
        <div>Pedido: {data.pedido}</div>
        <div>Data: {data.data} {data.hora}</div>
        <div>Vendedor: {data.vendedor}</div>
        {data.cliente && (
          <>
            <div style={{ color: "hsl(var(--muted-foreground))" }}>{separador}</div>
            <div>Cliente: {data.cliente.nome}</div>
            {data.cliente.cpfCnpj && <div>CPF/CNPJ: {data.cliente.cpfCnpj}</div>}
          </>
        )}
      </div>

      <div style={{ color: "hsl(var(--muted-foreground))", fontSize: "9px" }}>{separador}</div>

      {/* Items */}
      {data.itens.map((item, idx) => (
        <div key={idx} style={{ fontSize: "10px", margin: "4px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>{item.item}. {item.descricao}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", paddingLeft: "12px", color: "hsl(var(--muted-foreground))" }}>
            <span>{item.quantidade}x {formatCurrency(item.valorUnitario)}</span>
            <span>{formatCurrency(item.total)}</span>
          </div>
        </div>
      ))}

      <div style={{ color: "hsl(var(--muted-foreground))", fontSize: "9px" }}>{separador}</div>

      {/* Payments */}
      <div style={{ fontSize: "10px", fontWeight: "bold", margin: "4px 0" }}>PAGAMENTOS</div>
      {data.pagamentos.map((pag, idx) => (
        <div key={idx} style={{ fontSize: "10px", display: "flex", justifyContent: "space-between", color: "hsl(var(--muted-foreground))" }}>
          <span>{pag.forma}{pag.parcelas > 1 ? ` ${pag.parcelas}x` : ""}</span>
          <span>{formatCurrency(pag.valor)}</span>
        </div>
      ))}

      <div style={{ color: "hsl(var(--muted-foreground))", fontSize: "9px" }}>{separadorDuplo}</div>

      {/* Totals */}
      <div style={{ fontSize: "10px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", color: "hsl(var(--muted-foreground))" }}>
          <span>Subtotal:</span><span>{formatCurrency(data.subtotal)}</span>
        </div>
        {data.desconto > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", color: "hsl(var(--success))" }}>
            <span>Desconto:</span><span>-{formatCurrency(data.desconto)}</span>
          </div>
        )}
        {data.acrescimo > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between" }} className="text-warning">
            <span>Acréscimo:</span><span>+{formatCurrency(data.acrescimo)}</span>
          </div>
        )}
      </div>

      <div style={{ fontSize: "14px", fontWeight: "bold", display: "flex", justifyContent: "space-between", margin: "6px 0", color: "hsl(var(--gold))" }}>
        <span>TOTAL:</span><span>{formatCurrency(data.total)}</span>
      </div>

      {data.troco > 0 && (
        <div style={{ fontSize: "11px", display: "flex", justifyContent: "space-between", color: "hsl(var(--success))" }}>
          <span>Troco:</span><span>{formatCurrency(data.troco)}</span>
        </div>
      )}

      <div style={{ color: "hsl(var(--muted-foreground))", fontSize: "9px" }}>{separador}</div>

      <div style={{ textAlign: "center", fontSize: "9px", marginTop: "8px", color: "hsl(var(--muted-foreground))" }}>
        <div>Obrigada pela preferência!</div>
        <div style={{ fontSize: "8px", marginTop: "4px", opacity: 0.6 }}>Documento sem valor fiscal</div>
      </div>
    </div>
  );
}
