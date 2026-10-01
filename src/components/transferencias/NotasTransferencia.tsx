import { useState } from "react";
import { ArrowLeft, Printer, AlertTriangle, FileText } from "lucide-react";
import { toast } from "sonner";
import { useUnidades } from "@/hooks/useUnidades";
import {
  NT_ORIGEM_LABEL, NT_STATUS_META, useNotaDetalhe, useNotasLista, useReimprimirNota, type NtStatus,
} from "@/hooks/useNotasTransferencia";
import { gerarPdfNota, imprimirTermicaNota } from "@/lib/pdf/notaTransferencia";
import { VIA_LABEL, type NtVia } from "@/lib/notaTransferencia";

const dataHora = (s?: string | null) =>
  s ? new Date(s).toLocaleString("pt-BR", { timeZone: "America/Manaus" }) : "—";
const campo = "bg-surface-raised text-foreground border border-border rounded-lg px-3 py-2 text-sm";

function Badge({ status }: { status: NtStatus }) {
  const m = NT_STATUS_META[status];
  return <span className={`text-[11px] px-2 py-0.5 rounded-full border whitespace-nowrap ${m?.className}`}>{m?.label || status}</span>;
}

function Detalhe({ id, onVoltar }: { id: string; onVoltar: () => void }) {
  const { data: nt, isLoading, error } = useNotaDetalhe(id);
  const reimprimir = useReimprimirNota();
  const [imprimindo, setImprimindo] = useState(false);
  const [via, setVia] = useState<NtVia | "todas">("todas");

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (error || !nt) return <p className="text-sm text-destructive">Não foi possível abrir a nota.</p>;

  const imprimir = async (formato: "a4" | "termica") => {
    setImprimindo(true);
    try {
      const vias: NtVia[] = via === "todas" ? ["origem", "destino", "transporte"] : [via];
      const contador = await reimprimir.mutateAsync({ id: nt.id, via: via, formato });
      if (formato === "a4") await gerarPdfNota(nt, vias, contador);
      else await imprimirTermicaNota(nt, vias[0], contador);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível imprimir.");
    } finally { setImprimindo(false); }
  };

  return (
    <div className="space-y-3">
      <button onClick={onVoltar} className="flex items-center gap-1 text-xs text-muted-foreground"><ArrowLeft size={14} /> Voltar</button>
      <div className="card p-4 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <FileText size={16} className="text-gold" />
          <span className="font-medium text-foreground">{nt.numero}</span>
          {nt.revisao > 1 && <span className="text-[11px] text-muted-foreground">rev. {nt.revisao} ({nt.tipo_nota})</span>}
          <span className="ml-auto"><Badge status={nt.status} /></span>
        </div>
        <p className="text-xs text-muted-foreground">
          {nt.origem.nome_exibicao} → {nt.destino.nome_exibicao} · {NT_ORIGEM_LABEL[nt.tipo_origem]} {nt.origem_numero}
        </p>
        {nt.cnpjs_diferentes && (
          <p className="text-[11px] text-amber-500 flex items-center gap-1">
            <AlertTriangle size={12} /> CNPJs diferentes: verificar necessidade de NF-e de transferência com o contador.
          </p>
        )}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs pt-1">
          <span className="text-muted-foreground">Emitida: <span className="text-foreground">{dataHora(nt.emitido_em)}</span></span>
          <span className="text-muted-foreground">Enviado por: <span className="text-foreground">{nt.emitido_por_nome || "—"}</span></span>
          <span className="text-muted-foreground">Separado por: <span className="text-foreground">{nt.separado_por_nome || "—"}</span></span>
          <span className="text-muted-foreground">Recebido por: <span className="text-foreground">{nt.recebido_por_nome || "—"} {nt.recebido_em ? `(${dataHora(nt.recebido_em)})` : ""}</span></span>
          {nt.status === "CANCELADA" && (
            <span className="col-span-2 text-muted-foreground">Cancelada: <span className="text-foreground">{nt.cancelado_motivo}</span></span>
          )}
        </div>
        <div className="flex items-center gap-2 pt-2 flex-wrap">
          <select value={via} onChange={(e) => setVia(e.target.value as NtVia | "todas")}
            className="bg-surface-raised text-foreground border border-border rounded-lg px-2 py-1.5 text-xs">
            <option value="todas">Todas as vias (A4)</option>
            {(Object.keys(VIA_LABEL) as NtVia[]).map((v) => <option key={v} value={v}>{VIA_LABEL[v]}</option>)}
          </select>
          <button onClick={() => imprimir("a4")} disabled={imprimindo}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-gold/40 text-gold bg-gold/5 disabled:opacity-50">
            <Printer size={14} /> {nt.reimpressoes > 0 ? "Reimprimir PDF" : "PDF A4"}
          </button>
          <button onClick={() => imprimir("termica")} disabled={imprimindo || via === "todas"}
            title={via === "todas" ? "Escolha uma via para a térmica" : ""}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-border text-muted-foreground disabled:opacity-50">
            <Printer size={14} /> Térmica 72 mm
          </button>
          {nt.reimpressoes > 0 && <span className="text-[11px] text-muted-foreground">{nt.reimpressoes} impressão(ões)</span>}
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-muted-foreground">
            <tr className="border-b border-border">
              <th className="text-left p-2">Item</th><th className="text-right p-2">Enviado</th>
              <th className="text-right p-2">Recebido</th>
              {nt.mostrar_valores && <th className="text-right p-2">Custo un.</th>}
            </tr>
          </thead>
          <tbody>
            {nt.itens.map((i) => {
              const div = i.quantidade_recebida != null && i.quantidade_enviada != null && i.quantidade_recebida !== i.quantidade_enviada;
              const u = i.unidade_medida === "ml" ? " ml" : "";
              return (
                <tr key={i.id} className="border-b border-border/50">
                  <td className="p-2"><span className="text-muted-foreground">{i.codigo} </span>{i.descricao}</td>
                  <td className="p-2 text-right">{i.quantidade_enviada == null ? "—" : `${i.quantidade_enviada}${u}`}</td>
                  <td className={`p-2 text-right ${div ? "text-destructive font-medium" : ""}`}>{i.quantidade_recebida == null ? "—" : `${i.quantidade_recebida}${u}`}</td>
                  {nt.mostrar_valores && <td className="p-2 text-right">{(i.custo_unitario ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
        {nt.conferencia_cega && <p className="text-[11px] text-muted-foreground p-2">Conferência cega: quantidades enviadas ocultas até o recebimento.</p>}
      </div>
    </div>
  );
}

export default function NotasTransferencia() {
  const { todas } = useUnidades({ contexto: "historico" });
  const [status, setStatus] = useState("");
  const [unidade, setUnidade] = useState("");
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(0);
  const [aberta, setAberta] = useState<string | null>(null);
  const { data, isLoading, error } = useNotasLista({ status, unidade, busca: busca.trim(), pagina });

  if (aberta) return <Detalhe id={aberta} onVoltar={() => setAberta(null)} />;
  const total = data?.total ?? 0;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <input value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(0); }} placeholder="Buscar NT ou número de origem" className={campo} />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPagina(0); }} className={campo}>
          <option value="">Todos os status</option>
          {Object.entries(NT_STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={unidade} onChange={(e) => { setUnidade(e.target.value); setPagina(0); }} className={campo}>
          <option value="">Todas as unidades</option>
          {todas.map((u) => <option key={u.id} value={u.id}>{u.nomeExibicao}</option>)}
        </select>
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {error && <p className="text-sm text-destructive">Não foi possível carregar as notas.</p>}
      {!isLoading && !error && total === 0 && <p className="text-sm text-muted-foreground">Nenhuma nota de transferência ainda.</p>}
      <div className="space-y-2">
        {data?.itens.map((n) => (
          <button key={n.id} onClick={() => setAberta(n.id)} className="w-full card p-3.5 text-left hover:border-gold/30 transition-colors">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">{n.numero}</span>
              {n.revisao > 1 && <span className="text-[11px] text-muted-foreground">rev. {n.revisao}</span>}
              <span className="ml-auto"><Badge status={n.status} /></span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{n.origem_nome} → {n.destino_nome} · {NT_ORIGEM_LABEL[n.tipo_origem]} {n.origem_numero}</p>
            <p className="text-[11px] text-muted-foreground">{dataHora(n.emitido_em)} · {n.total_itens} item(ns)</p>
          </button>
        ))}
      </div>
      {total > 30 && (
        <div className="flex items-center justify-center gap-3 text-xs">
          <button disabled={pagina === 0} onClick={() => setPagina(pagina - 1)} className="px-3 py-1 border border-border rounded disabled:opacity-40">Anterior</button>
          <span className="text-muted-foreground">{pagina + 1} / {Math.ceil(total / 30)}</span>
          <button disabled={(pagina + 1) * 30 >= total} onClick={() => setPagina(pagina + 1)} className="px-3 py-1 border border-border rounded disabled:opacity-40">Próxima</button>
        </div>
      )}
    </div>
  );
}
