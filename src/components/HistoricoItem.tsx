import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate, type Perfume } from "@/data/mockData";
import {
  History,
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Package,
  RefreshCw,
  ArrowLeftRight,
  DollarSign,
  FileText,
  Loader2,
} from "lucide-react";

type EventoTipo =
  | "custo"
  | "preco"
  | "compra"
  | "venda"
  | "movimentacao"
  | "ajuste";

interface Evento {
  id: string;
  tipo: EventoTipo;
  data: string; // ISO
  titulo: string;
  descricao?: string;
  valor?: number;
  variacao?: number; // pct
  quantidade?: number;
  usuario?: string;
}

interface Props {
  perfume: Perfume | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const CONFIG: Record<
  EventoTipo,
  { icon: any; color: string; bg: string; label: string }
> = {
  custo: {
    icon: DollarSign,
    color: "text-amber-400",
    bg: "bg-amber-400/10 border-amber-400/30",
    label: "Custo",
  },
  preco: {
    icon: TrendingUp,
    color: "text-blue-400",
    bg: "bg-blue-400/10 border-blue-400/30",
    label: "Preço",
  },
  compra: {
    icon: FileText,
    color: "text-success",
    bg: "bg-success/10 border-success/30",
    label: "Compra (NF)",
  },
  venda: {
    icon: ShoppingCart,
    color: "text-gold",
    bg: "bg-primary/10 border-gold-muted",
    label: "Venda",
  },
  movimentacao: {
    icon: ArrowLeftRight,
    color: "text-purple-400",
    bg: "bg-purple-400/10 border-purple-400/30",
    label: "Movimentação",
  },
  ajuste: {
    icon: RefreshCw,
    color: "text-orange-400",
    bg: "bg-orange-400/10 border-orange-400/30",
    label: "Ajuste",
  },
};

const TIPOS_FILTRO: { key: EventoTipo | "todos"; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "custo", label: "Custos" },
  { key: "preco", label: "Preços" },
  { key: "compra", label: "Compras" },
  { key: "venda", label: "Vendas" },
  { key: "movimentacao", label: "Movim." },
  { key: "ajuste", label: "Ajustes" },
];

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Manaus",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return iso;
  }
}

