import { useState, useRef } from "react";
import { FileSpreadsheet, Download, Upload, CheckCircle2, AlertTriangle, X, Info, Home, Package } from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/context/AppContext";
import { toast } from "sonner";

// Converte número no formato BR (2.000,50) ou US (2000.50) para float
function parseBRNumber(val: string): number {
  const s = val.trim();
  if (!s) return 0;
  if (s.includes(",") && s.includes(".")) {
    const lastComma = s.lastIndexOf(",");
    const lastDot = s.lastIndexOf(".");
    if (lastComma > lastDot) {
      return parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0;
    } else {
      return parseFloat(s.replace(/,/g, "")) || 0;
    }
  }
  if (s.includes(",")) {
    return parseFloat(s.replace(",", ".")) || 0;
  }
  return parseFloat(s) || 0;
}

interface LinhaImportacao {
  nome: string;
  marca: string;
  casaSigla: string;
  tipo: string;
  concentracao: string;
  volume: number;
  custo: number;
  precoVenda: number;
  estoqueMinimo: number;
  linha?: number;
  erro?: string;
}

interface LinhaCasaImportacao {
  nome: string;
  sigla: string;
  tipo: string;
  erro?: string;
}

interface ResultadoImportacao {
  sucesso: (LinhaImportacao | LinhaCasaImportacao)[];
  erros: (LinhaImportacao | LinhaCasaImportacao)[];
}

type ModoImportacao = "produtos" | "casas";

