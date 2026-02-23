import { useState } from "react";
import logoLeJess from "@/assets/logo-le-jess.png";
import BottomNav from "@/components/BottomNav";
import SidebarNav from "@/components/SidebarNav";
import Estoque from "@/pages/Estoque";
import Vendas from "@/pages/Vendas";
import Movimentacoes from "@/pages/Movimentacoes";
import Testers from "@/pages/Testers";
import Dashboards from "@/pages/Dashboards";
import Configuracoes from "@/pages/Configuracoes";
import Login from "@/pages/Login";
import GerenciarUsuarios from "@/pages/GerenciarUsuarios";
import ImportarPlanilha from "@/pages/ImportarPlanilha";
import { AppProvider } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";

import PrimeiroCadastro from "@/pages/PrimeiroCadastro";

const Index = () => {
  const { user, role, loading, profile, signOut, hasMaster, refreshUserData } = useAuth();
  const [activeTab, setActiveTab] = useState("estoque");

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <img src={logoLeJess} alt="Le Jess Perfumes" className="h-16 mx-auto mb-3 invert" />
          <p className="text-muted-foreground text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  // Primeiro acesso: nenhum master existe ainda
  if (hasMaster === false && !user) {
    return <PrimeiroCadastro onCreated={refreshUserData} />;
  }

  if (!user) {
    return <Login />;
  }

  // Se não tem role atribuída, mostrar mensagem
  if (!role) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center space-y-4">
          <h1 className="font-display text-2xl text-gold">Acesso Pendente</h1>
          <p className="text-muted-foreground text-sm">
            Seu acesso ainda não foi configurado. Peça ao administrador para atribuir seu perfil.
          </p>
          <p className="text-xs text-muted-foreground">Logado como: {user.email}</p>
          <button
            onClick={signOut}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-surface border border-border text-foreground"
          >
            Sair
          </button>
        </div>
      </div>
    );
  }

  const isMaster = role === "master";

  const renderTab = () => {
    switch (activeTab) {
      case "estoque": return <Estoque isMaster={isMaster} />;
      case "vendas": return <Vendas />;
      case "movimentacoes": return <Movimentacoes />;
      case "testers": return <Testers isMaster={isMaster} />;
      case "dashboards": return isMaster ? <Dashboards /> : <Estoque isMaster={false} />;
      case "importar": return isMaster ? <ImportarPlanilha /> : <Estoque isMaster={false} />;
      case "configuracoes": return isMaster ? <Configuracoes /> : <Estoque isMaster={false} />;
      case "usuarios": return isMaster ? <GerenciarUsuarios /> : <Estoque isMaster={false} />;
      default: return <Estoque isMaster={isMaster} />;
    }
  };

  return (
    <AppProvider>
      <div className="min-h-screen bg-background relative">
        {/* Desktop sidebar */}
        <SidebarNav activeTab={activeTab} onTabChange={setActiveTab} isMaster={isMaster} />

        {/* Mobile top bar */}
        <div className="md:hidden fixed top-0 left-0 right-0 z-[60] px-4 pt-3 pb-2 flex items-center justify-between"
          style={{ background: "hsl(0 0% 7%)" }}>
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-primary-foreground flex-shrink-0"
              style={{ background: "var(--gradient-gold)" }}>
              {(profile?.nome || user.email || "U")[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{profile?.nome || user.email}</p>
              <p className="text-[10px] text-muted-foreground">
                {isMaster ? "Master" : "Vendedor"}{profile?.loja ? ` · ${profile.loja}` : ""}
              </p>
            </div>
          </div>
          <button onClick={signOut} className="text-[10px] text-muted-foreground hover:text-destructive transition-colors px-2 py-1">
            Sair
          </button>
        </div>

        {/* Desktop top bar */}
        <div className="hidden md:flex fixed top-0 left-56 right-0 z-[60] px-6 py-3 items-center justify-between border-b border-border"
          style={{ background: "hsl(0 0% 7%)" }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-primary-foreground"
              style={{ background: "var(--gradient-gold)" }}>
              {(profile?.nome || user.email || "U")[0].toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{profile?.nome || user.email}</p>
              <p className="text-xs text-muted-foreground">
                {isMaster ? "Master" : "Vendedor"}{profile?.loja ? ` · ${profile.loja}` : ""}
              </p>
            </div>
          </div>
          <button onClick={signOut} className="text-xs text-muted-foreground hover:text-destructive transition-colors px-3 py-1.5 rounded-lg hover:bg-surface-raised">
            Sair
          </button>
        </div>

        {/* Content */}
        <div className="animate-fade-in pt-14 md:pl-56 md:pt-16">
          <div className="max-w-md mx-auto md:max-w-none md:px-6">
            {renderTab()}
          </div>
        </div>

        {/* Mobile bottom nav */}
        <div className="md:hidden">
          <BottomNav activeTab={activeTab} onTabChange={setActiveTab} isMaster={isMaster} />
        </div>
      </div>
    </AppProvider>
  );
};

export default Index;