export default function HistoricoItem({ perfume, open, onOpenChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [filtro, setFiltro] = useState<EventoTipo | "todos">("todos");

  useEffect(() => {
    if (!open || !perfume) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const pid = perfume.id;
      try {
        const [custos, precos, notasItens, vendasRows, movs, ajustes] =
          await Promise.all([
            supabase
              .from("produto_custos")
              .select("*")
              .eq("produto_id", pid)
              .order("data", { ascending: false }),
            supabase
              .from("preco_historico")
              .select("*")
              .eq("produto_id", pid)
              .order("data", { ascending: false }),
            supabase
              .from("notas_fiscais_itens")
              .select("*, notas_fiscais!inner(numero,fornecedor,data_emissao,created_at)")
              .eq("perfume_id", pid)
              .order("created_at", { ascending: false }),
            supabase
              .from("vendas")
              .select("id,data,quantidade,preco_unitario,total,deposito,vendedora,created_at,tipo_ajuste,desconto")
              .eq("perfume_id", pid)
              .order("created_at", { ascending: false })
              .limit(200),
            supabase
              .from("movimentacoes")
              .select("*")
              .eq("perfume_id", pid)
              .order("created_at", { ascending: false })
              .limit(200),
            supabase
              .from("ajuste_auditoria")
              .select("*")
              .eq("produto_id", pid)
              .order("created_at", { ascending: false }),
          ]);

        if (cancelled) return;

        const lista: Evento[] = [];

        (custos.data || []).forEach((c: any, idx: number, arr: any[]) => {
          const anterior = arr[idx + 1]?.custo_unitario;
          const variacao =
            anterior && anterior > 0
              ? ((c.custo_unitario - anterior) / anterior) * 100
              : undefined;
          lista.push({
            id: `custo-${c.id}`,
            tipo: "custo",
            data: c.data || c.created_at,
            titulo: `Custo unitário: ${formatCurrency(c.custo_unitario)}`,
            descricao: `Origem: ${c.origem}${c.quantidade ? ` · ${c.quantidade} un.` : ""}${c.observacao ? ` · ${c.observacao}` : ""}`,
            valor: Number(c.custo_unitario),
            variacao,
          });
        });

        (precos.data || []).forEach((p: any) => {
          const variacao =
            p.preco_antigo > 0
              ? ((p.preco_novo - p.preco_antigo) / p.preco_antigo) * 100
              : undefined;
          lista.push({
            id: `preco-${p.id}`,
            tipo: "preco",
            data: p.data,
            titulo: `Preço: ${formatCurrency(p.preco_antigo)} → ${formatCurrency(p.preco_novo)}`,
            valor: Number(p.preco_novo),
            variacao,
            usuario: p.alterado_por,
          });
        });

        (notasItens.data || []).forEach((n: any) => {
          const nf = n.notas_fiscais;
          lista.push({
            id: `nf-${n.id}`,
            tipo: "compra",
            data: nf?.data_emissao || nf?.created_at,
            titulo: `NF ${nf?.numero || "?"} · ${nf?.fornecedor || ""}`,
            descricao: `${n.quantidade} un. × ${formatCurrency(n.valor_unitario)}`,
            valor: Number(n.valor_unitario) * Number(n.quantidade),
            quantidade: Number(n.quantidade),
          });
        });

        (vendasRows.data || []).forEach((v: any) => {
          lista.push({
            id: `venda-${v.id}`,
            tipo: "venda",
            data: v.created_at || v.data,
            titulo: `${v.quantidade} un. × ${formatCurrency(v.preco_unitario)} = ${formatCurrency(v.total)}`,
            descricao: `${v.deposito}${v.vendedora ? ` · ${v.vendedora}` : ""}${v.tipo_ajuste && v.tipo_ajuste !== "Nenhum" && v.desconto ? ` · ${v.tipo_ajuste} ${formatCurrency(v.desconto)}` : ""}`,
            valor: Number(v.total),
            quantidade: Number(v.quantidade),
          });
        });

        (movs.data || []).forEach((m: any) => {
          if (m.tipo === "Ajuste") return; // vai para bloco ajustes
          const dest =
            m.tipo === "Transferência"
              ? `${m.deposito_origem} → ${m.deposito_destino}`
              : m.deposito || m.deposito_origem;
          lista.push({
            id: `mov-${m.id}`,
            tipo: "movimentacao",
            data: m.created_at || m.data,
            titulo: `${m.tipo} · ${m.quantidade} un.`,
            descricao: `${dest}${m.observacao ? ` · ${m.observacao}` : ""}`,
            quantidade: Number(m.quantidade),
            usuario: m.registrado_por,
          });
        });

        (ajustes.data || []).forEach((a: any) => {
          lista.push({
            id: `ajuste-${a.id}`,
            tipo: "ajuste",
            data: a.created_at,
            titulo: `Ajuste em ${a.deposito}: ${a.quantidade_anterior} → ${a.quantidade_nova} (${a.diferenca > 0 ? "+" : ""}${a.diferenca})`,
            descricao: `Motivo: ${a.motivo}`,
            quantidade: a.diferenca,
            usuario: a.registrado_por,
          });
        });

        lista.sort(
          (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()
        );
        setEventos(lista);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, perfume]);

  const filtrados = useMemo(
    () => (filtro === "todos" ? eventos : eventos.filter((e) => e.tipo === filtro)),
    [eventos, filtro]
  );

  const resumo = useMemo(() => {
    const totVendas = eventos.filter((e) => e.tipo === "venda");
    const unVendidas = totVendas.reduce((s, e) => s + (e.quantidade || 0), 0);
    const receita = totVendas.reduce((s, e) => s + (e.valor || 0), 0);
    const totCompras = eventos.filter((e) => e.tipo === "compra");
    const unCompradas = totCompras.reduce((s, e) => s + (e.quantidade || 0), 0);
    return { unVendidas, receita, unCompradas, totalEventos: eventos.length };
  }, [eventos]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History size={18} className="text-gold" />
            Histórico do Item
          </DialogTitle>
        </DialogHeader>

        {perfume && (
          <div className="rounded-xl border border-border bg-surface-overlay p-3 flex items-center gap-3">
            {perfume.imageUrl ? (
              <img
                src={perfume.imageUrl}
                alt={perfume.nome}
                className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-surface flex items-center justify-center flex-shrink-0">
                <Package size={18} className="text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">
                {perfume.codigo} · {perfume.nome}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                {perfume.marca} · {perfume.concentracao} · {perfume.volume}ml
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground uppercase">Custo médio</p>
              <p className="text-sm font-bold text-amber-400">
                {formatCurrency(perfume.custoMedio || 0)}
              </p>
            </div>
          </div>
        )}

        {/* Resumo */}
        <div className="grid grid-cols-4 gap-2">
          <div className="rounded-lg bg-surface-overlay border border-border p-2 text-center">
            <p className="text-[9px] text-muted-foreground uppercase">Eventos</p>
            <p className="text-sm font-bold text-foreground">{resumo.totalEventos}</p>
          </div>
          <div className="rounded-lg bg-success/8 border border-success/20 p-2 text-center">
            <p className="text-[9px] text-muted-foreground uppercase">Compradas</p>
            <p className="text-sm font-bold text-success">{resumo.unCompradas}</p>
          </div>
          <div className="rounded-lg bg-primary/8 border border-gold-muted p-2 text-center">
            <p className="text-[9px] text-muted-foreground uppercase">Vendidas</p>
            <p className="text-sm font-bold text-gold">{resumo.unVendidas}</p>
          </div>
          <div className="rounded-lg bg-primary/8 border border-gold-muted p-2 text-center">
            <p className="text-[9px] text-muted-foreground uppercase">Receita</p>
            <p className="text-sm font-bold text-gold">
              {formatCurrency(resumo.receita)}
            </p>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1">
          {TIPOS_FILTRO.map((t) => (
            <button
              key={t.key}
              onClick={() => setFiltro(t.key)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-medium border whitespace-nowrap transition-colors ${
                filtro === t.key
                  ? "border-gold-muted bg-primary/10 text-gold"
                  : "border-border bg-surface-overlay text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 size={20} className="animate-spin mr-2" />
              Carregando histórico...
            </div>
          ) : filtrados.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              Nenhum evento encontrado.
            </div>
          ) : (
            <div className="relative pl-6 space-y-3">
              <div className="absolute left-[11px] top-1 bottom-1 w-px bg-border" />
              {filtrados.map((ev) => {
                const cfg = CONFIG[ev.tipo];
                const Icon = cfg.icon;
                return (
                  <div key={ev.id} className="relative">
                    <div
                      className={`absolute -left-6 top-1 w-5 h-5 rounded-full border flex items-center justify-center ${cfg.bg}`}
                    >
                      <Icon size={10} className={cfg.color} />
                    </div>
                    <div className="card-premium p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-[9px] uppercase font-semibold px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color}`}
                            >
                              {cfg.label}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {formatDateTime(ev.data)}
                            </span>
                          </div>
                          <p className="text-sm text-foreground mt-1.5">{ev.titulo}</p>
                          {ev.descricao && (
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {ev.descricao}
                            </p>
                          )}
                          {ev.usuario && (
                            <p className="text-[10px] text-muted-foreground mt-1 italic">
                              por {ev.usuario}
                            </p>
                          )}
                        </div>
                        {ev.variacao !== undefined && Number.isFinite(ev.variacao) && (
                          <div
                            className={`flex items-center gap-0.5 text-[11px] font-semibold ${
                              ev.variacao >= 0 ? "text-success" : "text-destructive"
                            }`}
                          >
                            {ev.variacao >= 0 ? (
                              <TrendingUp size={12} />
                            ) : (
                              <TrendingDown size={12} />
                            )}
                            {ev.variacao > 0 ? "+" : ""}
                            {ev.variacao.toFixed(1)}%
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
