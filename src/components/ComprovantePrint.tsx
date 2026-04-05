import { forwardRef } from "react";
import { formatCurrency } from "@/data/mockData";
import type { Cliente } from "@/hooks/useClientes";

export interface ComprovanteData {
  nomeFantasia: string;
  razaoSocial: string;
  cnpj: string;
  inscricaoEstadual: string;
  endereco: string;
  cidade: string;
  telefone: string;
  logoUrl?: string;
  pedido: string;
  data: string;
  hora: string;
  vendedor: string;
  operador: string;
  cliente: Cliente | null;
  itens: {
    item: number;
    descricao: string;
    casa: string;
    perfumeNome: string;
    codigo: string;
    quantidade: number;
    valorUnitario: number;
    total: number;
  }[];
  pagamentos: {
    forma: string;
    codigoFiscal: string;
    parcelas: number;
    valor: number;
    dataParcelas?: { data: string; valor: number }[];
  }[];
  subtotal: number;
  desconto: number;
  acrescimo: number;
  descontoLabel?: string;
  acrescimoLabel?: string;
  total: number;
  troco: number;
  observacao?: string;
}

const ComprovantePrint = forwardRef<HTMLDivElement, { data: ComprovanteData }>(({ data }, ref) => {
  return (
    <div ref={ref} className="hidden print:block" style={{
      width: "72mm",
      fontFamily: "'Arial', sans-serif",
      fontSize: "14px",
      lineHeight: "1.5",
      color: "#000",
      background: "#fff",
      padding: "2mm",
      fontWeight: 900,
      WebkitPrintColorAdjust: "exact",
      printColorAdjust: "exact" as any,
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
      maxWidth: "340px",
      fontFamily: "'Arial', sans-serif",
      fontSize: "11px",
      lineHeight: "1.4",
      color: "hsl(var(--foreground))",
      background: "hsl(var(--card))",
      padding: "14px",
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
  const dash = "─".repeat(40);
  const doubleLine = "═".repeat(40);

  return (
    <>
      {data.logoUrl ? (
        <div style={{ textAlign: "center", marginBottom: "6px" }}>
          <img src={data.logoUrl} alt="Logo" style={{
            width: "60%", maxHeight: "60px", objectFit: "contain", margin: "0 auto", display: "block",
          }} />
        </div>
      ) : (
        <div style={{ textAlign: "center", marginBottom: "6px", fontWeight: "bold", fontSize: "15px" }}>
          {data.nomeFantasia || "LE JESS PERFUMES"}
        </div>
      )}

      <div style={{ textAlign: "center", fontSize: "12px", marginBottom: "4px", fontWeight: 900 }}>
        <div style={{ fontWeight: 900, fontSize: "13px" }}>
          {data.razaoSocial || data.nomeFantasia}
        </div>
        {data.cnpj && <div>CNPJ: {data.cnpj}</div>}
        {data.inscricaoEstadual && <div>IE: {data.inscricaoEstadual}</div>}
        {data.telefone && <div>Tel.: {data.telefone}</div>}
        {data.endereco && <div>{data.endereco}</div>}
        {data.cidade && <div>{data.cidade}</div>}
      </div>

      <div style={{ fontSize: "10px" }}>{dash}</div>

      <div style={{ fontSize: "13px", margin: "3px 0", fontWeight: 900 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Pedido: {data.pedido}</span>
          <span>{data.data}</span>
        </div>
        <div>Vendedor: {data.vendedor}</div>
        {data.operador && <div>Operador: {data.operador}</div>}
        {data.cliente && <div>Cliente: {data.cliente.nome}</div>}
      </div>

      <div style={{ fontSize: "10px" }}>{dash}</div>

      {/* Items - compact: casa + perfume name, then qty/price line */}
      {data.itens.map((item, idx) => (
        <div key={idx} style={{ fontSize: "13px", fontWeight: 900, padding: "2px 0" }}>
          <div style={{ wordBreak: "break-word" }}>
            {item.casa} - {item.perfumeNome}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>x{item.quantidade}  {formatCurrency(item.valorUnitario)}</span>
            <span>{formatCurrency(item.total)}</span>
          </div>
        </div>
      ))}

      <div style={{ fontSize: "10px" }}>{dash}</div>

      {/* Payment */}
      <div style={{ fontSize: "14px", fontWeight: 900, margin: "3px 0" }}>FORMA DE PAGAMENTO</div>
      {data.pagamentos.map((pag, idx) => {
        if (pag.dataParcelas && pag.dataParcelas.length > 0) {
          return pag.dataParcelas.map((parcela, pIdx) => (
            <div key={`${idx}-${pIdx}`} style={{ fontSize: "13px", display: "flex", justifyContent: "space-between", fontWeight: 900, padding: "1px 0" }}>
              <span>{pag.forma}{pag.parcelas > 1 ? ` ${pIdx + 1}/${pag.parcelas}` : ""}</span>
              <span>{formatCurrency(parcela.valor)}</span>
            </div>
          ));
        }
        return (
          <div key={idx} style={{ fontSize: "13px", display: "flex", justifyContent: "space-between", fontWeight: 900, padding: "1px 0" }}>
            <span>{pag.forma}</span>
            <span>{formatCurrency(pag.valor)}</span>
          </div>
        );
      })}

      <div style={{ fontSize: "10px" }}>{dash}</div>

      {/* Totals */}
      <div style={{ fontSize: "14px", fontWeight: 900, margin: "3px 0" }}>
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

      <div style={{ fontSize: "11px" }}>{doubleLine}</div>
      <div style={{ fontWeight: 900, fontSize: "16px", display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
        <span>TOTAL:</span>
        <span>{formatCurrency(data.total)}</span>
      </div>
      <div style={{ fontSize: "11px" }}>{doubleLine}</div>

      {data.troco > 0 && (
        <div style={{ fontSize: "14px", display: "flex", justifyContent: "space-between", fontWeight: 900, margin: "3px 0" }}>
          <span>TROCO:</span>
          <span>{formatCurrency(data.troco)}</span>
        </div>
      )}

      {data.observacao && (
        <>
          <div style={{ fontSize: "10px" }}>{dash}</div>
          <div style={{ fontSize: "12px", margin: "3px 0", fontWeight: 900 }}>Obs: {data.observacao}</div>
        </>
      )}

      <div style={{ fontSize: "10px", marginTop: "4px" }}>{dash}</div>
      <div style={{ textAlign: "center", fontSize: "12px", marginTop: "6px", fontWeight: 900 }}>
        <div>Obrigada pela preferência!</div>
        <div style={{ marginTop: "3px", fontSize: "11px" }}>{data.data} {data.hora}</div>
      </div>
    </>
  );
}
