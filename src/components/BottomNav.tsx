import { Package, ShoppingCart, ArrowLeftRight, FlaskConical, BarChart3, Settings, Users, FileSpreadsheet, FileText, Sun, Moon, Monitor, DollarSign } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isMaster?: boolean;
}

const allTabs = [
  { id: "pdv", label: "PDV", icon: Monitor, masterOnly: false },
  { id: "estoque", label: "Estoque", icon: Package, masterOnly: false },
  { id: "vendas", label: "Vendas", icon: ShoppingCart, masterOnly: false },
  { id: "movimentacoes", label: "Moviment.", icon: ArrowLeftRight, masterOnly: false },
  { id: "testers", label: "Testers", icon: FlaskConical, masterOnly: false },
  { id: "notas", label: "Notas", icon: FileText, masterOnly: true },
  { id: "dashboards", label: "Dashboard", icon: BarChart3, masterOnly: true },
  { id: "importar", label: "Importar", icon: FileSpreadsheet, masterOnly: true },
  { id: "configuracoes", label: "Config.", icon: Settings, masterOnly: true },
  { id: "usuarios", label: "Usuários", icon: Users, masterOnly: true },
];

export default function BottomNav({ activeTab, onTabChange, isMaster = true }: BottomNavProps) {
  const tabs = allTabs.filter((t) => !t.masterOnly || isMaster);
  const { theme, toggleTheme } = useTheme();

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-50"
      style={{
        background: "hsl(var(--background) / 0.95)",
        backdropFilter: "blur(16px)",
        borderTop: "1px solid hsl(var(--border))",
        boxShadow: "var(--shadow-card)",
      }}>
      <div className="flex items-center overflow-x-auto scrollbar-hide px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] gap-0.5">
        {tabs.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-150 flex-shrink-0"
            >
              <div className={`p-1.5 rounded-lg transition-all duration-150 ${
                isActive ? "bg-primary/10" : "bg-transparent"
              }`}>
                <Icon
                  size={20}
                  className={`transition-colors duration-150 ${
                    isActive ? "text-gold" : "text-muted-foreground"
                  }`}
                />
              </div>
              <span className={`text-[10px] font-medium whitespace-nowrap transition-colors duration-150 ${
                isActive ? "text-gold" : "text-muted-foreground"
              }`}>
                {label}
              </span>
            </button>
          );
        })}
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-150 flex-shrink-0"
        >
          <div className="p-1.5 rounded-lg bg-transparent">
            {theme === "dark" ? (
              <Sun size={20} className="text-muted-foreground" />
            ) : (
              <Moon size={20} className="text-muted-foreground" />
            )}
          </div>
          <span className="text-[10px] font-medium whitespace-nowrap text-muted-foreground">
            {theme === "dark" ? "Claro" : "Escuro"}
          </span>
        </button>
      </div>
    </nav>
  );
}
