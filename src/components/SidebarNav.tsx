import { Package, ShoppingCart, ArrowLeftRight, FlaskConical, BarChart3, Settings, Users, FileSpreadsheet } from "lucide-react";
import logoLeJess from "@/assets/logo-le-jess.png";

interface SidebarNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isMaster?: boolean;
}

const allTabs = [
  { id: "estoque", label: "Estoque", icon: Package, masterOnly: false },
  { id: "vendas", label: "Vendas", icon: ShoppingCart, masterOnly: false },
  { id: "movimentacoes", label: "Movimentações", icon: ArrowLeftRight, masterOnly: false },
  { id: "testers", label: "Testers", icon: FlaskConical, masterOnly: false },
  { id: "dashboards", label: "Dashboard", icon: BarChart3, masterOnly: true },
  { id: "importar", label: "Importar", icon: FileSpreadsheet, masterOnly: true },
  { id: "configuracoes", label: "Configurações", icon: Settings, masterOnly: true },
  { id: "usuarios", label: "Usuários", icon: Users, masterOnly: true },
];

export default function SidebarNav({ activeTab, onTabChange, isMaster = true }: SidebarNavProps) {
  const tabs = allTabs.filter((t) => !t.masterOnly || isMaster);

  return (
    <aside className="hidden md:flex flex-col w-60 fixed left-0 top-0 h-full z-50"
      style={{ background: "hsl(var(--sidebar-background))", borderRight: "1px solid hsl(var(--sidebar-border))" }}>
      <div className="px-6 py-5 border-b" style={{ borderColor: "hsl(var(--sidebar-border))" }}>
        <img src={logoLeJess} alt="Le Jess Perfumes" className="h-10 mx-auto invert opacity-90" />
      </div>
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {tabs.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-surface-raised"
              }`}
              style={isActive ? {
                background: "hsl(43 74% 49% / 0.08)",
                borderLeft: "3px solid hsl(var(--gold))",
                paddingLeft: "13px",
              } : {
                borderLeft: "3px solid transparent",
                paddingLeft: "13px",
              }}
            >
              <Icon size={18} className={isActive ? "text-gold" : ""} />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
