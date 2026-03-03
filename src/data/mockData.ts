export type Deposito = "Casa" | "Sumaúma" | "Amazonas";
export type TipoPerfume = "AR" | "NI" | "NA" | "KI";
export type Concentracao = "EDP" | "EDT" | "PAR" | "OUT";

export const TIPOS_PERFUME: Record<TipoPerfume, string> = {
  AR: "Árabe",
  NI: "Nicho",
  NA: "Nacional",
  KI: "Kit",
};

export const CONCENTRACOES: Record<Concentracao, string> = {
  EDP: "EDP – Eau de Parfum",
  EDT: "EDT – Eau de Toilette",
  PAR: "Parfum / Extrait",
  OUT: "Outro",
};

export const VOLUMES_PADRAO = [30, 50, 75, 100, 150, 200, 250];

export interface Casa {
  sigla: string; // 2-3 chars, ex: "TF", "CH2"
  nome: string;
  tipo: TipoPerfume;
}

export interface Perfume {
  id: string;
  codigo: string; // TTMMMCCLLLLVVV gerado automaticamente
  nome: string;
  marca: string;
  casaSigla: string;
  tipo: TipoPerfume;
  concentracao: Concentracao;
  tamanho: string;
  volume: number; // ml
  custo: number;
  precoVenda: number;
  estoques: Record<Deposito, number>;
  estoqueMinimo: number;
  imageUrl?: string;
  custoMedio?: number;
  ultimoCustoEm?: string;
}

export type TipoAjusteValor = "desconto" | "acrescimo";
export type TipoPagamento = "Dinheiro" | "Pix" | "Débito" | "Crédito" | "Conta Assinada";
export type Bandeira = "Visa" | "Mastercard" | "Elo" | "Amex" | "Hipercard" | "N/A";

export interface Venda {
  id: string;
  data: string;
  perfumeId: string;
  perfumeNome: string;
  deposito: Deposito;
  quantidade: number;
  precoUnitario: number;
  tipoAjuste: TipoAjusteValor;
  desconto: number;
  total: number;
  vendedora: string;
  tipoPagamento: TipoPagamento;
  bandeira: Bandeira;
  observacao: string;
  registradoPor?: string;
  grupoVenda?: string;
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
  registradoPor?: string;
}

export interface Tester {
  id: string;
  perfumeId: string;
  perfumeNome: string;
  marca: string;
  deposito: Deposito;
  quantidade: number;
  custo: number;
  registradoPor?: string;
}

// Casas/marcas cadastradas com suas siglas
export const casasPadrao: Casa[] = [
  { sigla: "TF", nome: "Tom Ford", tipo: "NI" },
  { sigla: "DR", nome: "Dior", tipo: "NI" },
  { sigla: "CR", nome: "Creed", tipo: "NI" },
  { sigla: "CH", nome: "Chanel", tipo: "NI" },
  { sigla: "LC", nome: "Lancôme", tipo: "NA" },
  { sigla: "CH2", nome: "Carolina Herrera", tipo: "NA" },
  { sigla: "HB", nome: "Hugo Boss", tipo: "NA" },
  { sigla: "AM", nome: "Amouage", tipo: "AR" },
  { sigla: "RM", nome: "Rasasi", tipo: "AR" },
  { sigla: "LA", nome: "Lattafa", tipo: "AR" },
];

// Geração de código automático TTMMMCCLLLLVVV
// MMM = sigla da casa (3 chars), LLLL = sequencial por casa
export function gerarCodigo(
  tipo: TipoPerfume,
  casaSigla: string,
  concentracao: Concentracao,
  linhaPorCasa: number,
  volume: number
): string {
  const tt = tipo.padEnd(2, "X").slice(0, 2);
  const mmm = casaSigla.replace(/[^A-Z0-9]/gi, "").toUpperCase().padEnd(3, "X").slice(0, 3);
  const cc = concentracao.slice(0, 2).toUpperCase();
  const llll = String(linhaPorCasa).padStart(4, "0");
  const vvv = String(volume).padStart(3, "0");
  return `${tt}${mmm}${cc}${llll}${vvv}`;
}

