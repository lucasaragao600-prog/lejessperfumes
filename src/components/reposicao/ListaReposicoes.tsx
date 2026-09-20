import { useMemo, useState } from "react";
import { Search, PackageSearch } from "lucide-react";
import { useReposicao, STATUS_META, type Reposicao, type ReposicaoStatus } from "@/hooks/useReposicao";
import { formatarDataHora } from "@/lib/reposicaoUtils";
import ReposicaoDetalhe from "./ReposicaoDetalhe";
import type { Deposito } from "@/data/mockData";
import { useUnidades } from "@/hooks/useUnidades";


export default function ListaReposicoes({ filtroStatus }: { filtroStatus?: ReposicaoStatus[] }) {
  const { todosNomes: DEPOSITOS, rotulo: rotuloUnidade } = useUnidades({ contexto: "historico" });
  const { reposicoes, itens } = useReposicao();
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState<string>("todos");
  const [origem, setOrigem] = useState<string>("todas");
  const [destino, setDestino] = useState<string>("todos");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [aberta, setAberta] = useState<Reposicao | null>(null);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return reposicoes.filter((r) => {
      if (filtroStatus && !filtroStatus.includes(r.status)) return false;
      if (status !== "todos" && r.status !== status) return false;
      if (origem !== "todas" && r.origem !== origem) return false;
      if (destino !== "todos" && r.destino !== destino) return false;
      const dia = r.created_at.slice(0, 10);
      if (de && dia < de) return false;
      if (ate && dia > ate) return false;
      if (!q) return true;
      const produtos = itens.filter((i) => i.reposicao_id === r.id).map((i) => i.produto_nome).join(" ");
      return `${r.codigo} ${r.origem} ${r.destino} ${r.criado_por_nome} ${r.recebido_por_nome || ""} ${produtos}`
        .toLowerCase()
        .includes(q);
    });
  }, [reposicoes, itens, busca, status, origem, destino, de, ate, filtroStatus]);

  return (
    <div className="space-y-4">
      <div className="card-premium p-4 space-y-3">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por REP-000123, produto, unidade ou usuário"
            className="input-premium w-full pl-9 bg-surface text-foreground"
          />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {!filtroStatus && (
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="input-premium bg-surface text-foreground text-xs">
              <option value="todos">Todas as situações</option>
              {Object.entries(STATUS_META).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          )}
          <select value={origem} onChange={(e) => setOrigem(e.target.value)} className="input-premium bg-surface text-foreground text-xs">
            <option value="todas">Toda origem</option>
            {DEPOSITOS.map((d) => <option key={d} value={d}>{rotuloUnidade(d)}</option>)}
          </select>
          <select value={destino} onChange={(e) => setDestino(e.target.value)} className="input-premium bg-surface text-foreground text-xs">
            <option value="todos">Todo destino</option>
            {DEPOSITOS.map((d) => <option key={d} value={d}>{rotuloUnidade(d)}</option>)}
          </select>
          <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="input-premium bg-surface text-foreground text-xs" />
          <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="input-premium bg-surface text-foreground text-xs" />
        </div>
      </div>

      {lista.length === 0 && (
        <div className="card-premium p-8 text-center text-sm text-muted-foreground">
          <PackageSearch size={28} className="mx-auto mb-3 opacity-40" />
          Nenhuma reposição encontrada.
        </div>
      )}

      <div className="space-y-2">
        {lista.map((r) => {
          const meus = itens.filter((i) => i.reposicao_id === r.id);
          const unidades = meus.reduce((s, i) => s + (i.quantidade_enviada ?? i.quantidade_solicitada), 0);
          return (
            <button
              key={r.id}
              onClick={() => setAberta(r)}
              className="card-premium w-full text-left p-4 hover:border-gold/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{r.codigo}</p>
                  <p className="text-[11px] text-muted-foreground">{r.origem} → {r.destino}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {meus.length} produto(s) · {unidades} un. · {formatarDataHora(r.created_at)}
                  </p>
                </div>
                <span className={`text-[10px] px-2 py-1 rounded-full border whitespace-nowrap ${STATUS_META[r.status]?.className}`}>
                  {STATUS_META[r.status]?.label}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {aberta && <ReposicaoDetalhe reposicao={aberta} onClose={() => setAberta(null)} />}
    </div>
  );
}
