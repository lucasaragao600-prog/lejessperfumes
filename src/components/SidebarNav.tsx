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
    <aside className="hidden md:flex flex-col w-56 fixed left-0 top-0 h-full bg-surface border-r border-border z-50">
      <div className="p-4 border-b border-border">
        <img src={logoLeJess} alt="Le Jess Perfumes" className="h-10 mx-auto invert" />
      </div>
      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        {tabs.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-gold-muted text-gold shadow-gold"
                  : "text-muted-foreground hover:text-foreground hover:bg-surface-raised"
              }`}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
