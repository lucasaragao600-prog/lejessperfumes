import { useEffect, useMemo, useState } from "react";
import { Camera, Loader2, Minus, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/context/AppContext";
import { useUnidades } from "@/hooks/useUnidades";
import { useEstoqueUnidade, useTransferencias, type NovoItemTransferencia } from "@/hooks/useTransferencias";
import { BarcodeScannerDialog } from "@/components/BarcodeScannerDialog";
import ProdutoFoto from "@/components/ProdutoFoto";
import { categoriaLabel, produtoLabel } from "@/lib/reposicaoUtils";
import type { Perfume } from "@/data/mockData";

interface Props {
  onCriada: (id: string) => void;
  implantacaoId?: string | null;
}

export default function NovaTransferencia({ onCriada, implantacaoId = null }: Props) {
  const { unidadesTransferencia } = useUnidades({ contexto: "operacional" });
  const { isMaster } = usePermissoes();
  // Master pode enviar de unidade em implantação (correção de carga inicial).
  const elegiveis = isMaster
    ? unidadesTransferencia
    : unidadesTransferencia.filter(
        (u) => u.status !== "EM_IMPLANTACAO" && u.status !== "EM_CONFIGURACAO"
      );
  const { perfumes, tiposPerfumeConfig, concentracoesConfig } = useApp();
  const { criar } = useTransferencias();

  const [origem, setOrigem] = useState("");
  const [destino, setDestino] = useState("");
  const [observacao, setObservacao] = useState("");
  const [busca, setBusca] = useState("");
  const [scanner, setScanner] = useState(false);
  const [linhas, setLinhas] = useState<NovoItemTransferencia[]>([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!origem && elegiveis.length) setOrigem(elegiveis[0].id);
  }, [elegiveis.length]);

  const { data: saldos } = useEstoqueUnidade(origem);
  const disponivel = (id: string) => saldos?.get(id)?.disponivel ?? 0;

  const resultados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return [] as Perfume[];
    const termos = q.split(/\s+/);
    return perfumes
      .filter((p) => {
        const alvo = `${p.codigo} ${p.codigoBarras || ""} ${p.nome} ${p.marca} ${p.concentracao} ${p.volume}`.toLowerCase();
        return termos.every((t) => alvo.includes(t));
      })
      .slice(0, 20);
  }, [busca, perfumes]);

  const adicionar = (p: Perfume, qtd = 1) => {
    setLinhas((prev) => {
      const existe = prev.find((l) => l.produto_id === p.id);
      if (existe) {
        return prev.map((l) => (l.produto_id === p.id ? { ...l, quantidade: l.quantidade + qtd } : l));
      }
      return [...prev, { produto_id: p.id, produto_nome: produtoLabel(p, concentracoesConfig), quantidade: qtd }];
    });
    setBusca("");
  };

  const ajustar = (produtoId: string, qtd: number) =>
    setLinhas((prev) =>
      prev.map((l) => (l.produto_id === produtoId ? { ...l, quantidade: Math.max(1, qtd) } : l))
    );

  const remover = (produtoId: string) => setLinhas((prev) => prev.filter((l) => l.produto_id !== produtoId));

  const porCodigoBarras = (code: string) => {
    const p = perfumes.find((x) => x.codigoBarras === code || x.codigo === code);
    if (!p) {
      toast.error("Produto não encontrado para este código.");
      return;
    }
    adicionar(p);
    toast.success(`${p.nome} adicionado`);
  };

  const excedidos = linhas.filter((l) => l.quantidade > disponivel(l.produto_id));

  const salvar = async () => {
    if (!origem || !destino) return toast.error("Selecione origem e destino.");
    if (origem === destino) return toast.error("Origem e destino devem ser diferentes.");
    if (!linhas.length) return toast.error("Adicione ao menos um produto.");
    if (excedidos.length) {
      const l = excedidos[0];
      return toast.error(
        `Quantidade superior ao estoque disponível na unidade de origem. Disponível: ${disponivel(l.produto_id)} unidades.`
      );
    }
    setSalvando(true);
    try {
      const id = await criar.mutateAsync({ origem, destino, itens: linhas, observacao, implantacaoId });
      toast.success("Transferência criada em rascunho.");
      setLinhas([]);
      setObservacao("");
      onCriada(id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível criar a transferência.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-4 pb-24">
      <div className="card p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Origem</label>
            <select
              value={origem}
              onChange={(e) => setOrigem(e.target.value)}
              className="w-full mt-1 bg-surface-raised text-foreground border border-border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Selecione</option>
              {elegiveis.map((u) => (
                <option key={u.id} value={u.id}>{u.nomeExibicao}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Destino</label>
            <select
              value={destino}
              onChange={(e) => setDestino(e.target.value)}
              className="w-full mt-1 bg-surface-raised text-foreground border border-border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Selecione</option>
              {unidadesTransferencia
                .filter((u) => u.id !== origem)
                .map((u) => (
                  <option key={u.id} value={u.id}>{u.nomeExibicao}</option>
                ))}
            </select>
          </div>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por código, código de barras, marca ou nome"
              className="w-full bg-surface-raised text-foreground border border-border rounded-lg pl-9 pr-3 py-2 text-sm"
            />
          </div>
          <button onClick={() => setScanner(true)} className="px-3 rounded-lg border border-border text-muted-foreground hover:text-foreground">
            <Camera size={16} />
          </button>
        </div>

        {resultados.length > 0 && (
          <div className="border border-border rounded-lg divide-y divide-border max-h-80 overflow-y-auto bg-surface-raised">
            {resultados.map((p) => (
              <button
                key={p.id}
                onClick={() => adicionar(p)}
                className="w-full flex items-center gap-3 p-2.5 text-left hover:bg-background/60"
              >
                <ProdutoFoto url={p.imageUrl} nome={p.nome} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground truncate">{produtoLabel(p, concentracoesConfig)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {categoriaLabel(p.tipo, tiposPerfumeConfig)} · disponível na origem: {disponivel(p.id)}
                  </p>
                </div>
                <Plus size={16} className="text-gold" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="card p-4 space-y-3">
        <p className="text-sm font-medium text-foreground">Itens ({linhas.length})</p>
        {linhas.length === 0 && <p className="text-sm text-muted-foreground">Nenhum produto adicionado.</p>}
        {linhas.map((l) => {
          const disp = disponivel(l.produto_id);
          const excede = l.quantidade > disp;
          return (
            <div key={l.produto_id} className="flex items-center gap-2 border border-border rounded-lg p-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground truncate">{l.produto_nome}</p>
                <p className={`text-[11px] ${excede ? "text-destructive" : "text-muted-foreground"}`}>
                  Disponível na origem: {disp}
                </p>
              </div>
              <button onClick={() => ajustar(l.produto_id, l.quantidade - 1)} className="p-1.5 rounded border border-border text-muted-foreground">
                <Minus size={14} />
              </button>
              <input
                type="number"
                value={l.quantidade}
                onChange={(e) => ajustar(l.produto_id, Number(e.target.value) || 1)}
                onWheel={(e) => e.currentTarget.blur()}
                className="w-16 text-center bg-surface-raised text-foreground border border-border rounded-lg py-1.5 text-sm"
              />
              <button onClick={() => ajustar(l.produto_id, l.quantidade + 1)} className="p-1.5 rounded border border-border text-muted-foreground">
                <Plus size={14} />
              </button>
              <button onClick={() => remover(l.produto_id)} className="p-1.5 text-destructive">
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}

        <textarea
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          placeholder="Observação (opcional)"
          rows={2}
          className="w-full bg-surface-raised text-foreground border border-border rounded-lg px-3 py-2 text-sm"
        />

        <button onClick={salvar} disabled={salvando} className="btn-primary w-full py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2">
          {salvando ? <Loader2 size={15} className="animate-spin" /> : null}
          Criar transferência
        </button>
      </div>

      <BarcodeScannerDialog open={scanner} onClose={() => setScanner(false)} onDetected={(c) => { setScanner(false); porCodigoBarras(c); }} />
    </div>
  );
}
