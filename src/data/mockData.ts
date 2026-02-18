export type Deposito = "Casa" | "Sumaúma" | "Amazonas";

export interface Perfume {
  id: string;
  codigo: string;
  nome: string;
  marca: string;
  tamanho: string;
  custo: number;
  precoVenda: number;
  estoques: Record<Deposito, number>;
  estoqueMinimo: number;
}

export interface Venda {
  id: string;
  data: string;
  perfumeId: string;
  perfumeNome: string;
  deposito: Deposito;
  quantidade: number;
  precoUnitario: number;
  total: number;
}

export interface Movimentacao {
  id: string;
  data: string;
  tipo: "Entrada" | "Ajuste" | "Transferência" | "Saída Tester";
  perfumeId: string;
  perfumeNome: string;
  depositoOrigem?: Deposito;
  depositoDestino?: Deposito;
  deposito?: Deposito;
  quantidade: number;
  observacao?: string;
}

export interface Tester {
  id: string;
  perfumeId: string;
  perfumeNome: string;
  marca: string;
  quantidade: number;
  custo: number;
}

export const perfumes: Perfume[] = [
  {
    id: "1",
    codigo: "PF001",
    nome: "Black Orchid",
    marca: "Tom Ford",
    tamanho: "100ml",
    custo: 350,
    precoVenda: 680,
    estoques: { Casa: 12, Sumaúma: 5, Amazonas: 8 },
    estoqueMinimo: 3,
  },
  {
    id: "2",
    codigo: "PF002",
    nome: "Sauvage",
    marca: "Dior",
    tamanho: "100ml",
    custo: 290,
    precoVenda: 550,
    estoques: { Casa: 2, Sumaúma: 0, Amazonas: 3 },
    estoqueMinimo: 3,
  },
  {
    id: "3",
    codigo: "PF003",
    nome: "Oud Wood",
    marca: "Tom Ford",
    tamanho: "50ml",
    custo: 420,
    precoVenda: 780,
    estoques: { Casa: 7, Sumaúma: 4, Amazonas: 2 },
    estoqueMinimo: 2,
  },
  {
    id: "4",
    codigo: "PF004",
    nome: "Bleu de Chanel",
    marca: "Chanel",
    tamanho: "100ml",
    custo: 310,
    precoVenda: 580,
    estoques: { Casa: 15, Sumaúma: 8, Amazonas: 6 },
    estoqueMinimo: 4,
  },
  {
    id: "5",
    codigo: "PF005",
    nome: "Aventus",
    marca: "Creed",
    tamanho: "100ml",
    custo: 680,
    precoVenda: 1200,
    estoques: { Casa: 1, Sumaúma: 0, Amazonas: 1 },
    estoqueMinimo: 2,
  },
  {
    id: "6",
    codigo: "PF006",
    nome: "La Vie Est Belle",
    marca: "Lancôme",
    tamanho: "75ml",
    custo: 220,
    precoVenda: 420,
    estoques: { Casa: 20, Sumaúma: 12, Amazonas: 9 },
    estoqueMinimo: 5,
  },
  {
    id: "7",
    codigo: "PF007",
    nome: "Good Girl",
    marca: "Carolina Herrera",
    tamanho: "80ml",
    custo: 280,
    precoVenda: 510,
    estoques: { Casa: 6, Sumaúma: 3, Amazonas: 4 },
    estoqueMinimo: 3,
  },
  {
    id: "8",
    codigo: "PF008",
    nome: "Boss Bottled",
    marca: "Hugo Boss",
    tamanho: "100ml",
    custo: 180,
    precoVenda: 340,
    estoques: { Casa: 0, Sumaúma: 2, Amazonas: 1 },
    estoqueMinimo: 3,
  },
];