export const perfumes: Perfume[] = [
  {
    id: "1",
    codigo: "NITFED0001100",
    nome: "Black Orchid",
    marca: "Tom Ford",
    casaSigla: "TF",
    tipo: "NI",
    concentracao: "EDP",
    tamanho: "100ml",
    volume: 100,
    custo: 350,
    precoVenda: 680,
    estoques: { Casa: 12, Sumaúma: 5, Amazonas: 8 },
    estoqueMinimo: 3,
  },
  {
    id: "2",
    codigo: "NIDRED0002100",
    nome: "Sauvage",
    marca: "Dior",
    casaSigla: "DR",
    tipo: "NI",
    concentracao: "EDP",
    tamanho: "100ml",
    volume: 100,
    custo: 290,
    precoVenda: 550,
    estoques: { Casa: 2, Sumaúma: 0, Amazonas: 3 },
    estoqueMinimo: 3,
  },
  {
    id: "3",
    codigo: "NITFPA0003050",
    nome: "Oud Wood",
    marca: "Tom Ford",
    casaSigla: "TF",
    tipo: "NI",
    concentracao: "PAR",
    tamanho: "50ml",
    volume: 50,
    custo: 420,
    precoVenda: 780,
    estoques: { Casa: 7, Sumaúma: 4, Amazonas: 2 },
    estoqueMinimo: 2,
  },
  {
    id: "4",
    codigo: "NICHED0004100",
    nome: "Bleu de Chanel",
    marca: "Chanel",
    casaSigla: "CH",
    tipo: "NI",
    concentracao: "EDP",
    tamanho: "100ml",
    volume: 100,
    custo: 310,
    precoVenda: 580,
    estoques: { Casa: 15, Sumaúma: 8, Amazonas: 6 },
    estoqueMinimo: 4,
  },
  {
    id: "5",
    codigo: "NICRPA0005100",
    nome: "Aventus",
    marca: "Creed",
    casaSigla: "CR",
    tipo: "NI",
    concentracao: "PAR",
    tamanho: "100ml",
    volume: 100,
    custo: 680,
    precoVenda: 1200,
    estoques: { Casa: 1, Sumaúma: 0, Amazonas: 1 },
    estoqueMinimo: 2,
  },
  {
    id: "6",
    codigo: "NALCED0006075",
    nome: "La Vie Est Belle",
    marca: "Lancôme",
    casaSigla: "LC",
    tipo: "NA",
    concentracao: "EDP",
    tamanho: "75ml",
    volume: 75,
    custo: 220,
    precoVenda: 420,
    estoques: { Casa: 20, Sumaúma: 12, Amazonas: 9 },
    estoqueMinimo: 5,
  },
  {
    id: "7",
    codigo: "NACHED0007080",
    nome: "Good Girl",
    marca: "Carolina Herrera",
    casaSigla: "CH2",
    tipo: "NA",
    concentracao: "EDP",
    tamanho: "80ml",
    volume: 80,
    custo: 280,
    precoVenda: 510,
    estoques: { Casa: 6, Sumaúma: 3, Amazonas: 4 },
    estoqueMinimo: 3,
  },
  {
    id: "8",
    codigo: "NAHBED0008100",
    nome: "Boss Bottled",
    marca: "Hugo Boss",
    casaSigla: "HB",
    tipo: "NA",
    concentracao: "EDP",
    tamanho: "100ml",
    volume: 100,
    custo: 180,
    precoVenda: 340,
    estoques: { Casa: 0, Sumaúma: 2, Amazonas: 1 },
    estoqueMinimo: 3,
  },
];

