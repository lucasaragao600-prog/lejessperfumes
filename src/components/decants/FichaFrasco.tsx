import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { fmtBRL, fmtMl, ROTULO_MOV_ML } from "@/lib/decants";
import { resumoFicha } from "@/lib/decantsApc";

const db = supabase as any;

export function useFichaFrasco(id: string | null) {
  return useQuery({
    queryKey: ["decant-ficha-frasco", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await db.rpc("fn_decant_frasco_ficha", { p_frasco_id: id });
      if (error) throw error;
      return data as any;
    },
  });
}

const Kpi = ({ t, v, destaque }: { t: string; v: string; destaque?: boolean }) => (
  <div className="kpi-card p-3"><p className="text-xs text-muted-foreground">{t}</p><p className={`font-semibold ${destaque ? "text-gold" : ""}`}>{v}</p></div>
);

export function FichaFrasco({ frascoId, onClose }: { frascoId: string; onClose: () => void }) {
  const { data: f, isLoading, error } = useFichaFrasco(frascoId);
  const r = f ? resumoFicha(f) : null;
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader><DialogTitle>Ficha do frasco</DialogTitle></DialogHeader>
        {isLoading ? <p className="text-muted-foreground text-sm">Carregando…</p>
        : error || !f ? <p className="text-destructive text-sm">Não foi possível carregar a ficha.</p>
        : (
          <div className="space-y-4 text-sm">
            <div>
              <p className="font-mono text-gold">{f.codigo}</p>
              <p className="font-medium">{f.marca} - {f.nome} - {f.concentracao}</p>
              <p className="text-xs text-muted-foreground">{f.unidade_nome} · {fmtMl(Number(f.volume_nominal_ml))} nominal{f.dividido_em ? ` · dividido em ${new Date(f.dividido_em).toLocaleDateString("pt-BR", { timeZone: "America/Manaus" })}` : ""}</p>
            </div>

            <section>
              <h3 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Volume</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <Kpi t="Para decants" v={f.ml_decants != null ? fmtMl(Number(f.ml_decants)) : "Não dividido"} />
                <Kpi t="Granel restante" v={fmtMl(Number(f.granel_ml))} destaque />
                <Kpi t="Reservado em lotes" v={fmtMl(Number(f.reservado_lotes_ml))} />
                <Kpi t="Produzido (pronto)" v={fmtMl(Number(f.produzido_ml))} />
                <Kpi t="Vendido sob demanda" v={fmtMl(Number(f.vendido_sob_demanda_ml))} />
                <Kpi t="Perdas" v={fmtMl(Number(f.perdas_ml))} />
              </div>
            </section>

            <section>
              <h3 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Vendas sob demanda por tamanho</h3>
              {r!.tamanhos.length === 0 ? <p className="text-muted-foreground">Nenhuma venda direta deste frasco.</p> : (
                <div className="grid grid-cols-3 gap-2">
                  {r!.tamanhos.map((t) => <Kpi key={t.ml} t={`${t.ml} ml`} v={`${t.qtd} un · ${fmtBRL(t.receita)}`} />)}
                </div>
              )}
            </section>

            <section>
              <h3 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">APC</h3>
              {!f.apc ? <p className="text-muted-foreground">Sem APC reservada.</p> : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <Kpi t="Status" v={String(f.apc.status).replace(/_/g, " ")} />
                  <Kpi t="ml reservado" v={fmtMl(Number(f.apc.ml_reservado))} />
                  <Kpi t="Preço" v={fmtBRL(Number(f.apc.preco))} />
                </div>
              )}
            </section>

            <section>
              <h3 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Rentabilidade do frasco</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <Kpi t="Receita decants (sob demanda)" v={fmtBRL(Number(f.receita_decants))} />
                <Kpi t="Receita APC" v={fmtBRL(Number(f.receita_apc))} />
                <Kpi t="Receita total" v={fmtBRL(Number(f.receita_total))} destaque />
                {r!.temCusto && <>
                  <Kpi t="Custo do frasco" v={fmtBRL(Number(f.custo_frasco))} />
                  <Kpi t="Custo rateado decants" v={f.custo_rateio_decants != null ? fmtBRL(Number(f.custo_rateio_decants)) : "—"} />
                  <Kpi t="Custo rateado APC" v={f.custo_rateio_apc != null ? fmtBRL(Number(f.custo_rateio_apc)) : "—"} />
                  <Kpi t="Resultado parcial" v={fmtBRL(r!.resultado ?? 0)} destaque />
                </>}
              </div>
              {f.custo_incompleto && <p className="text-xs text-destructive mt-2">Custo incompleto: este frasco não tem custo informado, a margem não pode ser calculada.</p>}
              <p className="text-xs text-muted-foreground mt-2">Decants prontos (produzidos em lote) entram na rentabilidade por perfume, pois a venda não identifica o frasco de origem.</p>
            </section>

            <section>
              <h3 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Histórico (últimos 50)</h3>
              <div className="space-y-1">
                {(f.historico || []).map((h: any, i: number) => (
                  <div key={i} className="flex justify-between gap-2 border-b border-border/50 py-1">
                    <span>{(ROTULO_MOV_ML as any)[h.tipo] || h.tipo}<span className="block text-xs text-muted-foreground">{new Date(h.em).toLocaleString("pt-BR", { timeZone: "America/Manaus" })} · {h.por}</span></span>
                    <span className="text-right">{Number(h.ml) > 0 ? "+" : ""}{fmtMl(Number(h.ml))}<span className="block text-xs text-muted-foreground">saldo {fmtMl(Number(h.saldo))}</span></span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
