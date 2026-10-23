import { useEffect, useState } from "react";
import { FileText, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useDevolucaoFiscal, type DevolucaoFiscalDetalhe } from "@/hooks/useDevolucaoFiscal";
import { chaveEntradaValida, STATUS_DEVOLUCAO_FISCAL } from "@/lib/devolucaoFiscal";

const notaStatus: Record<string, string> = {
  emitida: "Autorizada", autorizada: "Autorizada", pendente: "Pendente", processando: "Processando",
  rejeitada: "Rejeitada", cancelada: "Cancelada", PENDENTE_CANCELAMENTO: "Cancelamento pendente",
  PENDENTE_DEVOLUCAO_FISCAL: "Tratamento de devolução pendente",
};

export default function FiscalDevolucao({ id }: { id: string }) {
  const { detalhe, tratar } = useDevolucaoFiscal(id);
  const d = detalhe.data;
  const [editando, setEditando] = useState(false);
  const [status, setStatus] = useState<DevolucaoFiscalDetalhe["status"]>("pendente");
  const [observacao, setObservacao] = useState("");
  const [chave, setChave] = useState("");
  useEffect(() => {
    if (!d) return;
    setStatus(d.status); setObservacao(d.observacao || ""); setChave(d.chave_entrada || "");
  }, [d]);

  if (detalhe.isLoading) return <p className="text-xs text-muted-foreground">Carregando situação fiscal…</p>;
  if (detalhe.isError) return <div className="text-xs text-destructive">Não foi possível consultar o fiscal. <Button variant="ghost" size="sm" onClick={() => detalhe.refetch()}>Tentar novamente</Button></div>;
  if (!d) return null;

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((status === "documento_informado" || chave) && !chaveEntradaValida(chave)) {
      toast.error("Informe uma chave válida de NF-e de entrada (modelo 55)."); return;
    }
    try {
      await tratar.mutateAsync({ status, observacao, chave });
      setEditando(false); toast.success("Acompanhamento fiscal atualizado");
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : (erro as { message?: string })?.message || "Não foi possível atualizar o fiscal");
    }
  };

  return (
    <section className="border-t border-border pt-3 space-y-2 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold flex items-center gap-1.5"><FileText size={14} /> {STATUS_DEVOLUCAO_FISCAL[d.status] || "Fiscal pendente"}</h3>
        {d.pode_tratar && <Button variant="outline" size="sm" onClick={() => setEditando(!editando)}>{editando ? "Fechar" : "Tratar fiscal"}</Button>}
      </div>
      <p className="text-muted-foreground break-all">Venda original: {d.grupo_origem}</p>
      {d.notas_origem.length === 0 ? <p className="text-muted-foreground">Venda original sem NFC-e vinculada.</p> : d.notas_origem.map(n => (
        <div key={n.id} className="space-y-1">
          <p>NFC-e original {n.numero ? `nº ${n.numero}/${n.serie}` : ""} · {notaStatus[n.status] || n.status}</p>
          {n.chave && <p className="text-muted-foreground break-all">Chave: {n.chave}</p>}
          {n.status === "rejeitada" && n.motivo && <p className="text-destructive">{n.motivo}</p>}
        </div>
      ))}
      {d.grupo_saida && <div className="space-y-1">
        <p className="text-muted-foreground break-all">Saída dos novos produtos: {d.grupo_saida}</p>
        {d.notas_saida.length === 0 ? <p className="text-muted-foreground">Novos produtos: emissão de NFC-e pendente.</p> : d.notas_saida.map(n => <p key={n.id}>NFC-e de saída {n.numero ? `nº ${n.numero}/${n.serie}` : ""} · {notaStatus[n.status] || n.status}{n.status === "rejeitada" && n.motivo ? ` · ${n.motivo}` : ""}</p>)}
      </div>}
      {d.cnpjs_distintos === true && <p className="text-destructive">CNPJs distintos: documentação e compensação aguardam validação contábil.</p>}
      {d.cnpjs_distintos === null && <p className="text-muted-foreground">CNPJ das unidades não conferido.</p>}
      {d.chave_entrada && <p className="break-all">NF-e de entrada informada: {d.chave_entrada}</p>}
      {d.observacao && <p className="whitespace-pre-wrap break-words">{d.observacao}</p>}
      {d.atualizado_por && <p className="text-muted-foreground">Atualizado por {d.atualizado_por}{d.atualizado_em ? ` · ${new Date(d.atualizado_em).toLocaleString("pt-BR", { timeZone: "America/Manaus" })}` : ""}</p>}
      <p className="text-muted-foreground">NF-e de entrada sujeita à orientação contábil sobre CFOP, CST/CSOSN, tributos e natureza da operação. Chave informada não comprova autorização na SEFAZ.</p>
      {editando && d.pode_tratar && <form onSubmit={salvar} className="space-y-2">
        <label className="block">Situação fiscal
          <select className="input-premium w-full mt-1 text-xs" value={status} onChange={e => setStatus(e.target.value as DevolucaoFiscalDetalhe["status"])}>
            {Object.entries(STATUS_DEVOLUCAO_FISCAL).map(([valor, nome]) => <option key={valor} value={valor}>{nome}</option>)}
          </select>
        </label>
        <label className="block">Chave da NF-e de entrada
          <input className="input-premium w-full mt-1 text-xs" inputMode="numeric" maxLength={44} value={chave} onChange={e => setChave(e.target.value)} required={status === "documento_informado"} />
        </label>
        <label className="block">Observação contábil / motivo da rejeição
          <textarea className="input-premium w-full mt-1 text-xs" rows={3} minLength={15} maxLength={2000} required value={observacao} onChange={e => setObservacao(e.target.value)} />
        </label>
        <Button type="submit" size="sm" disabled={tratar.isPending}>{tratar.isPending ? <Loader2 className="animate-spin" /> : <Save />} Salvar acompanhamento</Button>
      </form>}
    </section>
  );
}