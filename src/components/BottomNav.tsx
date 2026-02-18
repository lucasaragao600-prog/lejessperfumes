import { Package, ShoppingCart, ArrowLeftRight, FlaskConical, BarChart3 } from "lucide-react";

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const tabs = [
  { id: "estoque", label: "Estoque", icon: Package },
  { id: "vendas", label: "Vendas", icon: ShoppingCart },
  { id: "movimentacoes", label: "Moviment.", icon: ArrowLeftRight },
  { id: "testers", label: "Testers", icon: FlaskConical },
  { id: "dashboards", label: "Dashboard", icon: BarChart3 },
];

export default function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-gold-muted"
      style={{ background: "hsl(0 0% 8%)", boxShadow: "0 -4px 24px hsl(0 0% 0% / 0.5)" }}>
      <div className="flex items-center justify-around px-1 py-2">
        {tabs.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-all duration-200 min-w-0 flex-1"
            >
              <div className={`p-1.5 rounded-lg transition-all duration-200 ${
                isActive
                  ? "bg-gold-muted shadow-gold"
                  : "bg-transparent"
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
