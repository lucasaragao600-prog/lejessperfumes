import { ArrowLeft, FileSpreadsheet, FileText, Clock, ScanBarcode } from "lucide-react";
import { useBalancos, useBalancoItens, useBalancoAuditoria } from "@/hooks/useBalancos";
import { useBalancoLeituras } from "@/hooks/useBalancoLeituras";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

const ACAO_LABEL: Record<string, string> = {
  criado: "Balanço criado",
  item_conferido: "Item conferido",
  salvo: "Salvo",
  concluido: "Conferência concluída",
  ajuste_aplicado: "Ajustes aplicados",
  cancelado: "Cancelado",
  reaberto: "Reaberto",
};

interface Props {
  balancoId: string;
  onBack: () => void;
}

export default function BalancoDetalhes({ balancoId, onBack }: Props) {
  const { balancos } = useBalancos();
  const { data: itens = [] } = useBalancoItens(balancoId);
  const { data: log = [] } = useBalancoAuditoria(balancoId);
  const { data: leituras = [] } = useBalancoLeituras(balancoId);
  const balanco = balancos.find((b) => b.id === balancoId);

  if (!balanco) return null;

  const exportXLSX = () => {
    const rows = itens.map((i) => ({
      Código: i.perfume_codigo,
      Produto: i.perfume_nome,
      Marca: i.marca,
      Depósito: i.deposito,
      Sistema: i.estoque_sistema,
      "Contagem 1": i.quantidade_contada ?? "",
      "Contagem 2": i.quantidade_contada_2 ?? "",
      "Diverg. Contadores": i.divergencia_contadores ? "Sim" : "Não",
      Diferença: i.diferenca,
      Status: i.status,
      "Custo Un.": Number(i.custo_unitario).toFixed(2),
      "Impacto R$": Number(i.impacto_financeiro).toFixed(2),
      Justificativa: i.justificativa,
      "Ajuste aplicado": i.ajuste_aplicado ? "Sim" : "Não",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Balanço");
    if (leituras.length) {
      const wsL = XLSX.utils.json_to_sheet(
        leituras.map((l) => ({
          Data: new Date(l.criado_em).toLocaleString("pt-BR"),
          Código: l.codigo_lido,
          Origem: l.origem,
          Encontrado: l.encontrado ? "Sim" : "Não",
          Quantidade: l.quantidade,
          Contagem: l.contagem,
          Usuário: l.usuario,
        })),
      );
      XLSX.utils.book_append_sheet(wb, wsL, "Leituras");
    }
    XLSX.writeFile(wb, `${balanco.nome.replace(/[^a-z0-9]/gi, "_")}.xlsx`);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(balanco.nome, 14, 16);
    doc.setFontSize(9);
    doc.text(
      `Status: ${balanco.status} · Responsável: ${balanco.responsavel} · ${new Date(balanco.iniciado_em).toLocaleString("pt-BR")}`,
      14,
      22
    );
    doc.text(
      `Itens: ${balanco.total_itens} · Divergências: ${balanco.total_divergencias} · Impacto: R$ ${Number(balanco.valor_divergencia).toFixed(2)}`,
      14,
      27
    );
    autoTable(doc, {
      startY: 32,
      head: [["Código", "Produto", "Depósito", "Sist", "Cont", "Dif", "Status", "Impacto"]],
      body: itens.map((i) => [
        i.perfume_codigo,
        i.perfume_nome,
        i.deposito,
        i.estoque_sistema,
        i.quantidade_contada ?? "",
        i.diferenca,
        i.status,
        `R$ ${Number(i.impacto_financeiro).toFixed(2)}`,
      ]),
      styles: { fontSize: 7 },
      headStyles: { fillColor: [180, 140, 50] },
    });
    doc.save(`${balanco.nome.replace(/[^a-z0-9]/gi, "_")}.pdf`);
  };

  const divergentes = itens.filter((i) => i.status === "sobra" || i.status === "falta");

  return (
    <div className="px-4 pt-4 pb-32 md:pb-12 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onBack} className="p-2 rounded-xl hover:bg-surface-raised transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <p className="page-subtitle">Detalhes</p>
            <h1 className="page-title truncate">{balanco.nome}</h1>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={exportXLSX} className="btn-secondary px-3 py-2 text-xs">
            <FileSpreadsheet size={14} /> XLSX
          </button>
          <button onClick={exportPDF} className="btn-secondary px-3 py-2 text-xs">
            <FileText size={14} /> PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Box label="Status" value={balanco.status} />
        <Box label="Itens" value={balanco.total_itens.toString()} />
        <Box label="Divergências" value={balanco.total_divergencias.toString()} />
        <Box label="Impacto" value={`R$ ${Number(balanco.valor_divergencia).toFixed(2)}`} />
      </div>

      <div className="card-premium p-5">
        <h3 className="font-display text-lg mb-3">Resumo</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          <Info label="Responsável" value={balanco.responsavel} />
          <Info label="Iniciado em" value={new Date(balanco.iniciado_em).toLocaleString("pt-BR")} />
          <Info label="Depósitos" value={balanco.depositos.join(", ")} />
          {balanco.concluido_em && (
            <Info label="Concluído em" value={new Date(balanco.concluido_em).toLocaleString("pt-BR")} />
          )}
          {balanco.ajustado_em && (
            <Info label="Ajustado em" value={`${new Date(balanco.ajustado_em).toLocaleString("pt-BR")} por ${balanco.ajustado_por}`} />
          )}
          {balanco.cancelado_em && (
            <Info label="Cancelado" value={balanco.motivo_cancelamento || "—"} />
          )}
        </div>
        {balanco.observacoes && (
          <p className="text-xs text-muted-foreground mt-3 italic">"{balanco.observacoes}"</p>
        )}
      </div>

      {divergentes.length > 0 && (
        <div className="card-premium p-5">
          <h3 className="font-display text-lg mb-3">Divergências ({divergentes.length})</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {divergentes.map((it) => (
              <div key={it.id} className="bg-surface rounded-lg p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate">{it.perfume_nome}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {it.deposito} · {it.justificativa || "Sem justificativa"}
                    {it.ajuste_aplicado && " · ✓ aplicado"}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs">{it.estoque_sistema} → {it.quantidade_contada}</p>
                  <p className={`text-[11px] font-semibold ${it.diferenca > 0 ? "text-warning" : "text-destructive"}`}>
                    {it.diferenca > 0 ? `+${it.diferenca}` : it.diferenca}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card-premium p-5">
        <h3 className="font-display text-lg mb-3 flex items-center gap-2">
          <Clock size={18} /> Auditoria
        </h3>
        <div className="space-y-3">
          {log.map((l) => (
            <div key={l.id} className="flex items-start gap-3 text-sm">
              <div className="w-2 h-2 rounded-full bg-gold mt-1.5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{ACAO_LABEL[l.acao] || l.acao}</p>
                <p className="text-xs text-muted-foreground">
                  {l.usuario} · {new Date(l.created_at).toLocaleString("pt-BR")}
                </p>
              </div>
            </div>
          ))}
          {log.length === 0 && <p className="text-xs text-muted-foreground">Sem registros</p>}
        </div>
      </div>

      {leituras.length > 0 && (
        <div className="card-premium p-5">
          <h3 className="font-display text-lg mb-3 flex items-center gap-2">
            <ScanBarcode size={18} /> Leituras de código de barras ({leituras.length})
          </h3>
          <div className="space-y-1.5 max-h-96 overflow-y-auto text-xs">
            {leituras.map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-2 bg-surface rounded-lg px-3 py-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${l.encontrado ? "bg-success" : "bg-destructive"}`} />
                  <span className="font-mono truncate">{l.codigo_lido}</span>
                  <span className="text-[10px] uppercase text-muted-foreground bg-background px-1.5 py-0.5 rounded">{l.origem}</span>
                  {l.contagem === 2 && (
                    <span className="text-[10px] text-gold bg-gold/10 px-1.5 py-0.5 rounded">2ª</span>
                  )}
                </div>
                <span className="text-muted-foreground flex-shrink-0">
                  +{l.quantidade} · {l.usuario} · {new Date(l.criado_em).toLocaleTimeString("pt-BR")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Box({ label, value }: { label: string; value: string }) {
  return (
    <div className="kpi-card">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">{label}</p>
      <p className="text-xl font-display font-semibold capitalize">{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}
