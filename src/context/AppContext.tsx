import { createContext, useContext, useState, type ReactNode } from "react";
import {
  perfumes as perfumesIniciais,
  vendas as vendasIniciais,
  movimentacoes as movsIniciais,
  testers as testersIniciais,
  casasPadrao,
  type Perfume,
  type Venda,
  type Movimentacao,
  type Tester,
  type Deposito,
  type Casa,
} from "@/data/mockData";

interface AppContextType {
  perfumes: Perfume[];
  setPerfumes: React.Dispatch<React.SetStateAction<Perfume[]>>;
  vendas: Venda[];
  setVendas: React.Dispatch<React.SetStateAction<Venda[]>>;
  movimentacoes: Movimentacao[];
  setMovimentacoes: React.Dispatch<React.SetStateAction<Movimentacao[]>>;
  testers: Tester[];
  setTesters: React.Dispatch<React.SetStateAction<Tester[]>>;
  casas: Casa[];
  setCasas: React.Dispatch<React.SetStateAction<Casa[]>>;
  proximaLinha: number; // próximo número sequencial global de linha
  // helpers
  baixarEstoque: (perfumeId: string, deposito: Deposito, quantidade: number) => void;
  adicionarTester: (perfumeId: string, quantidade: number) => void;
  adicionarPerfume: (perfume: Perfume) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [perfumes, setPerfumes] = useState<Perfume[]>(perfumesIniciais);
  const [vendas, setVendas] = useState<Venda[]>(vendasIniciais);
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>(movsIniciais);
  const [testers, setTesters] = useState<Tester[]>(testersIniciais);
  const [casas, setCasas] = useState<Casa[]>(casasPadrao);

  // A próxima linha é calculada a partir dos perfumes existentes
  const proximaLinha = perfumesIniciais.length + 1;

  const baixarEstoque = (perfumeId: string, deposito: Deposito, quantidade: number) => {
    setPerfumes((prev) =>
      prev.map((p) =>
        p.id === perfumeId
          ? {
              ...p,
              estoques: {
                ...p.estoques,
                [deposito]: Math.max(0, p.estoques[deposito] - quantidade),
              },
            }
          : p
      )
    );
  };

  const adicionarTester = (perfumeId: string, quantidade: number) => {
    setTesters((prev) => {
      const existente = prev.find((t) => t.perfumeId === perfumeId);
      if (existente) {
        return prev.map((t) =>
          t.perfumeId === perfumeId
            ? { ...t, quantidade: t.quantidade + quantidade }
            : t
        );
      }
      const p = perfumes.find((x) => x.id === perfumeId)!;
      return [
        ...prev,
        {
          id: `t${Date.now()}`,
          perfumeId: p.id,
          perfumeNome: p.nome,
          marca: p.marca,
          quantidade,
          custo: p.custo,
        },
      ];
    });
  };

  const adicionarPerfume = (perfume: Perfume) => {
    setPerfumes((prev) => [...prev, perfume]);
  };

  return (
    <AppContext.Provider
      value={{
        perfumes,
        setPerfumes,
        vendas,
        setVendas,
        movimentacoes,
        setMovimentacoes,
        testers,
        setTesters,
        casas,
        setCasas,
        proximaLinha,
        baixarEstoque,
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
