import { Package, ShoppingCart, ArrowLeftRight, FlaskConical, BarChart3, Settings, Users, FileSpreadsheet, FileText, Sun, Moon, Monitor, DollarSign, ClipboardList, LineChart, Sparkles, Truck } from "lucide-react";
import logoLeJess from "@/assets/logo-le-jess.png";
import { useTheme } from "@/context/ThemeContext";

interface SidebarNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isMaster?: boolean;
}

const allTabs = [
  { id: "pdv", label: "PDV", icon: Monitor, masterOnly: false, highlight: true },
  { id: "estoque", label: "Estoque", icon: Package, masterOnly: false },
  { id: "vendas", label: "Vendas", icon: ShoppingCart, masterOnly: false },
  { id: "pedidos", label: "Pedidos", icon: ClipboardList, masterOnly: false },
  { id: "nfce-pendentes", label: "NFC-e", icon: FileText, masterOnly: false },
  { id: "movimentacoes", label: "Movimentações", icon: ArrowLeftRight, masterOnly: false },
  { id: "reposicao", label: "Reposição", icon: Truck, masterOnly: false },
  
  { id: "testers", label: "Testers", icon: FlaskConical, masterOnly: false },
  { id: "caixa", label: "Caixa", icon: DollarSign, masterOnly: false },
  { id: "notas", label: "Notas Fiscais", icon: FileText, masterOnly: true },
  { id: "dashboards", label: "Dashboard", icon: BarChart3, masterOnly: true },
  { id: "relatorios", label: "Relatórios", icon: LineChart, masterOnly: true },
  { id: "relatorios-pro", label: "Relatórios+", icon: Sparkles, masterOnly: true },
  { id: "inteligencia", label: "Inteligência", icon: Sparkles, masterOnly: true },
  { id: "importar", label: "Importar", icon: FileSpreadsheet, masterOnly: true },
  { id: "configuracoes", label: "Configurações", icon: Settings, masterOnly: true },
  { id: "usuarios", label: "Usuários", icon: Users, masterOnly: true },
];

export default function SidebarNav({ activeTab, onTabChange, isMaster = true }: SidebarNavProps) {
  const tabs = allTabs.filter((t) => !t.masterOnly || isMaster);
  const { theme, toggleTheme } = useTheme();

  return (
    <aside className="hidden md:flex flex-col w-[17rem] fixed left-0 top-0 h-full z-50"
      style={{ background: "hsl(var(--sidebar-background))", borderRight: "1px solid hsl(var(--sidebar-border))" }}>
      <div className="px-7 py-7 border-b" style={{ borderColor: "hsl(var(--sidebar-border))" }}>
        <img src={logoLeJess} alt="Le Jess Perfumes" className={`h-9 mx-auto opacity-80 ${theme === "dark" ? "invert sepia-[.12]" : ""}`} />
        <p className="mt-3 text-center text-[9px] uppercase text-muted-foreground">Maison de Parfums · Manaus</p>
      </div>
      <nav className="flex-1 py-5 px-4 space-y-0.5 overflow-y-auto">
        {tabs.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className={`group w-full flex items-center gap-3 px-4 py-2.5 rounded-sm text-sm font-medium transition-all duration-150 ${
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-surface-raised/60"
              }`}
              style={isActive ? {
                background: "hsl(var(--gold) / 0.07)",
                borderLeft: "1px solid hsl(var(--gold))",
                paddingLeft: "15px",
              } : {
                borderLeft: "1px solid transparent",
                paddingLeft: "15px",
              }}
            >
              <Icon size={17} strokeWidth={1.35} className={isActive ? "text-gold" : "group-hover:text-foreground"} />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>
      <div className="px-3 py-4 border-t" style={{ borderColor: "hsl(var(--sidebar-border))" }}>
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-sm text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-all duration-150"
          style={{ borderLeft: "3px solid transparent", paddingLeft: "13px" }}
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          <span>{theme === "dark" ? "Tema Claro" : "Tema Escuro"}</span>
        </button>
      </div>
    </aside>
  );
}
