import { memo } from "react";
import { AlertTriangle, Check, FlaskConical, History, Image, Pencil, Percent, Trash2 } from "lucide-react";
import QuickActionMenu from "@/components/QuickActionMenu";
import { formatCurrency } from "@/data/mockData";
import type { ItemEstoque } from "@/hooks/useEstoqueLista";

interface Props {
  p: ItemEstoque;
  isMaster: boolean;
  userLoja: string | null;
  todasLojas: boolean;
  depositos: string[];
  concentracaoLabel: string;
  selecaoAtiva: boolean;
  marcado: boolean;
  onToggle: (id: string) => void;
  onImagem: (p: ItemEstoque) => void;
  onParcelamento: (p: ItemEstoque) => void;
  onHistorico: (p: ItemEstoque) => void;
  onEditar: (p: ItemEstoque) => void;
  onExcluir: (p: ItemEstoque) => void;
}

function ProdutoEstoqueCardBase({
  p, isMaster, userLoja, todasLojas, depositos, concentracaoLabel, selecaoAtiva, marcado,
  onToggle, onImagem, onParcelamento, onHistorico, onEditar, onExcluir,
}: Props) {
  const qtd = p.qtd;
  const baixo = qtd <= p.estoqueMinimo;
  const testerTotal = p.testerQtd;

  return (
    <div
      onClick={selecaoAtiva ? () => onToggle(p.id) : undefined}
      className={`${baixo ? "card-alert p-4" : "card-premium p-4"} ${
        selecaoAtiva ? `cursor-pointer transition-all ${marcado ? "ring-2 ring-gold border-gold/60" : "opacity-90"}` : ""
      }`}
    >
      {selecaoAtiva && (
        <div className="flex items-center gap-2 mb-2">
          <span
            className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
              marcado ? "bg-gold border-gold text-primary-foreground" : "border-border bg-surface-overlay"
            }`}
          >
            {marcado && <Check size={12} strokeWidth={3} />}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {marcado ? "Selecionado para a lista" : "Toque para selecionar"}
          </span>
        </div>
      )}
      <div className="flex items-start gap-3 mb-3">
        <div
          onClick={selecaoAtiva ? undefined : () => p.imageUrl && onImagem(p)}
          className={`w-14 h-14 rounded-xl border border-border bg-surface-overlay flex items-center justify-center flex-shrink-0 overflow-hidden ${p.imageUrl ? "cursor-pointer hover:border-gold-muted" : ""} transition-colors`}
        >
          {p.imageUrl ? (
            <img src={p.imageUrl} alt={p.nome} loading="lazy" decoding="async" width={56} height={56} className="w-full h-full object-cover" />
          ) : (
            <Image size={22} className="text-muted-foreground opacity-40" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gold font-mono bg-primary/10 px-2 py-0.5 rounded-md">{p.codigo}</span>
            {baixo && <AlertTriangle size={12} className="text-destructive flex-shrink-0" />}
          </div>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <h3 className="font-display text-base text-foreground truncate">{p.nome}</h3>
            {p.classificacao && (
              <span
                className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${
                  p.classificacao === "Masculino"
                    ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
                    : p.classificacao === "Feminino"
                    ? "bg-pink-500/15 text-pink-400 border-pink-500/30"
                    : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                }`}
              >
                {p.classificacao}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {p.marca} · {concentracaoLabel} · {p.tamanho}{p.codigoBarras ? ` · ${p.codigoBarras}` : ""}
          </p>
        </div>

        <div className="ml-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <QuickActionMenu perfume={p} />
        </div>
      </div>

      <div className="flex items-baseline justify-center gap-2 mb-3 py-2 rounded-lg bg-surface-overlay/60">
        <span className={`text-3xl font-bold tracking-tight ${baixo ? "text-destructive" : "text-foreground"}`}>{qtd}</span>
        <span className="text-[11px] text-muted-foreground uppercase tracking-wider">unid.</span>
      </div>

      {!userLoja && todasLojas && (
        <div className="flex gap-2 mb-3">
          {depositos.map((d) => {
            const testerDeposito = p.testers[d] || 0;
            const est = (p.estoques as Record<string, number>)[d] ?? 0;
            return (
              <div key={d} className="flex-1 bg-surface-overlay rounded-lg p-2 text-center">
                <p className="text-[9px] text-muted-foreground">{d}</p>
                <p className={`text-sm font-semibold ${est <= 0 ? "text-destructive" : "text-foreground"}`}>{est}</p>
                {testerDeposito > 0 && (
                  <p className="text-[8px] text-purple-400 mt-0.5 flex items-center justify-center gap-0.5">
                    <FlaskConical size={8} /> {testerDeposito}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mb-2">
        {testerTotal > 0 ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-purple-500/8 border border-purple-500/20">
            <FlaskConical size={12} className="text-purple-400" />
            <span className="text-[11px] text-purple-400 font-medium">
              {testerTotal === 1 ? "Tester disponível" : `Testers: ${testerTotal} unidades`}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-overlay">
            <FlaskConical size={12} className="text-muted-foreground opacity-40" />
            <span className="text-[11px] text-muted-foreground">
              {userLoja ? "Sem tester nesta loja" : todasLojas ? "Sem tester" : "Sem tester neste depósito"}
            </span>
          </div>
        )}
      </div>

      {isMaster ? (
        <div className="border-t border-border pt-3">
          <div className="flex items-center justify-between mb-2.5 px-2.5 py-2 rounded-lg bg-amber-500/8 border border-amber-500/20">
            <p className="text-[10px] font-medium text-amber-400/80">Custo Médio</p>
            <p className="text-sm font-bold text-amber-400">{formatCurrency(p.custoMedio || 0)}</p>
          </div>
          <div className="grid grid-cols-3 gap-2 items-end">
            <div>
              <p className="text-[9px] text-muted-foreground">Custo unit.</p>
              <p className="text-xs text-foreground">{formatCurrency(p.custo)}</p>
            </div>
            <div>
              <p className="text-[9px] text-muted-foreground">Venda unit.</p>
              <div className="flex items-center gap-1.5">
                <p className="text-xs text-gold font-medium">{formatCurrency(p.precoVenda)}</p>
                <button
                  onClick={(e) => { e.stopPropagation(); onParcelamento(p); }}
                  className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-md border border-gold/30 text-gold/80 hover:bg-gold/10 hover:text-gold transition-colors"
                  title="Ver opções de parcelamento"
                >
                  <Percent size={9} />10x
                </button>
              </div>
            </div>
            <div className="text-right flex items-center justify-end gap-3">
              <button onClick={() => onHistorico(p)} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-gold transition-colors duration-150" title="Histórico do item">
                <History size={11} /> Histórico
              </button>
              <button onClick={() => onEditar(p)} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-gold transition-colors duration-150">
                <Pencil size={11} /> Editar
              </button>
              <button onClick={() => onExcluir(p)} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive transition-colors duration-150">
                <Trash2 size={11} /> Excluir
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="border-t border-border pt-3">
          <p className="text-[9px] text-muted-foreground">Preço de Venda</p>
          <div className="flex items-center gap-2">
            <p className="text-xs text-gold font-medium">{formatCurrency(p.precoVenda)}</p>
            <button
              onClick={(e) => { e.stopPropagation(); onParcelamento(p); }}
              className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-md border border-gold/30 text-gold/80 hover:bg-gold/10 hover:text-gold transition-colors"
              title="Ver opções de parcelamento"
            >
              <Percent size={10} />10x
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(ProdutoEstoqueCardBase);
