import { Package, ShoppingCart, ArrowLeftRight, FlaskConical, BarChart3, Settings, Users } from "lucide-react";

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isMaster?: boolean;
}

const allTabs = [
  { id: "estoque", label: "Estoque", icon: Package, masterOnly: false },
  { id: "vendas", label: "Vendas", icon: ShoppingCart, masterOnly: false },
  { id: "movimentacoes", label: "Moviment.", icon: ArrowLeftRight, masterOnly: false },
  { id: "testers", label: "Testers", icon: FlaskConical, masterOnly: false },
  { id: "dashboards", label: "Dashboard", icon: BarChart3, masterOnly: true },
  { id: "configuracoes", label: "Config.", icon: Settings, masterOnly: true },
  { id: "usuarios", label: "Usuários", icon: Users, masterOnly: true },
];

export default function BottomNav({ activeTab, onTabChange, isMaster = true }: BottomNavProps) {
  const tabs = allTabs.filter((t) => !t.masterOnly || isMaster);

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-50 border-t border-gold-muted"
      style={{ background: "hsl(0 0% 8%)", boxShadow: "0 -4px 24px hsl(0 0% 0% / 0.5)" }}>
      <div className="flex items-center justify-around px-1 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {tabs.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-all duration-200 min-w-0 flex-1"
            >
              <div className={`p-1.5 rounded-lg transition-all duration-200 ${
                isActive ? "bg-gold-muted shadow-gold" : "bg-transparent"
              }`}>
                <Icon
                  size={20}
                  className={`transition-colors duration-200 ${
                    isActive ? "text-gold" : "text-muted-foreground"
                  }`}
                />
              </div>
              <span className={`text-[10px] font-medium truncate transition-colors duration-200 ${
                isActive ? "text-gold" : "text-muted-foreground"
              }`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
