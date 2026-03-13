import { useRef } from "react";
import { Printer } from "lucide-react";
import { formatCurrency } from "@/data/mockData";
import type { ComprovanteConfig } from "@/hooks/useComprovanteConfig";

interface Props {
  config: ComprovanteConfig;
  logoUrl?: string;
  empresaNome?: string;
  empresaCnpj?: string;
  empresaEndereco?: string;
  empresaTelefone?: string;
}

const MOCK_DATA = {
  pedido: "00142",
  data: "13/03/2026",
  hora: "14:35",
  vendedor: "Ana",
  itens: [
    { descricao: "AR·TF·EDP·0001·100 - Tom Ford Oud Wood", qtd: 1, preco: 450.0 },
    { descricao: "NI·CH·EDT·0015·050 - Chanel Bleu", qtd: 2, preco: 320.0 },
  ],
  subtotal: 1090.0,
  desconto: 50.0,
  total: 1040.0,
  pagamento: "Cartão de Crédito 2x",
};

export default function ComprovantePreviewLive({ config, logoUrl, empresaNome, empresaCnpj, empresaEndereco, empresaTelefone }: Props) {
  const printRef = useRef<HTMLDivElement>(null);

  const widthMap = { "58mm": "182px", "80mm": "272px", A4: "100%" };
  const paperWidth = widthMap[config.formatoPapel];
  const dash = "─".repeat(config.formatoPapel === "58mm" ? 32 : 48);
  const doubleLine = "═".repeat(config.formatoPapel === "58mm" ? 32 : 48);

  const isBlocoAtivo = (id: string) => config.blocos.find((b) => b.id === id)?.ativo ?? true;
  const getBlocoStyle = (id: string): React.CSSProperties => {
    const bloco = config.blocos.find((b) => b.id === id);
    if (!bloco) return {};
    return {
      textAlign: bloco.alinhamento,
      fontSize: `${bloco.fontSize}px`,
      fontWeight: bloco.fontWeight === "bold" ? 900 : 400,
      fontStyle: bloco.italic ? "italic" : "normal",
      textDecoration: bloco.underline ? "underline" : "none",
      textTransform: bloco.uppercase ? "uppercase" : "none",
      marginBottom: `${bloco.espacamento}px`,
    };
  };

  const handleTestPrint = () => {
    const el = printRef.current;
    if (!el) return;
    const win = window.open("", "_blank", "width=400,height=600");
    if (!win) return;
    win.document.write(`
      <html><head><title>Impressão Teste</title>
      <style>
        @page { margin: ${config.margens.top}mm ${config.margens.right}mm ${config.margens.bottom}mm ${config.margens.left}mm; }
        body { margin: 0; padding: 0; }
        * { font-family: '${config.fontFamily}', monospace; }
      </style>
      </head><body>${el.innerHTML}</body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 300);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Preview em Tempo Real</h2>
          <p className="text-[10px] text-muted-foreground mt-0.5">Visualize como ficará o comprovante</p>
        </div>
        <button onClick={handleTestPrint} className="btn-primary px-4 py-2 text-xs flex items-center gap-2">
          <Printer size={14} /> Impressão Teste
        </button>
      </div>

      {/* Format tabs */}
      <div className="flex gap-2">
        {(["58mm", "80mm", "A4"] as const).map((fmt) => (
          <span key={fmt} className={`text-[10px] px-3 py-1 rounded-lg ${config.formatoPapel === fmt ? "bg-primary text-primary-foreground font-bold" : "bg-surface-overlay text-muted-foreground border border-border"}`}>
            {fmt}
          </span>
        ))}
      </div>

      {/* Preview card */}
      <div className="bg-card border border-border rounded-xl p-4 overflow-auto max-h-[65vh]">
        <div
          ref={printRef}
          style={{
            width: paperWidth,
            maxWidth: "100%",
            fontFamily: `'${config.fontFamily}', monospace`,
            fontSize: `${config.fontProfiles.corpo.size}px`,
            lineHeight: config.espacamentoLinhas,
            color: "#000",
            background: "#fff",
            padding: `${config.margens.top}mm ${config.margens.right}mm ${config.margens.bottom}mm ${config.margens.left}mm`,
            fontWeight: 900,
            margin: "0 auto",
          }}
        >
          {/* Logo */}
          {isBlocoAtivo("logo") && logoUrl && (
            <div style={{ textAlign: config.logoAlinhamento, marginBottom: "8px" }}>
              <img
                src={logoUrl}
                alt="Logo"
                style={{
                  width: `${config.logoLargura}%`,
                  maxHeight: `${config.logoAltura}px`,
                  objectFit: "contain",
                  display: "inline-block",
                  filter: config.logoMono ? "grayscale(1) contrast(2)" : "none",
                }}
              />
            </div>
          )}

          {/* Nome empresa */}
          {isBlocoAtivo("nome_empresa") && (
            <div style={getBlocoStyle("nome_empresa")}>{empresaNome || "LE JESS PERFUMES"}</div>
          )}

          {/* CNPJ */}
          {isBlocoAtivo("cnpj") && (
            <div style={getBlocoStyle("cnpj")}>CNPJ: {empresaCnpj || "00.000.000/0001-00"}</div>
          )}

          {/* Endereço */}
          {isBlocoAtivo("endereco") && (
            <div style={getBlocoStyle("endereco")}>{empresaEndereco || "Av. Exemplo, 123 - Manaus/AM"}</div>
          )}

          {/* Telefone */}
          {isBlocoAtivo("telefone") && (
            <div style={getBlocoStyle("telefone")}>Tel.: {empresaTelefone || "(92) 99999-9999"}</div>
          )}

          <div style={{ fontSize: "11px", color: "#999" }}>{dash}</div>

          {/* Pedido + Data */}
          {isBlocoAtivo("num_pedido") && (
            <div style={{ ...getBlocoStyle("num_pedido"), display: "flex", justifyContent: "space-between" }}>
              <span>Pedido: {MOCK_DATA.pedido}</span>
              {isBlocoAtivo("data_hora") && <span>{MOCK_DATA.data}</span>}
            </div>
          )}

          {/* Vendedor */}
          {isBlocoAtivo("vendedor") && (
            <div style={getBlocoStyle("vendedor")}>Vendedor: {MOCK_DATA.vendedor}</div>
          )}

          <div style={{ fontSize: "11px", color: "#999" }}>{dash}</div>

          {/* Produtos */}
          {isBlocoAtivo("lista_produtos") && (
            <>
              <div style={{ ...getBlocoStyle("lista_produtos"), display: "flex", padding: "3px 0" }}>
                <span style={{ flex: 1 }}>ITEM</span>
                <span style={{ width: "30px", textAlign: "center" }}>QTD</span>
                <span style={{ width: "65px", textAlign: "right" }}>VALOR</span>
                <span style={{ width: "65px", textAlign: "right" }}>TOTAL</span>
              </div>
              <div style={{ fontSize: "11px", color: "#999" }}>{dash}</div>
              {MOCK_DATA.itens.map((item, i) => (
                <div key={i} style={{ ...getBlocoStyle("lista_produtos"), display: "flex", padding: "3px 0", alignItems: "flex-start" }}>
                  <span style={{ flex: 1, wordBreak: "break-word" }}>{item.descricao}</span>
                  <span style={{ width: "30px", textAlign: "center", flexShrink: 0 }}>{item.qtd}</span>
                  <span style={{ width: "65px", textAlign: "right", flexShrink: 0 }}>{formatCurrency(item.preco)}</span>
                  <span style={{ width: "65px", textAlign: "right", flexShrink: 0 }}>{formatCurrency(item.preco * item.qtd)}</span>
                </div>
              ))}
            </>
          )}

          <div style={{ fontSize: "11px", color: "#999" }}>{dash}</div>

          {/* Forma de pagamento */}
          {isBlocoAtivo("forma_pagamento") && (
            <div style={getBlocoStyle("forma_pagamento")}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>{MOCK_DATA.pagamento}</span>
                <span>{formatCurrency(MOCK_DATA.total)}</span>
              </div>
            </div>
          )}

          <div style={{ fontSize: "11px", color: "#999" }}>{dash}</div>

          {/* Subtotal */}
          {isBlocoAtivo("subtotal") && (
            <div style={{ ...getBlocoStyle("subtotal"), display: "flex", justifyContent: "space-between" }}>
              <span>SUBTOTAL:</span>
              <span>{formatCurrency(MOCK_DATA.subtotal)}</span>
            </div>
          )}

          {/* Desconto */}
          {isBlocoAtivo("desconto") && MOCK_DATA.desconto > 0 && (
            <div style={{ ...getBlocoStyle("desconto"), display: "flex", justifyContent: "space-between" }}>
              <span>DESCONTO:</span>
              <span>-{formatCurrency(MOCK_DATA.desconto)}</span>
            </div>
          )}

          {/* Total */}
          <div style={{ fontSize: "13px", color: "#999" }}>{doubleLine}</div>
          {isBlocoAtivo("total") && (
            <div style={{ ...getBlocoStyle("total"), display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
              <span>TOTAL:</span>
              <span>{formatCurrency(MOCK_DATA.total)}</span>
            </div>
          )}
          <div style={{ fontSize: "13px", color: "#999" }}>{doubleLine}</div>

          {/* Mensagem agradecimento */}
          {isBlocoAtivo("msg_agradecimento") && config.msgAgradecimento && (
            <>
              <div style={{ fontSize: "11px", color: "#999", marginTop: "4px" }}>{dash}</div>
              <div style={{ ...getBlocoStyle("msg_agradecimento"), marginTop: "4px" }}>
                {config.msgAgradecimento}
              </div>
            </>
          )}

          {/* Mensagem promocional */}
          {config.msgPromocional && (
            <div style={{ textAlign: "center", fontSize: "13px", marginTop: "4px", fontWeight: 900 }}>
              {config.msgPromocional}
            </div>
          )}

          {/* Rodapé */}
          {isBlocoAtivo("rodape") && (
            <div style={{ ...getBlocoStyle("rodape"), marginTop: "8px" }}>
              {MOCK_DATA.data} {MOCK_DATA.hora}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
