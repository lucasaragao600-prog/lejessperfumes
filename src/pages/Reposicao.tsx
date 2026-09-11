import { useState } from "react";
import { LayoutDashboard, Plus, ListOrdered, PackageOpen, AlertTriangle, History } from "lucide-react";
import { usePermissoes, type PermissaoKey } from "@/hooks/usePermissoes";
import { useReposicao } from "@/hooks/useReposicao";
import NovaReposicao from "@/components/reposicao/NovaReposicao";
import ListaReposicoes from "@/components/reposicao/ListaReposicoes";
import ReceberReposicao from "@/components/reposicao/ReceberReposicao";
import Divergencias from "@/components/reposicao/Divergencias";
import DashboardReposicao from "@/components/reposicao/DashboardReposicao";

type SubTab = "dashboard" | "nova" | "lista" | "receber" | "divergencias" | "historico";

const SUBTABS: { id: SubTab; label: string; icon: typeof Plus; permissao: PermissaoKey }[] = [
  { id: "dashboard", label: "Painel", icon: LayoutDashboard, permissao: "reposicao_visualizar_dashboard" },
  { id: "nova", label: "Nova", icon: Plus, permissao: "reposicao_criar" },
  { id: "lista", label: "Reposições", icon: ListOrdered, permissao: "reposicao_visualizar" },
  { id: "receber", label: "Receber", icon: PackageOpen, permissao: "reposicao_receber" },
  { id: "divergencias", label: "Divergências", icon: AlertTriangle, permissao: "reposicao_visualizar" },
  { id: "historico", label: "Histórico", icon: History, permissao: "reposicao_visualizar_historico" },
];

export default function Reposicao() {
  const { can, isLoading } = usePermissoes();
  const { reposicoes, divergencias } = useReposicao();
  const disponiveis = SUBTABS.filter((t) => can(t.permissao));
  const [tab, setTab] = useState<SubTab>("lista");

  const aguardando = reposicoes.filter((r) => ["aguardando_conferencia", "em_conferencia"].includes(r.status)).length;
  const pendentesDivergencia = divergencias.filter((d) => !d.aprovado_em).length;
  const ativa = disponiveis.some((t) => t.id === tab) ? tab : disponiveis[0]?.id;

  if (isLoading) {
    return <div className="px-4 py-10 text-center text-sm text-muted-foreground">Carregando módulo…</div>;
  }

  if (!disponiveis.length) {
    return (
      <div className="px-4 py-16 text-center space-y-2">
        <h1 className="page-title">Reposição</h1>
        <p className="text-sm text-muted-foreground">Você não tem permissão para acessar este módulo.</p>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-0 py-4 md:py-6 space-y-4 pb-24">
      <div>
        <h1 className="page-title">Reposição</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Transferência controlada entre estoques, com conferência cega e movimentação automática.
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0">
        {disponiveis.map(({ id, label, icon: Icon }) => {
          const badge = id === "receber" ? aguardando : id === "divergencias" ? pendentesDivergencia : 0;
          const isActive = ativa === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-xs whitespace-nowrap border transition-colors ${
                isActive ? "border-gold text-gold bg-gold/10" : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon size={14} />
              {label}
              {badge > 0 && (
                <span className="ml-0.5 min-w-4 h-4 px-1 rounded-full bg-destructive text-[9px] font-bold text-white flex items-center justify-center">
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {ativa === "dashboard" && <DashboardReposicao />}
      {ativa === "nova" && <NovaReposicao onCriada={() => setTab("lista")} />}
      {ativa === "lista" && <ListaReposicoes />}
      {ativa === "receber" && <ReceberReposicao />}
      {ativa === "divergencias" && <Divergencias />}
      {ativa === "historico" && <ListaReposicoes filtroStatus={["finalizada", "cancelada"]} />}
    </div>
  );
}