export default function ImportarPlanilha() {
  const { casas, perfumes, tiposPerfumeConfig, concentracoesConfig, proximaLinhaPorCasa, adicionarCasaDB } = useApp();
  const [modo, setModo] = useState<ModoImportacao>("produtos");
  const [preview, setPreview] = useState<LinhaImportacao[]>([]);
  const [previewCasas, setPreviewCasas] = useState<LinhaCasaImportacao[]>([]);
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);
  const [importando, setImportando] = useState(false);
  const [etapa, setEtapa] = useState<"upload" | "preview" | "resultado">("upload");
  const inputRef = useRef<HTMLInputElement>(null);

  const gerarModelo = (tipo: ModoImportacao) => {
    const wb = XLSX.utils.book_new();

    if (tipo === "produtos") {
      const dadosModelo = [
        { nome: "Sauvage EDP 100ml", casa_sigla: "DR", tipo: "NI", concentracao: "EDP", volume: 100, custo: 290, preco_venda: 550, estoque_minimo: 3 },
        { nome: "Black Orchid EDP 50ml", casa_sigla: "TF", tipo: "NI", concentracao: "EDP", volume: 50, custo: 350, preco_venda: 680, estoque_minimo: 2 },
      ];
      const wsProdutos = XLSX.utils.json_to_sheet(dadosModelo);
      wsProdutos["!cols"] = [{ wch: 30 }, { wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, wsProdutos, "Produtos");

      const dadosCasas = casas.map((c) => ({ sigla: c.sigla, nome: c.nome, tipo: c.tipo }));
      if (dadosCasas.length === 0) dadosCasas.push({ sigla: "EX", nome: "Exemplo", tipo: "NI" });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dadosCasas), "Casas Cadastradas");

      const dadosTipos = Object.entries(tiposPerfumeConfig).map(([sigla, label]) => ({ sigla, descricao: label }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dadosTipos), "Tipos");

      const dadosConc = Object.entries(concentracoesConfig).map(([sigla, label]) => ({ sigla, descricao: label }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dadosConc), "Concentracoes");

      XLSX.writeFile(wb, "modelo_importacao_perfumes.xlsx");
      toast.success("Modelo de produtos baixado!");
    } else {
      const dadosModelo = [
        { nome: "Parfums de Marly", sigla: "PM", tipo: "NI" },
        { nome: "Al Haramain", sigla: "AH", tipo: "AR" },
      ];
      const wsCasas = XLSX.utils.json_to_sheet(dadosModelo);
      wsCasas["!cols"] = [{ wch: 30 }, { wch: 10 }, { wch: 10 }];
      XLSX.utils.book_append_sheet(wb, wsCasas, "Casas");

      const dadosTipos = Object.entries(tiposPerfumeConfig).map(([sigla, label]) => ({ sigla, descricao: label }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dadosTipos), "Tipos Disponiveis");

      XLSX.writeFile(wb, "modelo_importacao_casas.xlsx");
      toast.success("Modelo de casas baixado!");
    }
  };

  const processarArquivoProdutos = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json: any[] = XLSX.utils.sheet_to_json(ws);

        if (json.length === 0) { toast.error("Planilha vazia."); return; }

        const linhas: LinhaImportacao[] = json.map((row) => {
          const nome = String(row.nome || row.Nome || row.NOME || "").trim();
          const casaSigla = String(row.casa_sigla || row.Casa || row.CASA || row.casa || row.Sigla || row.sigla || "").trim().toUpperCase();
          const tipo = String(row.tipo || row.Tipo || row.TIPO || "").trim().toUpperCase();
          const concentracao = String(row.concentracao || row.Concentracao || row.CONCENTRACAO || row.conc || "").trim().toUpperCase();
          const volume = parseInt(String(row.volume || row.Volume || row.VOLUME || row.vol || "0"));
          const custo = parseBRNumber(String(row.custo || row.Custo || row.CUSTO || row.preco_custo || "0"));
          const precoVenda = parseBRNumber(String(row.preco_venda || row.PrecoVenda || row.PRECO_VENDA || row.venda || "0"));
          const estoqueMinimo = parseInt(String(row.estoque_minimo || row.EstoqueMinimo || row.ESTOQUE_MINIMO || row.estoqueMinimo || "0"));

          const casa = casas.find((c) => c.sigla === casaSigla);
          const marca = casa?.nome || "";

          let erro = "";
          if (!nome) erro = "Nome obrigatório";
          else if (!casaSigla) erro = "Casa/Sigla obrigatória";
          else if (!casa) erro = `Casa "${casaSigla}" não encontrada`;
          else if (!tipo) erro = "Tipo obrigatório";
          else if (!tiposPerfumeConfig[tipo]) erro = `Tipo "${tipo}" inválido`;
          else if (!concentracao) erro = "Concentração obrigatória";
          else if (!concentracoesConfig[concentracao]) erro = `Concentração "${concentracao}" inválida`;
          else if (!volume || volume <= 0) erro = "Volume inválido";

          if (!erro) {
            const existe = perfumes.find(
              (p) => p.nome.toLowerCase() === nome.toLowerCase() && p.casaSigla === casaSigla && p.volume === volume
            );
            if (existe) erro = "Produto já cadastrado";
          }

          return { nome, marca, casaSigla, tipo, concentracao, volume, custo, precoVenda, estoqueMinimo, erro };
        });

        setPreview(linhas);
        setEtapa("preview");
      } catch {
        toast.error("Erro ao ler planilha.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const processarArquivoCasas = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json: any[] = XLSX.utils.sheet_to_json(ws);

        if (json.length === 0) { toast.error("Planilha vazia."); return; }

        const linhas: LinhaCasaImportacao[] = json.map((row) => {
          const nome = String(row.nome || row.Nome || row.NOME || "").trim();
          const sigla = String(row.sigla || row.Sigla || row.SIGLA || "").trim().toUpperCase().slice(0, 3);
          const tipo = String(row.tipo || row.Tipo || row.TIPO || "").trim().toUpperCase();

          let erro = "";
          if (!nome) erro = "Nome obrigatório";
          else if (!sigla || sigla.length < 2) erro = "Sigla obrigatória (2-3 caracteres)";
          else if (!tipo) erro = "Tipo obrigatório";
          else if (!tiposPerfumeConfig[tipo]) erro = `Tipo "${tipo}" inválido. Válidos: ${Object.keys(tiposPerfumeConfig).join(", ")}`;
          else if (casas.find((c) => c.sigla === sigla)) erro = `Sigla "${sigla}" já cadastrada`;

          return { nome, sigla, tipo, erro };
        });

        setPreviewCasas(linhas);
        setEtapa("preview");
      } catch {
        toast.error("Erro ao ler planilha.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImportarProdutos = async () => {
    const validos = preview.filter((l) => !l.erro);
    if (validos.length === 0) { toast.error("Nenhum produto válido."); return; }

    setImportando(true);
    const sucesso: LinhaImportacao[] = [];
    const erros: LinhaImportacao[] = [];
    const linhasPorCasa: Record<string, number> = {};

    for (const item of validos) {
      try {
        if (!linhasPorCasa[item.casaSigla]) {
          linhasPorCasa[item.casaSigla] = proximaLinhaPorCasa(item.casaSigla);
        }
        const linha = linhasPorCasa[item.casaSigla];
        linhasPorCasa[item.casaSigla] = linha + 1;

        const tt = item.tipo.padEnd(2, "X").slice(0, 2);
        const siglaLimpa = item.casaSigla.replace(/[^A-Z0-9]/gi, "").toUpperCase();
        const mm = (/^[0-9]+$/.test(siglaLimpa) ? siglaLimpa.padStart(3, "0") : siglaLimpa.padEnd(3, "X")).slice(0, 3);
        const cc = item.concentracao.slice(0, 2).toUpperCase();
        const llll = String(linha).padStart(4, "0");
        const vvv = String(item.volume).padStart(3, "0");
        const codigo = `${tt}${mm}${cc}${llll}${vvv}`;

        const { error } = await supabase.from("perfumes").insert({
          codigo, nome: item.nome, marca: item.marca, casa_sigla: item.casaSigla,
          tipo: item.tipo, concentracao: item.concentracao, tamanho: `${item.volume}ml`,
          volume: item.volume, custo: item.custo, preco_venda: item.precoVenda,
          estoque_minimo: item.estoqueMinimo,
        });

        if (error) throw error;
        sucesso.push({ ...item, linha });
      } catch (err: any) {
        erros.push({ ...item, erro: err.message || "Erro ao inserir" });
      }
    }

    const invalidosOriginais = preview.filter((l) => !!l.erro);
    setResultado({ sucesso, erros: [...erros, ...invalidosOriginais] });
    setEtapa("resultado");
    setImportando(false);

    if (sucesso.length > 0) toast.success(`${sucesso.length} produto(s) importado(s)!`);
    if (erros.length > 0) toast.error(`${erros.length} produto(s) com erro.`);
  };

  const handleImportarCasas = async () => {
    const validos = previewCasas.filter((l) => !l.erro);
    if (validos.length === 0) { toast.error("Nenhuma casa válida."); return; }

    setImportando(true);
    const sucesso: LinhaCasaImportacao[] = [];
    const erros: LinhaCasaImportacao[] = [];

    for (const item of validos) {
      try {
        await adicionarCasaDB({ sigla: item.sigla, nome: item.nome, tipo: item.tipo as any });
        sucesso.push(item);
      } catch (err: any) {
        erros.push({ ...item, erro: err.message || "Erro ao inserir" });
      }
    }

    const invalidosOriginais = previewCasas.filter((l) => !!l.erro);
    setResultado({ sucesso, erros: [...erros, ...invalidosOriginais] });
    setEtapa("resultado");
    setImportando(false);

    if (sucesso.length > 0) toast.success(`${sucesso.length} casa(s) importada(s)!`);
    if (erros.length > 0) toast.error(`${erros.length} casa(s) com erro.`);
  };

  const resetar = () => {
    setPreview([]);
    setPreviewCasas([]);
    setResultado(null);
    setEtapa("upload");
    if (inputRef.current) inputRef.current.value = "";
  };

  const validosProdutos = preview.filter((l) => !l.erro);
  const invalidosProdutos = preview.filter((l) => !!l.erro);
  const validosCasas = previewCasas.filter((l) => !l.erro);
  const invalidosCasas = previewCasas.filter((l) => !!l.erro);

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 pt-12 pb-4"
        style={{ background: "linear-gradient(180deg, hsl(0 0% 7%) 80%, transparent)" }}>
        <div className="flex items-center gap-3 mb-1">
          <FileSpreadsheet size={20} className="text-gold" />
          <h1 className="font-display text-2xl text-gold">Importar Planilha</h1>
        </div>
        <p className="text-muted-foreground text-xs">Importe produtos ou casas em massa via Excel</p>
      </div>

      <div className="px-4 space-y-4">

        {/* Modo selector */}
        <div className="flex border border-border rounded-xl overflow-hidden">
          {([
            { key: "produtos" as ModoImportacao, label: "Produtos", icon: Package },
            { key: "casas" as ModoImportacao, label: "Casas / Marcas", icon: Home },
          ]).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => { setModo(key); resetar(); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-medium transition-all ${
                modo === key
                  ? "bg-gold text-primary-foreground"
                  : "bg-surface text-muted-foreground"
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* Download do modelo */}
        <section className="bg-gold/5 border border-gold-muted rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Info size={16} className="text-gold mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-semibold text-foreground mb-1">
                Modelo de {modo === "produtos" ? "Produtos" : "Casas"}
              </p>
              <p className="text-[10px] text-muted-foreground mb-3">
                {modo === "produtos"
                  ? "Baixe o modelo com colunas, casas cadastradas, tipos e concentrações."
                  : "Baixe o modelo com colunas para importar novas casas/marcas."
                }
              </p>
              <button onClick={() => gerarModelo(modo)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-primary-foreground"
                style={{ background: "var(--gradient-gold)" }}>
                <Download size={14} /> Baixar Modelo (.xlsx)
              </button>
            </div>
          </div>
        </section>

        {/* Formato esperado */}
        <section className="bg-surface border border-border rounded-xl p-4">
          <p className="text-xs font-semibold text-foreground mb-2">Colunas obrigatórias</p>
          {modo === "produtos" ? (
            <>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  ["nome", "Nome do produto"],
                  ["casa_sigla", "Sigla da casa (ex: TF)"],
                  ["tipo", "Tipo (ex: NI, AR, NA)"],
                  ["concentracao", "Conc. (ex: EDP, EDT)"],
                  ["volume", "Volume em ml (ex: 100)"],
                  ["custo", "Preço de custo"],
                  ["preco_venda", "Preço de venda"],
                  ["estoque_minimo", "Estoque mínimo"],
                ].map(([col, desc]) => (
                  <div key={col} className="flex items-start gap-2">
                    <span className="font-mono text-[10px] font-bold text-gold bg-gold/10 px-1.5 py-0.5 rounded flex-shrink-0">{col}</span>
                    <span className="text-[10px] text-muted-foreground">{desc}</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-3">
                💡 Para adicionar produtos a uma <strong>casa já existente</strong>, basta usar a mesma <code className="text-gold">casa_sigla</code>. 
                A linha sequencial será calculada automaticamente.
              </p>
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-1.5">
                {[
                  ["nome", "Nome da casa/marca (ex: Parfums de Marly)"],
                  ["sigla", "Sigla com 2-3 caracteres (ex: PM)"],
                  ["tipo", `Tipo: ${Object.entries(tiposPerfumeConfig).map(([k, v]) => `${k} = ${v}`).join(", ")}`],
                ].map(([col, desc]) => (
                  <div key={col} className="flex items-start gap-2">
                    <span className="font-mono text-[10px] font-bold text-gold bg-gold/10 px-1.5 py-0.5 rounded flex-shrink-0">{col}</span>
                    <span className="text-[10px] text-muted-foreground">{desc}</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-3">
                💡 Casas com siglas já existentes serão marcadas como erro e não duplicadas.
              </p>
            </>
          )}
        </section>

        {/* Upload */}
        {etapa === "upload" && (
          <section className="bg-surface border border-border rounded-xl p-4">
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  if (modo === "produtos") processarArquivoProdutos(f);
                  else processarArquivoCasas(f);
                }
              }}
            />
            <button
              onClick={() => inputRef.current?.click()}
              className="w-full flex flex-col items-center gap-3 py-8 border-2 border-dashed border-gold-muted rounded-xl hover:border-gold transition-colors"
            >
              <Upload size={32} className="text-gold" />
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">
                  Selecionar Planilha de {modo === "produtos" ? "Produtos" : "Casas"}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">Formatos: .xlsx, .xls, .csv</p>
              </div>
            </button>
          </section>
        )}

        {/* Preview Produtos */}
        {etapa === "preview" && modo === "produtos" && (
          <>
            <section className="bg-surface border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Pré-visualização ({preview.length} itens)</p>
                <button onClick={resetar} className="text-muted-foreground hover:text-destructive p-1"><X size={16} /></button>
              </div>
              <div className="flex gap-3">
                <div className="flex items-center gap-1.5 text-xs">
                  <CheckCircle2 size={14} className="text-emerald-400" />
                  <span className="text-foreground">{validosProdutos.length} válidos</span>
                </div>
                {invalidosProdutos.length > 0 && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <AlertTriangle size={14} className="text-amber-400" />
                    <span className="text-foreground">{invalidosProdutos.length} com erro</span>
                  </div>
                )}
              </div>
              {validosProdutos.length > 0 && (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {validosProdutos.slice(0, 20).map((item, i) => (
                    <div key={i} className="flex items-center justify-between bg-surface-overlay rounded-lg px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-foreground truncate">{item.nome}</p>
                        <p className="text-[10px] text-muted-foreground">{item.casaSigla} · {item.tipo} · {item.concentracao} · {item.volume}ml</p>
                      </div>
                      <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" />
                    </div>
                  ))}
                  {validosProdutos.length > 20 && (
                    <p className="text-[10px] text-muted-foreground text-center">+{validosProdutos.length - 20} itens...</p>
                  )}
                </div>
              )}
              {invalidosProdutos.length > 0 && (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">Com erros</p>
                  {invalidosProdutos.map((item, i) => (
                    <div key={i} className="flex items-center justify-between bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-foreground truncate">{item.nome || "(sem nome)"}</p>
                        <p className="text-[10px] text-destructive">{item.erro}</p>
                      </div>
                      <AlertTriangle size={14} className="text-amber-400 flex-shrink-0" />
                    </div>
                  ))}
                </div>
              )}
            </section>
            <div className="flex gap-3">
              <button onClick={resetar} className="flex-1 px-4 py-3 rounded-xl text-xs font-semibold bg-surface border border-border text-foreground">Cancelar</button>
              <button onClick={handleImportarProdutos} disabled={validosProdutos.length === 0 || importando}
                className="flex-1 px-4 py-3 rounded-xl text-xs font-semibold text-primary-foreground disabled:opacity-40"
                style={{ background: "var(--gradient-gold)" }}>
                {importando ? "Importando..." : `Importar ${validosProdutos.length} produto(s)`}
              </button>
            </div>
          </>
        )}

        {/* Preview Casas */}
        {etapa === "preview" && modo === "casas" && (
          <>
            <section className="bg-surface border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Pré-visualização ({previewCasas.length} casas)</p>
                <button onClick={resetar} className="text-muted-foreground hover:text-destructive p-1"><X size={16} /></button>
              </div>
              <div className="flex gap-3">
                <div className="flex items-center gap-1.5 text-xs">
                  <CheckCircle2 size={14} className="text-emerald-400" />
                  <span className="text-foreground">{validosCasas.length} válidas</span>
                </div>
                {invalidosCasas.length > 0 && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <AlertTriangle size={14} className="text-amber-400" />
                    <span className="text-foreground">{invalidosCasas.length} com erro</span>
                  </div>
                )}
              </div>
              {validosCasas.length > 0 && (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {validosCasas.map((item, i) => (
                    <div key={i} className="flex items-center justify-between bg-surface-overlay rounded-lg px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-foreground truncate">{item.nome}</p>
                        <p className="text-[10px] text-muted-foreground">
                          <span className="font-mono font-bold text-gold">{item.sigla}</span> · {tiposPerfumeConfig[item.tipo] || item.tipo}
                        </p>
                      </div>
                      <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" />
                    </div>
                  ))}
                </div>
              )}
              {invalidosCasas.length > 0 && (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">Com erros</p>
                  {invalidosCasas.map((item, i) => (
                    <div key={i} className="flex items-center justify-between bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-foreground truncate">{item.nome || "(sem nome)"} ({item.sigla})</p>
                        <p className="text-[10px] text-destructive">{item.erro}</p>
                      </div>
                      <AlertTriangle size={14} className="text-amber-400 flex-shrink-0" />
                    </div>
                  ))}
                </div>
              )}
            </section>
            <div className="flex gap-3">
              <button onClick={resetar} className="flex-1 px-4 py-3 rounded-xl text-xs font-semibold bg-surface border border-border text-foreground">Cancelar</button>
              <button onClick={handleImportarCasas} disabled={validosCasas.length === 0 || importando}
                className="flex-1 px-4 py-3 rounded-xl text-xs font-semibold text-primary-foreground disabled:opacity-40"
                style={{ background: "var(--gradient-gold)" }}>
                {importando ? "Importando..." : `Importar ${validosCasas.length} casa(s)`}
              </button>
            </div>
          </>
        )}

        {/* Resultado */}
        {etapa === "resultado" && resultado && (
          <>
            <section className="bg-surface border border-border rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-foreground">Resultado da Importação</p>
              {resultado.sucesso.length > 0 && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 size={16} className="text-emerald-400" />
                    <p className="text-xs font-semibold text-emerald-400">{resultado.sucesso.length} importado(s)</p>
                  </div>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {resultado.sucesso.map((item, i) => (
                      <p key={i} className="text-[10px] text-foreground truncate">
                        ✓ {"nome" in item ? item.nome : ""} {"sigla" in item ? `(${item.sigla})` : ""}
                        {"linha" in item && item.linha ? ` · L${String(item.linha).padStart(4, "0")}` : ""}
                      </p>
                    ))}
                  </div>
                </div>
              )}
              {resultado.erros.length > 0 && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle size={16} className="text-amber-400" />
                    <p className="text-xs font-semibold text-amber-400">{resultado.erros.length} com erro</p>
                  </div>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {resultado.erros.map((item, i) => (
                      <p key={i} className="text-[10px] text-destructive truncate">
                        ✗ {"nome" in item ? (item.nome || "(sem nome)") : ""}: {item.erro}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </section>
            <button onClick={resetar} className="w-full px-4 py-3 rounded-xl text-xs font-semibold text-primary-foreground"
              style={{ background: "var(--gradient-gold)" }}>
              Nova Importação
            </button>
          </>
        )}
      </div>
    </div>
  );
}
