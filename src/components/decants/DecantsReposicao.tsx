import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Bell, CheckCircle2, Factory } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useUnidades } from "@/hooks/useUnidades";
import { useQueryClient } from "@tanstack/react-query";
import { useReposicaoDecant, useAlertasDecant, useCriarLote, type ReposicaoLinha } from "@/hooks/useDecants";
import { fmtMl } from "@/lib/decants";

function FiltroFilial({ v, set }: { v: string; set: (s: string) => void }) {
  const { unidadesEstoque } = useUnidades();
  return (
    <select className="input-premium max-w-xs" value={v} onChange={(e) => set(e.target.value)}>
      <option value="">Todas as filiais</option>
      {unidadesEstoque.map((u) => <option key={u.id} value={u.id}>{u.nomeExibicao}</option>)}
    </select>
  );
}

export function AbaReposicaoDecant() {
  const [filial, setFilial] = useState("");
  const q = useReposicaoDecant(filial || null);
  const [sel, setSel] = useState<ReposicaoLinha | null>(null);
  const linhas = q.data ?? [];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Decants no mínimo ou abaixo. Sugestão = ideal − atual − já em produção.</p>
        <FiltroFilial v={filial} set={setFilial} />
      </div>
      {q.isLoading ? <div className="card-premium p-6 animate-pulse h-32" />
        : q.isError ? <div className="card-premium p-6 text-destructive text-sm">Não foi possível carregar a reposição.</div>
        : linhas.length === 0 ? (
          <div className="card-premium p-10 text-center text-muted-foreground">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-gold" />Nenhum decant precisa de reposição agora.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {linhas.map((l) => (
              <div key={l.sku_id + l.unidade_id} className="card-premium p-4 space-y-2">
                <div className="flex justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{l.perfume}</p>
                    <p className="text-xs text-muted-foreground">{l.sku} · {l.tamanho} · {l.filial}</p>
                  </div>
                  <span className="pill pill-active h-fit whitespace-nowrap">Produzir {l.sugerido}</span>
                </div>
                <div className="grid grid-cols-4 gap-1 text-center text-xs">
                  {[["Mínimo", l.minimo], ["Ideal", l.ideal], ["Atual", l.atual], ["Em produção", l.em_producao]].map(([t, v]) => (
                    <div key={t as string} className="rounded-md bg-muted/40 p-1.5"><p className="text-muted-foreground">{t}</p><p className="font-semibold">{v}</p></div>
                  ))}
                </div>
                <p className="text-xs">Precisa {fmtMl(Number(l.ml_necessario))} · disponível {fmtMl(Number(l.ml_disponivel))}</p>
                {Number(l.deficit_ml) > 0 && (
                  <p className="text-xs text-destructive flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Faltam {fmtMl(Number(l.deficit_ml))}</p>
                )}
                <button className="btn-gold w-full" onClick={() => setSel(l)}><Factory className="w-4 h-4 mr-1 inline" />Produzir</button>
              </div>
            ))}
          </div>
        )}
      {sel && <DialogProduzir l={sel} onClose={() => setSel(null)} />}
    </div>
  );
}

function DialogProduzir({ l, onClose }: { l: ReposicaoLinha; onClose: () => void }) {
  const criar = useCriarLote();
  const qc = useQueryClient();
  const [chave] = useState(() => crypto.randomUUID());
  const qtd = l.produzivel;
  const falta = Number(l.deficit_ml) > 0;
  const confirmar = () => {
    if (qtd <= 0) return;
    criar.mutate(
      { produtoId: l.produto_id, unidadeId: l.unidade_id, itens: [{ tamanho_id: l.tamanho_id, quantidade: qtd }], frascos: null,
        responsavel: "", observacao: `Reposição sugerida ${l.sku}`, chave },
      {
        onSuccess: (r: any) => {
          toast.success(`Ordem ${r?.codigo ?? ""} criada como Planejado, com ml reservado`);
          qc.invalidateQueries({ queryKey: ["decant-reposicao"] }); qc.invalidateQueries({ queryKey: ["decant-alertas"] });
          onClose();
        },
        onError: (e: any) => toast.error(e?.message || "Não foi possível criar a ordem"),
      },
    );
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Produzir {l.sku}</DialogTitle></DialogHeader>
        <div className="space-y-2 text-sm">
          <p className="text-muted-foreground">{l.perfume} · {l.tamanho} · {l.filial}</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="card-premium p-3"><p className="text-xs text-muted-foreground">Volume necessário</p><p className="font-semibold">{fmtMl(Number(l.ml_necessario))}</p></div>
            <div className="card-premium p-3"><p className="text-xs text-muted-foreground">Volume disponível</p><p className="font-semibold">{fmtMl(Number(l.ml_disponivel))}</p></div>
          </div>
          <p>Frasco sugerido: <b>{l.frasco_sugerido ? `${l.frasco_sugerido.codigo} (${fmtMl(Number(l.frasco_sugerido.disponivel_ml))} livres)` : "nenhum frasco aberto com saldo"}</b></p>
          {falta && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-destructive text-xs space-y-1">
              <p>Volume insuficiente para as {l.sugerido} un sugeridas: faltam {fmtMl(Number(l.deficit_ml))}.</p>
              <p>{l.frascos_fechados > 0 ? `Há ${l.frascos_fechados} frasco(s) fechado(s) reservado(s) nesta filial: abra um novo frasco em "Frascos Abertos".` : "Não há frasco fechado reservado nesta filial: reserve/abra um novo frasco."}</p>
            </div>
          )}
          <p>Ordem a criar: <b>{qtd} un</b>{falta && qtd > 0 ? " (o máximo possível com o ml atual)" : ""}.</p>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button className="btn-outline-gold" onClick={onClose}>Fechar</button>
          <button className="btn-gold" disabled={qtd <= 0 || criar.isPending} onClick={confirmar}>
            {criar.isPending ? "Criando…" : "Criar ordem de produção"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PainelAlertasDecant({ onIr }: { onIr: (aba: string) => void }) {
  const q = useAlertasDecant(null);
  const ativos = (q.data?.alertas ?? []).filter((a) => a.qtd > 0);
  if (q.isLoading) return <div className="card-premium p-4 animate-pulse h-20" />;
  if (q.isError) return null;
  return (
    <div className="card-premium p-4 space-y-3">
      <h3 className="font-medium flex items-center gap-2"><Bell className="w-4 h-4 text-gold" />Alertas{q.data?.total ? ` (${q.data.total})` : ""}</h3>
      {ativos.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum alerta no momento.</p> : (
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {ativos.map((a) => (
            <button key={a.tipo} onClick={() => onIr(a.aba)} className="text-left rounded-lg border border-border p-3 hover:border-gold transition-colors">
              <div className="flex justify-between gap-2"><span className="font-medium text-sm">{a.titulo}</span><span className="pill pill-active">{a.qtd}</span></div>
              <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                {a.itens.slice(0, 3).map((i, k) => <li key={k} className="truncate">{i.ref} · {i.filial} — {i.detalhe}</li>)}
                {a.itens.length > 3 && <li>+ {a.itens.length - 3} outros</li>}
              </ul>
            </button>
          ))}
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">"Produto indisponível no site" fica pendente até a plataforma do site ser confirmada.</p>
    </div>
  );
}
