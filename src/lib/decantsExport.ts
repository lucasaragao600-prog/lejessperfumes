import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface Coluna { k: string; l: string }

const fmtCel = (v: unknown): string | number => {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    return new Date(s).toLocaleString("pt-BR", { timeZone: "America/Manaus", dateStyle: "short", timeStyle: "short" });
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.split("-").reverse().join("/");
  return s;
};

/** Exporta exatamente as colunas recebidas do servidor (que já removeu custos sem permissão). */
export function exportarRelatorio(colunas: Coluna[], linhas: Record<string, unknown>[], nome: string, formato: "csv" | "xlsx" | "pdf") {
  const arquivo = `decants_${nome}_${new Date().toISOString().slice(0, 10)}`;
  const matriz = linhas.map((l) => colunas.map((c) => fmtCel(l[c.k])));
  if (formato === "pdf") {
    const doc = new jsPDF({ orientation: colunas.length > 6 ? "landscape" : "portrait" });
    doc.setFontSize(13); doc.text(`Le Jess · Decants · ${nome.replace(/_/g, " ")}`, 14, 14);
    autoTable(doc, {
      startY: 20, head: [colunas.map((c) => c.l)],
      body: matriz.map((r) => r.map((v) => (typeof v === "number" ? v.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : v))),
      styles: { fontSize: 7 }, headStyles: { fillColor: [201, 162, 74], textColor: [25, 25, 28] },
    });
    doc.save(`${arquivo}.pdf`);
    return;
  }
  const ws = XLSX.utils.aoa_to_sheet([colunas.map((c) => c.l), ...matriz]);
  if (formato === "csv") {
    const csv = XLSX.utils.sheet_to_csv(ws, { FS: ";" });
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${arquivo}.csv`; a.click(); URL.revokeObjectURL(a.href);
    return;
  }
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Relatório"); XLSX.writeFile(wb, `${arquivo}.xlsx`);
}
