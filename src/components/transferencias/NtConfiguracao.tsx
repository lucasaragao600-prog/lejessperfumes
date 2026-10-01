import { useEffect, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useNtConfig, useSalvarNtConfig, type NtConfig } from "@/hooks/useNotasTransferencia";

const campo = "input-premium px-3 py-2 text-xs w-full";

export default function NtConfiguracao() {
  const { data } = useNtConfig();
  const salvar = useSalvarNtConfig();
  const [c, setC] = useState<NtConfig | null>(null);
  useEffect(() => { if (data) setC(data); }, [data]);
  if (!c) return null;
  const chk = (k: "ativo" | "mostrar_valores" | "nt_mesma_unidade", label: string, dica: string) => (
    <label className="flex items-start gap-2 text-xs cursor-pointer">
      <input type="checkbox" checked={c[k]} onChange={(e) => setC({ ...c, [k]: e.target.checked })} className="mt-0.5 accent-[hsl(var(--gold))]" />
      <span><span className="text-foreground">{label}</span><span className="block text-[10px] text-muted-foreground">{dica}</span></span>
    </label>
  );

  return (
    <section className="card-premium p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5"><FileText size={14} className="text-gold" /> Notas de Transferência</h2>
        <p className="text-[10px] text-muted-foreground mt-0.5">Documento interno emitido automaticamente quando mercadoria sai de uma unidade para outra.</p>
      </div>
      {chk("ativo", "Emitir notas de transferência", "Desligado: nenhuma nota é emitida e nada muda nas telas.")}
      {chk("mostrar_valores", "Mostrar valores", "Custo só aparece para quem tem a permissão de ver valores.")}
      {chk("nt_mesma_unidade", "Emitir também dentro da mesma unidade", "Por padrão, movimentos na mesma unidade não geram nota.")}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="text-[10px] text-muted-foreground space-y-1">Via padrão
          <select value={c.via_padrao} onChange={(e) => setC({ ...c, via_padrao: e.target.value as NtConfig["via_padrao"] })} className={campo}>
            <option value="todas">Todas as vias</option><option value="origem">Via da origem</option>
            <option value="destino">Via do destino</option><option value="transporte">Via do transporte</option>
          </select>
        </label>
        <label className="text-[10px] text-muted-foreground space-y-1">Formato padrão
          <select value={c.formato_padrao} onChange={(e) => setC({ ...c, formato_padrao: e.target.value as NtConfig["formato_padrao"] })} className={campo}>
            <option value="a4">PDF A4</option><option value="termica">Térmica 72 mm</option>
          </select>
        </label>
        <label className="text-[10px] text-muted-foreground space-y-1">Alertar sem recebimento após (dias)
          <input type="number" min={1} max={90} value={c.dias_alerta_recebimento} onWheel={(e) => e.currentTarget.blur()}
            onChange={(e) => setC({ ...c, dias_alerta_recebimento: Number(e.target.value) })} className={campo} />
        </label>
      </div>
      <label className="text-[10px] text-muted-foreground space-y-1 block">Rodapé da nota (opcional)
        <input maxLength={300} value={c.rodape} onChange={(e) => setC({ ...c, rodape: e.target.value })} className={campo} placeholder="Ex.: Dúvidas: (92) 0000-0000" />
      </label>
      <button disabled={salvar.isPending}
        onClick={() => salvar.mutate(c, { onSuccess: () => toast.success("Configuração das notas salva."), onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível salvar.") })}
        className="btn-primary px-4 py-2 text-xs flex items-center gap-1.5">
        {salvar.isPending && <Loader2 size={13} className="animate-spin" />} Salvar
      </button>
    </section>
  );
}
