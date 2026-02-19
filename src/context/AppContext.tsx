import { createContext, useContext, useState, type ReactNode } from "react";
import {
  vendas as vendasIniciais,
  movimentacoes as movsIniciais,
  testers as testersIniciais,
  TIPOS_PERFUME,
  CONCENTRACOES,
  VOLUMES_PADRAO,
  type Perfume,
  type Venda,
  type Movimentacao,
  type Tester,
  type Deposito,
  type Casa,
  type TipoPerfume,
  type Concentracao,
} from "@/data/mockData";
import { usePerfumes } from "@/hooks/usePerfumes";
import { useCasas } from "@/hooks/useCasas";

interface AppContextType {
  perfumes: Perfume[];
  setPerfumes: React.Dispatch<React.SetStateAction<Perfume[]>>;
  perfumesLoading: boolean;
  vendas: Venda[];
  setVendas: React.Dispatch<React.SetStateAction<Venda[]>>;
  movimentacoes: Movimentacao[];
  setMovimentacoes: React.Dispatch<React.SetStateAction<Movimentacao[]>>;
  testers: Tester[];
  setTesters: React.Dispatch<React.SetStateAction<Tester[]>>;
  casas: Casa[];
  setCasas: React.Dispatch<React.SetStateAction<Casa[]>>;
  casasLoading: boolean;
  adicionarCasaDB: (casa: Casa) => Promise<void>;
  removerCasaDB: (sigla: string) => Promise<void>;
  vendedoras: string[];
  setVendedoras: React.Dispatch<React.SetStateAction<string[]>>;
  tiposPerfumeConfig: Record<string, string>;
  setTiposPerfumeConfig: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  concentracoesConfig: Record<string, string>;
  setConcentracoesConfig: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  volumesPadrao: number[];
  setVolumesPadrao: React.Dispatch<React.SetStateAction<number[]>>;
  proximaLinhaPorCasa: (casaSigla: string) => number;
  baixarEstoque: (perfumeId: string, deposito: Deposito, quantidade: number) => void;
  adicionarEstoque: (perfumeId: string, deposito: Deposito, quantidade: number) => void;
  transferirEstoque: (perfumeId: string, origem: Deposito, destino: Deposito, quantidade: number) => void;
  adicionarTester: (perfumeId: string, deposito: Deposito, quantidade: number) => void;
  adicionarPerfume: (perfume: Perfume) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  // DB-backed state
  const {
    perfumes,
    isLoading: perfumesLoading,
    adicionarPerfume: adicionarPerfumeDB,
    baixarEstoque: baixarEstoqueDB,
    adicionarEstoque: adicionarEstoqueDB,
    transferirEstoque: transferirEstoqueDB,
    proximaLinhaPorCasa,
  } = usePerfumes();

  const {
    casas,
    isLoading: casasLoading,
    adicionarCasa: adicionarCasaDB,
    removerCasa: removerCasaDB,
  } = useCasas();

  // Still in-memory for now (will be migrated later)
  const [vendas, setVendas] = useState<Venda[]>(vendasIniciais);
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>(movsIniciais);
  const [testers, setTesters] = useState<Tester[]>(testersIniciais);
  const [vendedoras, setVendedoras] = useState<string[]>(["Ana", "Julia", "Carla"]);
  const [tiposPerfumeConfig, setTiposPerfumeConfig] = useState<Record<string, string>>(TIPOS_PERFUME as Record<string, string>);
  const [concentracoesConfig, setConcentracoesConfig] = useState<Record<string, string>>(CONCENTRACOES as Record<string, string>);
  const [volumesPadrao, setVolumesPadrao] = useState<number[]>(VOLUMES_PADRAO);

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
    setTesters((prev) => {
      const existente = prev.find((t) => t.perfumeId === perfumeId && t.deposito === deposito);
      if (existente) {
        return prev.map((t) =>
          t.perfumeId === perfumeId && t.deposito === deposito
            ? { ...t, quantidade: t.quantidade + quantidade }
            : t
        );
      }
      const p = perfumes.find((x) => x.id === perfumeId)!;
      const novo: Tester = {
        id: `t${Date.now()}`,
        perfumeId: p.id,
        perfumeNome: p.nome,
        marca: p.marca,
        deposito,
        quantidade,
        custo: p.custo,
      };
      return [...prev, novo];
    });
  };

  const adicionarPerfume = (perfume: Perfume) => {
    adicionarPerfumeDB(perfume);
  };

  // no-op setters for backward compatibility
  const noop = (() => {}) as any;

  return (
    <AppContext.Provider
      value={{
        perfumes,
        setPerfumes: noop,
        perfumesLoading,
        vendas,
        setVendas,
        movimentacoes,
        setMovimentacoes,
        testers,
        setTesters,
        casas,
        setCasas: noop,
        casasLoading,
        adicionarCasaDB,
        removerCasaDB,
        vendedoras,
        setVendedoras,
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
