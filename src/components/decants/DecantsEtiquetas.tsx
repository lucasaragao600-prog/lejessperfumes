import { useState } from "react";
import { toast } from "sonner";
import { Printer, Tag } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useModelosEtiqueta, useSalvarModeloEtiqueta, gerarEtiquetas, type LoteDecant } from "@/hooks/useDecants";
import { imprimirEtiquetas, type ModeloEtiqueta } from "@/lib/decantsEtiquetas";
import { fmtMl } from "@/lib/decants";

const blurWheel = (e: React.WheelEvent<HTMLInputElement>) => e.currentTarget.blur();

export function BotaoEtiquetasLote({ lote }: { lote: LoteDecant }) {
  const [aberto, setAberto] = useState(false);
  if (lote.status !== "concluido") return null;
  return (
    <>
      <button className="btn-secondary w-full py-2.5" onClick={() => setAberto(true)}><Printer className="w-4 h-4 mr-1 inline" />Imprimir etiquetas</button>
      {aberto && <DialogEtiquetas lote={lote} onClose={() => setAberto(false)} />}
    </>
  );
}

function DialogEtiquetas({ lote, onClose }: { lote: LoteDecant; onClose: () => void }) {
  const { data: modelos = [] } = useModelosEtiqueta();
  const ativos = modelos.filter((m) => m.ativo);
  const [modeloId, setModeloId] = useState("");
  const modelo = ativos.find((m) => m.id === modeloId) ?? ativos[0];
  const [qtd, setQtd] = useState<Record<string, string>>(() => Object.fromEntries(lote.itens.map((i) => [i.id, String(i.qtd_fisica ?? 0)])));
  const [busy, setBusy] = useState(false);
  const total = lote.itens.reduce((s, i) => s + (parseInt(qtd[i.id]) || 0), 0);

  const imprimir = async () => {
    if (!modelo) return toast.error("Cadastre um modelo de etiqueta em Configurações.");
    const itens = lote.itens.map((i) => ({ item_id: i.id, quantidade: parseInt(qtd[i.id]) || 0 })).filter((i) => i.quantidade > 0);
    if (!itens.length) return toast.error("Informe a quantidade de etiquetas.");
    setBusy(true);
    try {
      const r = await gerarEtiquetas(lote.id, itens, modelo.id);
      await imprimirEtiquetas(r.etiquetas, modelo);
      toast.success(`${r.quantidade} etiqueta(s) enviada(s) para impressão`);
      onClose();
    } catch (e: any) { toast.error(e?.message || "Não foi possível gerar as etiquetas"); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Etiquetas · <span className="font-mono">{lote.codigo}</span></DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <label className="block space-y-1"><span className="text-xs text-muted-foreground">Modelo</span>
            <select className="input-premium" value={modelo?.id ?? ""} onChange={(e) => setModeloId(e.target.value)}>
              {ativos.map((m) => <option key={m.id} value={m.id}>{m.nome} ({m.largura_mm} × {m.altura_mm} mm)</option>)}
            </select>
          </label>
          {lote.itens.map((i) => (
            <div key={i.id} className="flex items-center justify-between gap-3">
              <span>{i.sku} · {fmtMl(i.volume_ml)} <span className="text-muted-foreground">({i.qtd_fisica ?? 0} produzidas)</span></span>
              <input type="number" min={0} onWheel={blurWheel} className="input-premium w-24" value={qtd[i.id]}
                onChange={(e) => setQtd({ ...qtd, [i.id]: e.target.value })} />
            </div>
          ))}
          <p className="text-muted-foreground">Total: <b className="text-foreground">{total}</b> etiqueta(s). Cada impressão fica registrada na auditoria.</p>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button className="btn-secondary" onClick={onClose}>Fechar</button>
          <button className="btn-primary" disabled={busy || total <= 0} onClick={imprimir}>{busy ? "Gerando…" : "Imprimir"}</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ModelosEtiquetaConfig() {
  const { data: modelos = [] } = useModelosEtiqueta();
  const salvar = useSalvarModeloEtiqueta();
  const [novo, setNovo] = useState({ nome: "", largura_mm: "50", altura_mm: "30" });
  const upd = (m: ModeloEtiqueta, p: Partial<ModeloEtiqueta>) =>
    salvar.mutate({ id: m.id, ...p }, { onError: (e: any) => toast.error(e.message) });
  const criar = () => {
    const l = Number(novo.largura_mm.replace(",", ".")), a = Number(novo.altura_mm.replace(",", "."));
    if (!novo.nome.trim() || !(l >= 15 && l <= 200) || !(a >= 10 && a <= 200)) return toast.error("Informe nome, largura (15–200 mm) e altura (10–200 mm).");
    salvar.mutate({ nome: novo.nome.trim(), largura_mm: l, altura_mm: a }, {
      onSuccess: () => { toast.success("Modelo criado"); setNovo({ nome: "", largura_mm: "50", altura_mm: "30" }); },
      onError: (e: any) => toast.error(e.message),
    });
  };
  return (
    <div className="card-premium p-4 space-y-3">
      <h3 className="font-medium flex items-center gap-2"><Tag className="w-4 h-4 text-gold" />Modelos de etiqueta</h3>
      <p className="text-xs text-muted-foreground">Impressão pelo navegador no tamanho exato da etiqueta. Na impressora térmica, escolha o mesmo tamanho de papel e margem zero.</p>
      {modelos.map((m) => (
        <div key={m.id} className="flex flex-wrap items-center gap-3 border-b border-border pb-2 text-sm">
          <span className="font-medium min-w-40">{m.nome}</span>
          <span className="text-muted-foreground">{m.largura_mm} × {m.altura_mm} mm</span>
          <label className="flex items-center gap-1">QR <Switch checked={m.mostrar_qr} onCheckedChange={(v) => upd(m, { mostrar_qr: v })} /></label>
          <label className="flex items-center gap-1">Barras <Switch checked={m.mostrar_barras} onCheckedChange={(v) => upd(m, { mostrar_barras: v })} /></label>
          <label className="flex items-center gap-1">Ativo <Switch checked={m.ativo} onCheckedChange={(v) => upd(m, { ativo: v })} /></label>
        </div>
      ))}
      <div className="grid gap-2 sm:grid-cols-[1fr_6rem_6rem_auto] items-end">
        <input className="input-premium" placeholder="Nome do modelo" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} />
        <input className="input-premium" inputMode="decimal" placeholder="Largura" value={novo.largura_mm} onChange={(e) => setNovo({ ...novo, largura_mm: e.target.value })} />
        <input className="input-premium" inputMode="decimal" placeholder="Altura" value={novo.altura_mm} onChange={(e) => setNovo({ ...novo, altura_mm: e.target.value })} />
        <button className="btn-primary" onClick={criar}>Adicionar</button>
      </div>
    </div>
  );
}
