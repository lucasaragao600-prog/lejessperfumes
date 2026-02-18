import { useState } from "react";
import BottomNav from "@/components/BottomNav";
import Estoque from "@/pages/Estoque";
import Vendas from "@/pages/Vendas";
import Movimentacoes from "@/pages/Movimentacoes";
import Testers from "@/pages/Testers";
import Dashboards from "@/pages/Dashboards";

const tabs: Record<string, React.ReactNode> = {
  estoque: <Estoque />,
  vendas: <Vendas />,
  movimentacoes: <Movimentacoes />,
  testers: <Testers />,
  dashboards: <Dashboards />,
};

const Index = () => {
  const [activeTab, setActiveTab] = useState("estoque");

  return (
    <div className="min-h-screen bg-background max-w-md mx-auto relative overflow-hidden">
      <div className="animate-fade-in">
        {tabs[activeTab]}
      </div>
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

export default Index;
