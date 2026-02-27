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
          <img src={logoLeJess} alt="Le Jess Perfumes" className="h-16 mx-auto mb-4 invert opacity-80" />
          <div className="w-6 h-6 border-2 border-gold/30 border-t-gold rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  if (hasMaster === false && !user) {
    return <PrimeiroCadastro onCreated={refreshUserData} />;
  }

  if (!user) {
    return <Login />;
  }

  if (!role) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center space-y-5">
          <h1 className="page-title">Acesso Pendente</h1>
          <p className="text-muted-foreground text-sm max-w-xs mx-auto">
            Seu acesso ainda não foi configurado. Peça ao administrador para atribuir seu perfil.
          </p>
          <p className="text-xs text-muted-foreground">Logado como: {user.email}</p>
          <button onClick={signOut} className="btn-secondary px-6 py-2.5">
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
        <SidebarNav activeTab={activeTab} onTabChange={setActiveTab} isMaster={isMaster} />

        {/* Mobile top bar */}
        <div className="md:hidden fixed top-0 left-0 right-0 z-[60] px-4 pt-3 pb-2.5 flex items-center justify-between"
          style={{ background: "hsl(var(--background))", borderBottom: "1px solid hsl(var(--border))" }}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-primary-foreground flex-shrink-0 btn-primary"
              style={{ boxShadow: "none" }}>
              {(profile?.nome || user.email || "U")[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{profile?.nome || user.email}</p>
              <p className="text-[10px] text-muted-foreground">
                {isMaster ? "Master" : "Vendedor"}{profile?.loja ? ` · ${profile.loja}` : ""}
              </p>
            </div>
          </div>
          <button onClick={signOut} className="text-[11px] text-muted-foreground hover:text-destructive transition-colors duration-150 px-2 py-1">
            Sair
          </button>
        </div>

        {/* Desktop top bar */}
        <div className="hidden md:flex fixed top-0 left-60 right-0 z-[60] px-8 py-4 items-center justify-between"
          style={{ background: "hsl(var(--background))", borderBottom: "1px solid hsl(var(--border))" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-primary-foreground btn-primary"
              style={{ boxShadow: "none" }}>
              {(profile?.nome || user.email || "U")[0].toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{profile?.nome || user.email}</p>
              <p className="text-xs text-muted-foreground">
                {isMaster ? "Master" : "Vendedor"}{profile?.loja ? ` · ${profile.loja}` : ""}
              </p>
            </div>
          </div>
          <button onClick={signOut} className="btn-secondary px-4 py-2 text-xs">
            Sair
          </button>
        </div>

        {/* Content */}
        <div className="animate-fade-in pt-14 md:pl-60 md:pt-[72px]">
          <div className="max-w-md mx-auto md:max-w-none md:px-8">
            {renderTab()}
          </div>
        </div>

        <div className="md:hidden">
          <BottomNav activeTab={activeTab} onTabChange={setActiveTab} isMaster={isMaster} />
        </div>
      </div>
    </AppProvider>
  );
};

export default Index;
