import { useState, useRef } from "react";
import { FileSpreadsheet, Download, Upload, CheckCircle2, AlertTriangle, X, Info } from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/context/AppContext";
import { toast } from "sonner";

interface LinhaImportacao {
  nome: string;
  marca: string;
  casaSigla: string;
  tipo: string;
  concentracao: string;
  volume: number;
  custo: number;
  precoVenda: number;
  linha?: number; // número da linha na casa (opcional, será calculado)
  erro?: string;
}

interface ResultadoImportacao {
  sucesso: LinhaImportacao[];
  erros: LinhaImportacao[];
}

export default function ImportarPlanilha() {
  const { casas, perfumes, tiposPerfumeConfig, concentracoesConfig, proximaLinhaPorCasa } = useApp();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [preview, setPreview] = useState<LinhaImportacao[]>([]);
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);
  const [importando, setImportando] = useState(false);
  const [etapa, setEtapa] = useState<"upload" | "preview" | "resultado">("upload");
  const inputRef = useRef<HTMLInputElement>(null);

  const gerarModelo = () => {
    const wb = XLSX.utils.book_new();

    // Aba principal: Produtos
    const dadosModelo = [
      {
        nome: "Sauvage EDP 100ml",
        casa_sigla: "DR",
        tipo: "NI",
        concentracao: "EDP",
        volume: 100,
        custo: 290,
        preco_venda: 550,
      },
      {
        nome: "Black Orchid EDP 50ml",
        casa_sigla: "TF",
        tipo: "NI",
        concentracao: "EDP",
        volume: 50,
        custo: 350,
        preco_venda: 680,
      },
    ];
    const wsProdutos = XLSX.utils.json_to_sheet(dadosModelo);
    wsProdutos["!cols"] = [
      { wch: 30 }, { wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(wb, wsProdutos, "Produtos");

    // Aba: Casas cadastradas
    const dadosCasas = casas.map((c) => ({
      sigla: c.sigla,
      nome: c.nome,
      tipo: c.tipo,
    }));
    if (dadosCasas.length === 0) {
      dadosCasas.push({ sigla: "EX", nome: "Exemplo", tipo: "NI" });
    }
    const wsCasas = XLSX.utils.json_to_sheet(dadosCasas);
    XLSX.utils.book_append_sheet(wb, wsCasas, "Casas Cadastradas");

    // Aba: Tipos
    const dadosTipos = Object.entries(tiposPerfumeConfig).map(([sigla, label]) => ({
      sigla,
      descricao: label,
    }));
    const wsTipos = XLSX.utils.json_to_sheet(dadosTipos);
    XLSX.utils.book_append_sheet(wb, wsTipos, "Tipos");

    // Aba: Concentrações
    const dadosConc = Object.entries(concentracoesConfig).map(([sigla, label]) => ({
      sigla,
      descricao: label,
    }));
    const wsConc = XLSX.utils.json_to_sheet(dadosConc);
    XLSX.utils.book_append_sheet(wb, wsConc, "Concentracoes");

    XLSX.writeFile(wb, "modelo_importacao_perfumes.xlsx");
    toast.success("Modelo baixado com sucesso!");
  };

  const processarArquivo = (file: File) => {
    setArquivo(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json: any[] = XLSX.utils.sheet_to_json(ws);

        if (json.length === 0) {
          toast.error("Planilha vazia. Verifique o arquivo.");
          return;
        }

        const linhas: LinhaImportacao[] = json.map((row) => {
          const nome = String(row.nome || row.Nome || row.NOME || "").trim();
          const casaSigla = String(row.casa_sigla || row.Casa || row.CASA || row.casa || row.Sigla || row.sigla || "").trim().toUpperCase();
          const tipo = String(row.tipo || row.Tipo || row.TIPO || "").trim().toUpperCase();
          const concentracao = String(row.concentracao || row.Concentracao || row.CONCENTRACAO || row.conc || "").trim().toUpperCase();
          const volume = parseInt(String(row.volume || row.Volume || row.VOLUME || row.vol || "0"));
          const custo = parseFloat(String(row.custo || row.Custo || row.CUSTO || row.preco_custo || "0"));
          const precoVenda = parseFloat(String(row.preco_venda || row.PrecoVenda || row.PRECO_VENDA || row.venda || "0"));

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

          // Check duplicates in DB
          if (!erro) {
            const existe = perfumes.find(
              (p) => p.nome.toLowerCase() === nome.toLowerCase() && p.casaSigla === casaSigla && p.volume === volume
            );
            if (existe) erro = "Produto já cadastrado";
          }

          return { nome, marca, casaSigla, tipo, concentracao, volume, custo, precoVenda, erro };
        });

        setPreview(linhas);
        setEtapa("preview");
      } catch {
        toast.error("Erro ao ler planilha. Verifique o formato.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImportar = async () => {
    const validos = preview.filter((l) => !l.erro);
    if (validos.length === 0) {
      toast.error("Nenhum produto válido para importar.");
      return;
    }

    setImportando(true);
    const sucesso: LinhaImportacao[] = [];
    const erros: LinhaImportacao[] = [];

    // Group by casa to calculate sequential line numbers
    const linhasPorCasa: Record<string, number> = {};

    for (const item of validos) {
      try {
        if (!linhasPorCasa[item.casaSigla]) {
          linhasPorCasa[item.casaSigla] = proximaLinhaPorCasa(item.casaSigla);
        }
        const linha = linhasPorCasa[item.casaSigla];
        linhasPorCasa[item.casaSigla] = linha + 1;

        const tt = item.tipo.padEnd(2, "X").slice(0, 2);
        const mm = item.casaSigla.replace(/[^A-Z0-9]/gi, "").toUpperCase().padEnd(2, "X").slice(0, 2);
        const cc = item.concentracao.slice(0, 2).toUpperCase();
        const llll = String(linha).padStart(4, "0");
        const vvv = String(item.volume).padStart(3, "0");
        const codigo = `${tt}${mm}${cc}${llll}${vvv}`;

        const { error } = await supabase.from("perfumes").insert({
          codigo,
          nome: item.nome,
          marca: item.marca,
          casa_sigla: item.casaSigla,
          tipo: item.tipo,
          concentracao: item.concentracao,
          tamanho: `${item.volume}ml`,
          volume: item.volume,
          custo: item.custo,
          preco_venda: item.precoVenda,
        });

        if (error) throw error;
        sucesso.push({ ...item, linha });
      } catch (err: any) {
        erros.push({ ...item, erro: err.message || "Erro ao inserir" });
      }
    }

    // Add items that already had errors
    const invalidosOriginais = preview.filter((l) => !!l.erro);

    setResultado({ sucesso, erros: [...erros, ...invalidosOriginais] });
    setEtapa("resultado");
    setImportando(false);

    if (sucesso.length > 0) {
      toast.success(`${sucesso.length} produto(s) importado(s) com sucesso!`);
    }
    if (erros.length > 0) {
      toast.error(`${erros.length} produto(s) com erro.`);
    }
  };

  const resetar = () => {
    setArquivo(null);
    setPreview([]);
    setResultado(null);
    setEtapa("upload");
    if (inputRef.current) inputRef.current.value = "";
  };

  const validos = preview.filter((l) => !l.erro);
  const invalidos = preview.filter((l) => !!l.erro);

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 pt-12 pb-4"
        style={{ background: "linear-gradient(180deg, hsl(0 0% 7%) 80%, transparent)" }}>
        <div className="flex items-center gap-3 mb-1">
          <FileSpreadsheet size={20} className="text-gold" />
          <h1 className="font-display text-2xl text-gold">Importar Planilha</h1>
        </div>
        <p className="text-muted-foreground text-xs">Importe produtos em massa via arquivo Excel</p>
      </div>

      <div className="px-4 space-y-4">

        {/* Download do modelo */}
        <section className="bg-gold/5 border border-gold-muted rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Info size={16} className="text-gold mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-semibold text-foreground mb-1">Modelo de Planilha</p>
              <p className="text-[10px] text-muted-foreground mb-3">
                Baixe o modelo com as colunas corretas, casas cadastradas, tipos e concentrações disponíveis.
              </p>
              <button onClick={gerarModelo}
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
          <div className="grid grid-cols-2 gap-1.5">
            {[
              ["nome", "Nome do produto"],
              ["casa_sigla", "Sigla da casa (ex: TF)"],
              ["tipo", "Tipo (ex: NI, AR, NA)"],
              ["concentracao", "Conc. (ex: EDP, EDT)"],
              ["volume", "Volume em ml (ex: 100)"],
              ["custo", "Preço de custo"],
              ["preco_venda", "Preço de venda"],
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
                if (f) processarArquivo(f);
              }}
            />
            <button
              onClick={() => inputRef.current?.click()}
              className="w-full flex flex-col items-center gap-3 py-8 border-2 border-dashed border-gold-muted rounded-xl hover:border-gold transition-colors"
            >
              <Upload size={32} className="text-gold" />
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">Selecionar Planilha</p>
                <p className="text-[10px] text-muted-foreground mt-1">Formatos: .xlsx, .xls, .csv</p>
              </div>
            </button>
          </section>
        )}

        {/* Preview */}
        {etapa === "preview" && (
          <>
            <section className="bg-surface border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">
                  Pré-visualização ({preview.length} itens)
                </p>
                <button onClick={resetar} className="text-muted-foreground hover:text-destructive p-1">
                  <X size={16} />
                </button>
              </div>

              {/* Summary */}
              <div className="flex gap-3">
                <div className="flex items-center gap-1.5 text-xs">
                  <CheckCircle2 size={14} className="text-emerald-400" />
                  <span className="text-foreground">{validos.length} válidos</span>
                </div>
                {invalidos.length > 0 && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <AlertTriangle size={14} className="text-amber-400" />
                    <span className="text-foreground">{invalidos.length} com erro</span>
                  </div>
                )}
              </div>

              {/* Valid items */}
              {validos.length > 0 && (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {validos.slice(0, 20).map((item, i) => (
                    <div key={i} className="flex items-center justify-between bg-surface-overlay rounded-lg px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-foreground truncate">{item.nome}</p>
                        <p className="text-[10px] text-muted-foreground">{item.casaSigla} · {item.tipo} · {item.concentracao} · {item.volume}ml</p>
                      </div>
                      <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" />
                    </div>
                  ))}
                  {validos.length > 20 && (
                    <p className="text-[10px] text-muted-foreground text-center">+{validos.length - 20} itens...</p>
                  )}
                </div>
              )}

              {/* Invalid items */}
              {invalidos.length > 0 && (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">Com erros (não serão importados)</p>
                  {invalidos.map((item, i) => (
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

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={resetar}
                className="flex-1 px-4 py-3 rounded-xl text-xs font-semibold bg-surface border border-border text-foreground"
              >
                Cancelar
              </button>
              <button
                onClick={handleImportar}
                disabled={validos.length === 0 || importando}
                className="flex-1 px-4 py-3 rounded-xl text-xs font-semibold text-primary-foreground disabled:opacity-40"
                style={{ background: "var(--gradient-gold)" }}
              >
                {importando ? "Importando..." : `Importar ${validos.length} produto(s)`}
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
                    <p className="text-xs font-semibold text-emerald-400">{resultado.sucesso.length} importado(s) com sucesso</p>
                  </div>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {resultado.sucesso.map((item, i) => (
                      <p key={i} className="text-[10px] text-foreground truncate">
                        ✓ {item.nome} ({item.casaSigla} · L{String(item.linha).padStart(4, "0")})
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
                        ✗ {item.nome || "(sem nome)"}: {item.erro}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <button
              onClick={resetar}
              className="w-full px-4 py-3 rounded-xl text-xs font-semibold text-primary-foreground"
              style={{ background: "var(--gradient-gold)" }}
            >
              Nova Importação
            </button>
          </>
        )}
      </div>
    </div>
  );
}
