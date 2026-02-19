import { useState } from "react";
import BottomNav from "@/components/BottomNav";
import Estoque from "@/pages/Estoque";
import Vendas from "@/pages/Vendas";
import Movimentacoes from "@/pages/Movimentacoes";
import Testers from "@/pages/Testers";
import Dashboards from "@/pages/Dashboards";
import Configuracoes from "@/pages/Configuracoes";
import { AppProvider } from "@/context/AppContext";

const Index = () => {
  const [activeTab, setActiveTab] = useState("estoque");

  const renderTab = () => {
    switch (activeTab) {
      case "estoque": return <Estoque />;
      case "vendas": return <Vendas />;
      case "movimentacoes": return <Movimentacoes />;
      case "testers": return <Testers />;
      case "dashboards": return <Dashboards />;
      case "configuracoes": return <Configuracoes />;
      default: return <Estoque />;
    }
  };

  return (
    <AppProvider>
      <div className="min-h-screen bg-background max-w-md mx-auto relative overflow-hidden">
        <div className="animate-fade-in">
          {renderTab()}
        </div>
        <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    </AppProvider>
  );
};

export default Index;
