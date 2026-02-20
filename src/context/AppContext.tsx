import { createContext, useContext, type ReactNode } from "react";
import {
  type Perfume,
  type Venda,
  type Movimentacao,
  type Tester,
  type Deposito,
  type Casa,
} from "@/data/mockData";
import { usePerfumes } from "@/hooks/usePerfumes";
import { useCasas } from "@/hooks/useCasas";
import { useVendas } from "@/hooks/useVendas";
import { useMovimentacoes } from "@/hooks/useMovimentacoes";
import { useTesters } from "@/hooks/useTesters";
import { useVendedoras } from "@/hooks/useVendedoras";
import { useConfiguracoes } from "@/hooks/useConfiguracoes";

interface AppContextType {
  perfumes: Perfume[];
  setPerfumes: any;
  perfumesLoading: boolean;
  vendas: Venda[];
  setVendas: any;
  adicionarVenda: (v: Venda) => Promise<void>;
  excluirVenda: (id: string) => Promise<void>;
  movimentacoes: Movimentacao[];
  setMovimentacoes: any;
  adicionarMovimentacao: (m: Movimentacao) => Promise<void>;
  testers: Tester[];
  setTesters: any;
  adicionarTesterDB: (t: { perfumeId: string; perfumeNome: string; marca: string; deposito: Deposito; quantidade: number; custo: number; registradoPor?: string }) => Promise<void>;
  removerTesterDB: (id: string) => Promise<void>;
  casas: Casa[];
  setCasas: any;
  casasLoading: boolean;
  adicionarCasaDB: (casa: Casa) => Promise<void>;
  removerCasaDB: (sigla: string) => Promise<void>;
  vendedoras: string[];
  setVendedoras: any;
  adicionarVendedoraDB: (nome: string) => Promise<void>;
  removerVendedoraDB: (nome: string) => Promise<void>;
  tiposPerfumeConfig: Record<string, string>;
  setTiposPerfumeConfig: (updater: React.SetStateAction<Record<string, string>>) => void;
  concentracoesConfig: Record<string, string>;
  setConcentracoesConfig: (updater: React.SetStateAction<Record<string, string>>) => void;
  volumesPadrao: number[];
  setVolumesPadrao: (updater: React.SetStateAction<number[]>) => void;
  proximaLinhaPorCasa: (casaSigla: string) => number;
  baixarEstoque: (perfumeId: string, deposito: Deposito, quantidade: number) => void;
  adicionarEstoque: (perfumeId: string, deposito: Deposito, quantidade: number) => void;
  transferirEstoque: (perfumeId: string, origem: Deposito, destino: Deposito, quantidade: number) => void;
  adicionarTester: (perfumeId: string, deposito: Deposito, quantidade: number) => void;
  adicionarPerfume: (perfume: Perfume) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const {
    perfumes,
    isLoading: perfumesLoading,
    adicionarPerfume: adicionarPerfumeDB,
    baixarEstoque: baixarEstoqueDB,
    adicionarEstoque: adicionarEstoqueDB,
    transferirEstoque: transferirEstoqueDB,
    proximaLinhaPorCasa,
  } = usePerfumes();

  const { casas, isLoading: casasLoading, adicionarCasa: adicionarCasaDB, removerCasa: removerCasaDB } = useCasas();
  const { vendas, adicionarVenda, excluirVenda } = useVendas();
  const { movimentacoes, adicionarMovimentacao } = useMovimentacoes();
  const { testers, adicionarTester: adicionarTesterDB, removerTester: removerTesterDB } = useTesters();
  const { vendedoras, adicionarVendedora: adicionarVendedoraDB, removerVendedora: removerVendedoraDB } = useVendedoras();
  const { tiposPerfumeConfig, concentracoesConfig, volumesPadrao, setTiposPerfumeConfig, setConcentracoesConfig, setVolumesPadrao } = useConfiguracoes();

  const baixarEstoque = (perfumeId: string, deposito: Deposito, quantidade: number) => {
    baixarEstoqueDB(perfumeId, deposito, quantidade);
  };

  const adicionarEstoque = (perfumeId: string, deposito: Deposito, quantidade: number) => {
    adicionarEstoqueDB(perfumeId, deposito, quantidade);
  };

  const transferirEstoque = (perfumeId: string, origem: Deposito, destino: Deposito, quantidade: number) => {
    transferirEstoqueDB(perfumeId, origem, destino, quantidade);
  };

  const adicionarTester = (perfumeId: string, deposito: Deposito, quantidade: number) => {
    const p = perfumes.find((x) => x.id === perfumeId);
    if (!p) return;
    adicionarTesterDB({
      perfumeId: p.id,
      perfumeNome: p.nome,
      marca: p.marca,
      deposito,
      quantidade,
      custo: p.custo,
    });
  };

  const adicionarPerfume = (perfume: Perfume) => {
    adicionarPerfumeDB(perfume);
  };

  const noop = (() => {}) as any;

  return (
    <AppContext.Provider
      value={{
        perfumes,
        setPerfumes: noop,
        perfumesLoading,
        vendas,
        setVendas: noop,
        adicionarVenda,
        excluirVenda,
        movimentacoes,
        setMovimentacoes: noop,
        adicionarMovimentacao,
        testers,
        setTesters: noop,
        adicionarTesterDB,
        removerTesterDB,
        casas,
        setCasas: noop,
        casasLoading,
        adicionarCasaDB,
        removerCasaDB,
        vendedoras,
        setVendedoras: noop,
        adicionarVendedoraDB,
        removerVendedoraDB,
        tiposPerfumeConfig,
        setTiposPerfumeConfig,
        concentracoesConfig,
        setConcentracoesConfig,
        volumesPadrao,
        setVolumesPadrao,
        proximaLinhaPorCasa,
        baixarEstoque,
        adicionarEstoque,
        transferirEstoque,
        adicionarTester,
        adicionarPerfume,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
