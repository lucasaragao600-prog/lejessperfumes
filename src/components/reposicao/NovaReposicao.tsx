import { useMemo, useState, useEffect } from "react";
import { Plus, Minus, Trash2, Camera, Search, Loader2, PackagePlus } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useReposicao } from "@/hooks/useReposicao";
import { BarcodeScannerDialog } from "@/components/BarcodeScannerDialog";
import ProdutoFoto from "@/components/ProdutoFoto";
import { agruparPorCategoria, calcularReservas, categoriaLabel, produtoLabel } from "@/lib/reposicaoUtils";
import type { Deposito, Perfume } from "@/data/mockData";
import { useUnidades } from "@/hooks/useUnidades";


interface LinhaItem {
  produto_id: string;
  produto_nome: string;
  categoria: string;
  quantidade: number;
}

export default function NovaReposicao({ onCriada }: { onCriada: () => void }) {
  const { unidadesTransferencia } = useUnidades({ contexto: "operacional" });
  const DEPOSITOS = unidadesTransferencia.map((u) => u.codigoLegado || u.codigo);
  const { perfumes, tiposPerfumeConfig, concentracoesConfig } = useApp();
  const { profile, user } = useAuth();
  const { reposicoes, itens: todosItens, criar } = useReposicao();

  const [origem, setOrigem] = useState<Deposito>("");
  const [destino, setDestino] = useState<Deposito>("");
  useEffect(() => {
    if (DEPOSITOS.length === 0) return;
    if (!origem) setOrigem(DEPOSITOS[0]);
    if (!destino) setDestino(DEPOSITOS.find((d) => d !== DEPOSITOS[0]) || "");
  }, [DEPOSITOS.length]);
  const [observacoes, setObservacoes] = useState("");
  const [busca, setBusca] = useState("");
  const [linhas, setLinhas] = useState<LinhaItem[]>([]);
  const [scanner, setScanner] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const usuario = { id: user?.id, nome: profile?.nome || user?.email || "Sistema" };
  const reservas = useMemo(() => calcularReservas(reposicoes, todosItens), [reposicoes, todosItens]);

  const disponivel = (p: Perfume) =>
    Math.max(0, (p.estoques[origem] || 0) - (reservas[p.id]?.[origem] || 0));

  const resultados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return [];
    const termos = q.split(/\s+/);
    return perfumes
      .filter((p) => {
        const alvo = `${p.codigo} ${p.codigoBarras || ""} ${p.nome} ${p.marca} ${categoriaLabel(p.tipo, tiposPerfumeConfig)}`.toLowerCase();
        return termos.every((t) => alvo.includes(t));
      })
      .slice(0, 20);
  }, [busca, perfumes, tiposPerfumeConfig]);

  const adicionar = (p: Perfume, qtd = 1) => {
    setLinhas((prev) => {
      const existente = prev.find((l) => l.produto_id === p.id);
      if (existente) {
        return prev.map((l) => (l.produto_id === p.id ? { ...l, quantidade: l.quantidade + qtd } : l));
      }
      return [
        ...prev,
        {
          produto_id: p.id,
          produto_nome: produtoLabel(p, concentracoesConfig),
          categoria: categoriaLabel(p.tipo, tiposPerfumeConfig),
          quantidade: qtd,
        },
      ];
    });
    setBusca("");
  };

  const onScan = (codigo: string) => {
    const p = perfumes.find((x) => (x.codigoBarras || "").trim() === codigo.trim());
    if (!p) {
      toast.error("Produto não encontrado para este código de barras.");
      return;
    }
    adicionar(p, 1);
    toast.success(`${p.nome} adicionado`);
  };

  const alterarQtd = (produtoId: string, delta: number) =>
    setLinhas((prev) =>
      prev
        .map((l) => (l.produto_id === produtoId ? { ...l, quantidade: Math.max(0, l.quantidade + delta) } : l))
        .filter((l) => l.quantidade > 0)
    );

  const grupos = agruparPorCategoria(linhas.map((l) => ({ ...l, produto_nome: l.produto_nome })));
  const totalUnidades = linhas.reduce((s, l) => s + l.quantidade, 0);

  const salvar = async () => {
    if (origem === destino) return toast.error("Origem e destino não podem ser iguais.");
    if (!linhas.length) return toast.error("Adicione pelo menos um produto.");
    for (const l of linhas) {
      const p = perfumes.find((x) => x.id === l.produto_id);
      if (p && l.quantidade > disponivel(p)) {
        return toast.error(`${p.nome}: quantidade maior que o disponível em ${origem} (${disponivel(p)}).`);
      }
    }
    setSalvando(true);
    try {
      await criar({
        origem,
        destino,
        observacoes,
        usuario,
        itens: linhas.map((l) => ({
          produto_id: l.produto_id,
          produto_nome: l.produto_nome,
          categoria: l.categoria,
          quantidade: l.quantidade,
        })),
      });
      toast.success("Reposição criada e enviada para separação.");
      setLinhas([]);
      setObservacoes("");
      onCriada();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível criar a reposição.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-4 pb-28">
      <div className="card-premium p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] text-muted-foreground block mb-1">Origem</label>
            <select
              value={origem}
              onChange={(e) => setOrigem(e.target.value as Deposito)}
              className="input-premium w-full bg-surface text-foreground"
            >
              {DEPOSITOS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground block mb-1">Destino</label>
            <select
              value={destino}
              onChange={(e) => setDestino(e.target.value as Deposito)}
              className="input-premium w-full bg-surface text-foreground"
            >
              {DEPOSITOS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>
        {origem === destino && (
          <p className="text-xs text-destructive">Selecione unidades diferentes para origem e destino.</p>
        )}
      </div>

      <div className="card-premium p-4 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, SKU, código de barras, marca ou categoria"
              className="input-premium w-full pl-9 bg-surface text-foreground"
            />
          </div>
          <button onClick={() => setScanner(true)} className="btn-secondary px-3 flex items-center gap-2" title="Ler código de barras">
            <Camera size={16} />
          </button>
        </div>

        {resultados.length > 0 && (
          <div className="max-h-72 overflow-y-auto rounded-xl border border-border divide-y divide-border">
            {resultados.map((p) => (
              <button
                key={p.id}
                onClick={() => adicionar(p)}
                className="w-full text-left px-3 py-2.5 hover:bg-surface-raised transition-colors flex items-center gap-3"
              >
                <ProdutoFoto url={p.imageUrl} nome={p.nome} />
                <div className="min-w-0">
                  <p className="text-sm text-foreground">{produtoLabel(p, concentracoesConfig)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {categoriaLabel(p.tipo, tiposPerfumeConfig)} · disponível em {origem}: {disponivel(p)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {grupos.map((g) => (
        <div key={g.categoria} className="card-premium p-4 space-y-2">
          <p className="text-xs font-semibold text-gold tracking-wide">{g.categoria}</p>
          {g.itens.map((item) => {
            const p = perfumes.find((x) => x.id === item.produto_id);
            const excede = p ? item.quantidade > disponivel(p) : false;
            return (
              <div key={item.produto_id} className="rounded-xl border border-border p-3 space-y-2">
                <div className="flex items-center gap-3">
                  <ProdutoFoto url={p?.imageUrl} nome={item.produto_nome} />
                  <p className="text-sm text-foreground break-words flex-1">{item.produto_nome}</p>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className={`text-[11px] ${excede ? "text-destructive" : "text-muted-foreground"}`}>
                    Disponível em {origem}: {p ? disponivel(p) : 0}
                  </span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => alterarQtd(item.produto_id, -1)} className="btn-secondary w-9 h-9 flex items-center justify-center">
                      <Minus size={14} />
                    </button>
                    <span className="w-8 text-center text-sm font-semibold text-foreground">{item.quantidade}</span>
                    <button onClick={() => alterarQtd(item.produto_id, 1)} className="btn-secondary w-9 h-9 flex items-center justify-center">
                      <Plus size={14} />
                    </button>
                    <button
                      onClick={() => setLinhas((prev) => prev.filter((l) => l.produto_id !== item.produto_id))}
                      className="w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {linhas.length === 0 && (
        <div className="card-premium p-8 text-center text-sm text-muted-foreground">
          <PackagePlus size={28} className="mx-auto mb-3 opacity-40" />
          Busque ou bipe os produtos para montar a reposição.
        </div>
      )}

      <div className="card-premium p-4 space-y-3">
        <label className="text-[11px] text-muted-foreground block">Observações</label>
        <textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          rows={2}
          className="input-premium w-full bg-surface text-foreground"
          placeholder="Opcional"
        />
      </div>

      <div className="fixed bottom-16 md:bottom-0 left-0 right-0 md:left-60 px-4 py-3 bg-background border-t border-border flex items-center justify-between gap-3 z-40">
        <div className="text-xs text-muted-foreground">
          {linhas.length} produto(s) · <span className="text-foreground font-semibold">{totalUnidades} un.</span>
        </div>
        <button onClick={salvar} disabled={salvando} className="btn-primary px-6 py-2.5 flex items-center gap-2">
          {salvando ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
          Criar reposição
        </button>
      </div>

      <BarcodeScannerDialog open={scanner} onClose={() => setScanner(false)} onDetected={onScan} />
    </div>
  );
}