export const vendas: Venda[] = [
  { id: "v1", data: "2026-02-18", perfumeId: "1", perfumeNome: "Black Orchid", deposito: "Casa", quantidade: 2, precoUnitario: 680, total: 1360 },
  { id: "v2", data: "2026-02-18", perfumeId: "4", perfumeNome: "Bleu de Chanel", deposito: "Sumaúma", quantidade: 1, precoUnitario: 580, total: 580 },
  { id: "v3", data: "2026-02-17", perfumeId: "2", perfumeNome: "Sauvage", deposito: "Casa", quantidade: 3, precoUnitario: 550, total: 1650 },
  { id: "v4", data: "2026-02-17", perfumeId: "6", perfumeNome: "La Vie Est Belle", deposito: "Amazonas", quantidade: 2, precoUnitario: 420, total: 840 },
  { id: "v5", data: "2026-02-16", perfumeId: "3", perfumeNome: "Oud Wood", deposito: "Casa", quantidade: 1, precoUnitario: 780, total: 780 },
  { id: "v6", data: "2026-02-16", perfumeId: "7", perfumeNome: "Good Girl", deposito: "Sumaúma", quantidade: 2, precoUnitario: 510, total: 1020 },
  { id: "v7", data: "2026-02-15", perfumeId: "4", perfumeNome: "Bleu de Chanel", deposito: "Casa", quantidade: 3, precoUnitario: 580, total: 1740 },
  { id: "v8", data: "2026-02-14", perfumeId: "1", perfumeNome: "Black Orchid", deposito: "Amazonas", quantidade: 1, precoUnitario: 680, total: 680 },
  { id: "v9", data: "2026-02-13", perfumeId: "5", perfumeNome: "Aventus", deposito: "Casa", quantidade: 1, precoUnitario: 1200, total: 1200 },
  { id: "v10", data: "2026-02-12", perfumeId: "6", perfumeNome: "La Vie Est Belle", deposito: "Casa", quantidade: 4, precoUnitario: 420, total: 1680 },
];

export const movimentacoes: Movimentacao[] = [
  { id: "m1", data: "2026-02-18", tipo: "Entrada", perfumeId: "1", perfumeNome: "Black Orchid", deposito: "Casa", quantidade: 10, observacao: "Reposição mensal" },
  { id: "m2", data: "2026-02-17", tipo: "Transferência", perfumeId: "4", perfumeNome: "Bleu de Chanel", depositoOrigem: "Casa", depositoDestino: "Sumaúma", quantidade: 3 },
  { id: "m3", data: "2026-02-16", tipo: "Saída Tester", perfumeId: "2", perfumeNome: "Sauvage", deposito: "Casa", quantidade: 1, observacao: "Tester vitrine" },
  { id: "m4", data: "2026-02-15", tipo: "Ajuste", perfumeId: "6", perfumeNome: "La Vie Est Belle", deposito: "Amazonas", quantidade: -2, observacao: "Correção inventário" },
  { id: "m5", data: "2026-02-14", tipo: "Entrada", perfumeId: "5", perfumeNome: "Aventus", deposito: "Casa", quantidade: 3, observacao: "Novo lote" },
  { id: "m6", data: "2026-02-13", tipo: "Transferência", perfumeId: "7", perfumeNome: "Good Girl", depositoOrigem: "Amazonas", depositoDestino: "Sumaúma", quantidade: 2 },
];

export const testers: Tester[] = [
  { id: "t1", perfumeId: "1", perfumeNome: "Black Orchid", marca: "Tom Ford", quantidade: 2, custo: 350 },
  { id: "t2", perfumeId: "2", perfumeNome: "Sauvage", marca: "Dior", quantidade: 1, custo: 290 },
  { id: "t3", perfumeId: "3", perfumeNome: "Oud Wood", marca: "Tom Ford", quantidade: 1, custo: 420 },
  { id: "t4", perfumeId: "4", perfumeNome: "Bleu de Chanel", marca: "Chanel", quantidade: 3, custo: 310 },
  { id: "t5", perfumeId: "6", perfumeNome: "La Vie Est Belle", marca: "Lancôme", quantidade: 2, custo: 220 },
];

export const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const formatDate = (dateStr: string) => {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
};
