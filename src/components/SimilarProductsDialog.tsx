import { AlertTriangle, X } from "lucide-react";
import type { SimilarityCandidate } from "@/lib/productSimilarity";

interface Props {
  candidates: SimilarityCandidate[];
  onRevisar: () => void;
  onContinuar: () => void;
}

export default function SimilarProductsDialog({ candidates, onRevisar, onContinuar }: Props) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-md bg-background border border-gold-muted rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
        <div className="flex items-start gap-3 px-5 pt-5 pb-3 border-b border-border">
          <div className="p-2 rounded-full bg-gold/15">
            <AlertTriangle size={18} className="text-gold" />
          </div>
          <div className="flex-1">
            <h3 className="font-display text-base text-gold">Produto similar encontrado</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Já existe(m) {candidates.length} produto(s) com características semelhantes. Deseja continuar com o cadastro mesmo assim?
            </p>
          </div>
          <button onClick={onRevisar} className="text-muted-foreground p-1">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
          {candidates.map((c) => (
            <div
              key={c.perfume.id}
              className="bg-surface border border-border rounded-xl p-3"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[10px] font-bold text-gold bg-gold/10 px-2 py-0.5 rounded">
                  {c.perfume.codigo}
                </span>
                <span className="text-[10px] font-semibold text-gold">
                  {(c.score * 100).toFixed(0)}% similar
                </span>
              </div>
              <p className="text-sm text-foreground font-medium leading-tight">
                {c.perfume.marca} — {c.perfume.nome}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {c.perfume.concentracao} · {c.perfume.volume}ml · Estoque{" "}
                {(c.perfume.estoques?.Casa || 0) +
                  (c.perfume.estoques?.Sumaúma || 0) +
                  (c.perfume.estoques?.Amazonas || 0)}
              </p>
              {c.reasons.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {c.reasons.map((r, i) => (
                    <span
                      key={i}
                      className="text-[9px] px-1.5 py-0.5 rounded bg-surface-overlay border border-border text-muted-foreground"
                    >
                      {r}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-border">
          <button
            onClick={onRevisar}
            className="flex-1 py-2.5 rounded-xl bg-surface border border-border text-foreground text-xs font-semibold"
          >
            Revisar cadastro
          </button>
          <button
            onClick={onContinuar}
            className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-primary-foreground"
            style={{ background: "var(--gradient-gold)" }}
          >
            Continuar mesmo assim
          </button>
        </div>
      </div>
    </div>
  );
}
