import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useApcs, useApcStatus, useDividirFrasco, type FrascoAberto, type DecantApc } from "@/hooks/useDecants";
import { fmtBRL, fmtMl } from "@/lib/decants";
import { validarDivisao } from "@/lib/decantsApc";

const num = (v: string) => (v.trim() === "" ? NaN : Number(v.replace(",", ".")));
const blurWheel = (e: React.WheelEvent<HTMLInputElement>) => e.currentTarget.blur();
const Campo = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block space-y-1"><span className="text-xs text-muted-foreground">{label}</span>{children}</label>
);
const STATUS: Record<string, string> = {
  reservado: "Reservado", em_preparacao: "Em preparação", disponivel: "Disponível", vendido: "Vendido", cancelado: "Cancelado",
};

/** Divide o saldo real de um frasco aberto entre decants e APC (Apresentação Completa). */
export function DialogoDividirFrasco({ frascos, onClose }: { frascos: FrascoAberto[]; onClose: () => void }) {
  const dividir = useDividirFrasco();
  const [chave] = useState(() => crypto.randomUUID());
  const [id, setId] = useState("");
  const [etapa, setEtapa] = useState<"form" | "resumo">("form");
  const [f, setF] = useState({ decants: "", reservar: false, apc: "", p5: "", p8: "", p10: "", papc: "",
    condicao: "", tampa: true, caixa: false, obs: "" });
  const elegiveis = frascos.filter((x) => !x.dividido_em && x.status !== "bloqueado" && x.saldo_ml - (x.reservado_ml ?? 0) > 0);
  const bloqueados = frascos.filter((x) => !elegiveis.includes(x));
  const fr = frascos.find((x) => x.id === id);
  const disp = fr ? Math.round((fr.saldo_ml - (fr.reservado_ml ?? 0)) * 1000) / 1000 : 0;

  useEffect(() => {
    if (!fr) return;
    setF((s) => ({ ...s, decants: String(disp).replace(".", ","), apc: "" }));
    (async () => {
      const { data } = await (supabase as any).from("decant_skus").select("preco_venda, decant_tamanhos(volume_ml)").eq("produto_id", fr.produto_id);
      const preco = (v: number) => {
        const r = (data || []).find((x: any) => Number(x.decant_tamanhos?.volume_ml) === v);
        return r && Number(r.preco_venda) > 0 ? String(r.preco_venda).replace(".", ",") : "";
      };
      setF((s) => ({ ...s, p5: preco(5), p8: preco(8), p10: preco(10) }));
    })();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const mlApc = f.reservar ? num(f.apc) || 0 : 0;
  const mlDec = num(f.decants);
  const erros = useMemo(() => fr ? validarDivisao({ disponivel: disp, mlDecants: mlDec, mlApc,
    precoApc: f.reservar ? num(f.papc) : null, precos: [num(f.p5), num(f.p8), num(f.p10)] }) : ["Escolha o frasco."],
    [fr, disp, mlDec, mlApc, f.reservar, f.papc, f.p5, f.p8, f.p10]);

  const ajustarApc = (v: string) => {
    const a = num(v);
    setF((s) => ({ ...s, apc: v, decants: Number.isFinite(a) ? String(Math.max(0, Math.round((disp - a) * 1000) / 1000)).replace(".", ",") : s.decants }));
  };
  const precoOuNull = (v: string) => { const n = num(v); return Number.isFinite(n) && n > 0 ? n : null; };

  const salvar = async () => {
    if (!fr || erros.length) return;
    try {
      await dividir.mutateAsync({ frascoId: fr.id, mlDecants: mlDec, mlApc, preco5: precoOuNull(f.p5), preco8: precoOuNull(f.p8),
        preco10: precoOuNull(f.p10), precoApc: f.reservar ? precoOuNull(f.papc) : null, condicao: f.condicao, tampa: f.tampa,
        caixa: f.caixa, observacao: f.obs, chave });
      toast.success(`Frasco ${fr.codigo} dividido.`);
      onClose();
    } catch (e: any) { toast.error(e.message); setEtapa("form"); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Dividir frasco — Decants + APC</DialogTitle></DialogHeader>
        {etapa === "form" ? (
          <div className="space-y-3 text-sm">
            <Campo label="Frasco aberto">
              <select className="input-premium" value={id} onChange={(e) => setId(e.target.value)}>
                <option value="">Escolha…</option>
                {elegiveis.map((x) => <option key={x.id} value={x.id}>{x.codigo} · {x.marca} - {x.nome} {x.concentracao} · {x.unidade_nome} · {fmtMl(x.saldo_ml - (x.reservado_ml ?? 0))}</option>)}
              </select>
            </Campo>
            {elegiveis.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhum frasco pode ser dividido. Abra um frasco (botão "Abrir frasco") ou use um tester antes.
                {bloqueados.length > 0 && ` ${bloqueados.length} frasco(s) já divididos, bloqueados ou sem saldo livre.`}</p>
            )}
            {fr && (
              <>
                <div className="card-premium p-3 grid grid-cols-2 gap-1 text-xs">
                  <span className="text-muted-foreground">Volume nominal</span><span className="text-right">{fmtMl(fr.volume_nominal_ml)}</span>
                  <span className="text-muted-foreground">Saldo real disponível</span><span className="text-right font-semibold">{fmtMl(disp)}</span>
                  {(fr.reservado_ml ?? 0) > 0 && <><span className="text-muted-foreground">Reservado em lotes</span><span className="text-right">{fmtMl(fr.reservado_ml!)}</span></>}
                </div>
                <div className="flex items-center justify-between">
                  <span>Reservar APC (Apresentação Completa)</span>
                  <Switch checked={f.reservar} onCheckedChange={(v) => setF((s) => ({ ...s, reservar: v, apc: "", decants: String(disp).replace(".", ",") }))} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Campo label="ml para decants"><input className="input-premium" inputMode="decimal" value={f.decants} onWheel={blurWheel}
                    onChange={(e) => setF({ ...f, decants: e.target.value })} /></Campo>
                  {f.reservar && <Campo label="ml reservados para APC"><input className="input-premium" inputMode="decimal" value={f.apc}
                    onChange={(e) => ajustarApc(e.target.value)} /></Campo>}
                </div>
                <p className="text-xs text-muted-foreground">Os preços são manuais e valem para novas vendas. Tamanho sem preço fica bloqueado para venda.</p>
                <div className="grid grid-cols-3 gap-2">
                  <Campo label="Preço 5 ml (R$)"><input className="input-premium" inputMode="decimal" value={f.p5} onChange={(e) => setF({ ...f, p5: e.target.value })} /></Campo>
                  <Campo label="Preço 8 ml (R$)"><input className="input-premium" inputMode="decimal" value={f.p8} onChange={(e) => setF({ ...f, p8: e.target.value })} /></Campo>
                  <Campo label="Preço 10 ml (R$)"><input className="input-premium" inputMode="decimal" value={f.p10} onChange={(e) => setF({ ...f, p10: e.target.value })} /></Campo>
                </div>
                {f.reservar && (
                  <div className="space-y-2">
                    <Campo label="Preço total do APC (R$)"><input className="input-premium" inputMode="decimal" value={f.papc} onChange={(e) => setF({ ...f, papc: e.target.value })} /></Campo>
                    <Campo label="Condição do frasco"><input className="input-premium" placeholder="Ex.: usado, sem riscos" value={f.condicao} onChange={(e) => setF({ ...f, condicao: e.target.value })} /></Campo>
                    <div className="flex gap-6">
                      <label className="flex items-center gap-2"><Switch checked={f.tampa} onCheckedChange={(v) => setF({ ...f, tampa: v })} />Tampa</label>
                      <label className="flex items-center gap-2"><Switch checked={f.caixa} onCheckedChange={(v) => setF({ ...f, caixa: v })} />Caixa</label>
                    </div>
                    <Campo label="Observações de apresentação"><input className="input-premium" value={f.obs} onChange={(e) => setF({ ...f, obs: e.target.value })} /></Campo>
                  </div>
                )}
                {erros.length > 0 && <ul className="text-xs text-destructive list-disc pl-4">{erros.map((e) => <li key={e}>{e}</li>)}</ul>}
              </>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-secondary px-4 py-2" onClick={onClose}>Cancelar</button>
              <button className="btn-primary px-4 py-2" disabled={!fr || erros.length > 0} onClick={() => setEtapa("resumo")}>Conferir</button>
            </div>
          </div>
        ) : fr && (
          <div className="space-y-3 text-sm">
            <p className="font-medium">{fr.marca} - {fr.nome} {fr.concentracao} · {fr.codigo} · {fr.unidade_nome}</p>
            <div className="card-premium p-3 grid grid-cols-2 gap-1">
              <span className="text-muted-foreground">Saldo real</span><span className="text-right">{fmtMl(disp)}</span>
              <span className="text-muted-foreground">Para decants</span><span className="text-right">{fmtMl(mlDec)}</span>
              <span className="text-muted-foreground">APC</span><span className="text-right">{mlApc > 0 ? `${fmtMl(mlApc)} · ${fmtBRL(num(f.papc))}` : "Sem APC"}</span>
              {[["5 ml", f.p5], ["8 ml", f.p8], ["10 ml", f.p10]].map(([t, v]) => (
                <><span key={t + "l"} className="text-muted-foreground">Preço {t}</span><span key={t} className="text-right">{precoOuNull(v) ? fmtBRL(num(v)) : "sem preço (bloqueado)"}</span></>
              ))}
            </div>
            {mlApc > 0 && mlDec > 0 && <p className="text-xs text-muted-foreground">O APC só poderá ser entregue depois que todo o líquido de decants for retirado deste frasco.</p>}
            <div className="flex justify-end gap-2">
              <button className="btn-secondary px-4 py-2" onClick={() => setEtapa("form")}>Voltar</button>
              <button className="btn-primary px-4 py-2" disabled={dividir.isPending} onClick={salvar}>{dividir.isPending ? "Salvando…" : "Confirmar divisão"}</button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Lista de APCs com status e ações de preparação/liberação/cancelamento. */
export function PainelApc({ unidadeId }: { unidadeId: string | null }) {
  const { data: apcs = [] } = useApcs(unidadeId);
  const status = useApcStatus();
  const [cancelar, setCancelar] = useState<DecantApc | null>(null);
  const [motivo, setMotivo] = useState("");
  const ativos = apcs.filter((a) => a.status !== "cancelado");
  if (ativos.length === 0) return null;
  const mudar = async (a: DecantApc, s: string, j = "") => {
    try { await status.mutateAsync({ id: a.id, status: s, justificativa: j }); toast.success(`APC: ${STATUS[s]}`); setCancelar(null); setMotivo(""); }
    catch (e: any) { toast.error(e.message); }
  };
  return (
    <div className="card-premium p-4 space-y-2">
      <p className="text-sm font-medium">APC — Apresentações Completas</p>
      {ativos.map((a) => (
        <div key={a.id} className="border-t border-border pt-2 text-sm flex flex-wrap items-center gap-2 justify-between">
          <div className="min-w-0">
            <p className="truncate">{a.nome} — APC com {fmtMl(a.ml_reservado)} remanescentes / frasco original de {fmtMl(a.volume_nominal_ml)}</p>
            <p className="text-xs text-muted-foreground">{a.frasco_codigo} · {a.unidade_nome} · {fmtBRL(a.preco)} · {a.tem_tampa ? "com tampa" : "sem tampa"} · {a.tem_caixa ? "com caixa" : "sem caixa"}{a.condicao ? ` · ${a.condicao}` : ""}</p>
            {a.granel_ml > 0 && a.status !== "vendido" && <p className="text-xs text-destructive">Ainda há {fmtMl(a.granel_ml)} de decants dentro do frasco — APC não pode ser entregue.</p>}
          </div>
          <div className="flex items-center gap-2">
            <span className="pill pill-inactive text-xs">{STATUS[a.status]}</span>
            {a.status === "reservado" && <button className="btn-secondary px-2 py-1 text-xs" onClick={() => mudar(a, "em_preparacao")}>Em preparação</button>}
            {(a.status === "reservado" || a.status === "em_preparacao") && (
              <button className="btn-primary px-2 py-1 text-xs" disabled={a.granel_ml > 0}
                title={a.granel_ml > 0 ? "Envase ou registre o líquido de decants antes" : ""} onClick={() => mudar(a, "disponivel")}>Liberar</button>
            )}
            {a.status !== "vendido" && <button className="btn-secondary px-2 py-1 text-xs" onClick={() => setCancelar(a)}>Cancelar APC</button>}
          </div>
        </div>
      ))}
      {cancelar && (
        <Dialog open onOpenChange={() => setCancelar(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Cancelar APC</DialogTitle></DialogHeader>
            <p className="text-sm">Os {fmtMl(cancelar.ml_reservado)} voltam para o saldo de decants deste frasco. Só gestor.</p>
            <input className="input-premium" placeholder="Justificativa" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            <div className="flex justify-end gap-2">
              <button className="btn-secondary px-4 py-2" onClick={() => setCancelar(null)}>Voltar</button>
              <button className="btn-primary px-4 py-2" disabled={motivo.trim().length < 5} onClick={() => mudar(cancelar, "cancelado", motivo)}>Confirmar</button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