export const vendas: Venda[] = [
  { id: "v1", data: "2026-02-18", perfumeId: "1", perfumeNome: "Black Orchid", deposito: "Casa", quantidade: 2, precoUnitario: 680, tipoAjuste: "desconto", desconto: 0, total: 1360, vendedora: "Ana", tipoPagamento: "Pix", bandeira: "N/A", observacao: "" },
  { id: "v2", data: "2026-02-18", perfumeId: "4", perfumeNome: "Bleu de Chanel", deposito: "Sumaúma", quantidade: 1, precoUnitario: 580, tipoAjuste: "desconto", desconto: 0, total: 580, vendedora: "Julia", tipoPagamento: "Crédito", bandeira: "Visa", observacao: "" },
  { id: "v3", data: "2026-02-17", perfumeId: "2", perfumeNome: "Sauvage", deposito: "Casa", quantidade: 3, precoUnitario: 550, tipoAjuste: "desconto", desconto: 50, total: 1600, vendedora: "Ana", tipoPagamento: "Dinheiro", bandeira: "N/A", observacao: "Cliente pediu desconto" },
  { id: "v4", data: "2026-02-17", perfumeId: "6", perfumeNome: "La Vie Est Belle", deposito: "Amazonas", quantidade: 2, precoUnitario: 420, tipoAjuste: "desconto", desconto: 0, total: 840, vendedora: "Carla", tipoPagamento: "Débito", bandeira: "Elo", observacao: "" },
  { id: "v5", data: "2026-02-16", perfumeId: "3", perfumeNome: "Oud Wood", deposito: "Casa", quantidade: 1, precoUnitario: 780, tipoAjuste: "desconto", desconto: 0, total: 780, vendedora: "Julia", tipoPagamento: "Crédito", bandeira: "Mastercard", observacao: "" },
  { id: "v6", data: "2026-02-16", perfumeId: "7", perfumeNome: "Good Girl", deposito: "Sumaúma", quantidade: 2, precoUnitario: 510, tipoAjuste: "desconto", desconto: 0, total: 1020, vendedora: "Ana", tipoPagamento: "Pix", bandeira: "N/A", observacao: "" },
  { id: "v7", data: "2026-02-15", perfumeId: "4", perfumeNome: "Bleu de Chanel", deposito: "Casa", quantidade: 3, precoUnitario: 580, tipoAjuste: "desconto", desconto: 0, total: 1740, vendedora: "Carla", tipoPagamento: "Crédito", bandeira: "Visa", observacao: "" },
  { id: "v8", data: "2026-02-14", perfumeId: "1", perfumeNome: "Black Orchid", deposito: "Amazonas", quantidade: 1, precoUnitario: 680, tipoAjuste: "desconto", desconto: 0, total: 680, vendedora: "Ana", tipoPagamento: "Dinheiro", bandeira: "N/A", observacao: "" },
  { id: "v9", data: "2026-02-13", perfumeId: "5", perfumeNome: "Aventus", deposito: "Casa", quantidade: 1, precoUnitario: 1200, tipoAjuste: "desconto", desconto: 100, total: 1100, vendedora: "Julia", tipoPagamento: "Pix", bandeira: "N/A", observacao: "Negociação especial" },
  { id: "v10", data: "2026-02-12", perfumeId: "6", perfumeNome: "La Vie Est Belle", deposito: "Casa", quantidade: 4, precoUnitario: 420, tipoAjuste: "desconto", desconto: 0, total: 1680, vendedora: "Carla", tipoPagamento: "Crédito", bandeira: "Amex", observacao: "" },
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
  { id: "t1", perfumeId: "1", perfumeNome: "Black Orchid", marca: "Tom Ford", deposito: "Casa", quantidade: 2, custo: 350 },
  { id: "t2", perfumeId: "2", perfumeNome: "Sauvage", marca: "Dior", deposito: "Casa", quantidade: 1, custo: 290 },
  { id: "t3", perfumeId: "3", perfumeNome: "Oud Wood", marca: "Tom Ford", deposito: "Sumaúma", quantidade: 1, custo: 420 },
  { id: "t4", perfumeId: "4", perfumeNome: "Bleu de Chanel", marca: "Chanel", deposito: "Amazonas", quantidade: 3, custo: 310 },
  { id: "t5", perfumeId: "6", perfumeNome: "La Vie Est Belle", marca: "Lancôme", deposito: "Sumaúma", quantidade: 2, custo: 220 },
];

export const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const formatDate = (dateStr: string) => {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
};
