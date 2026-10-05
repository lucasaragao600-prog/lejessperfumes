import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { FileSpreadsheet, Copy, Archive, Pencil, Plus, Download, Upload, ChevronDown, AlertTriangle, Landmark } from "lucide-react";
import { useConfiguracoes } from "@/hooks/useConfiguracoes";
import {
  CAMPOS_FISCAIS, GRUPOS_FISCAIS, STATUS_FISCAL, listarProdutosFiscal, useFiscalMutations, useHistoricoFiscal, usePerfisTributarios, useProdutosFiscal,
  type FiltrosFiscal, type PerfilTributario, type ProdutoFiscalLinha, type StatusFiscal,
} from "@/hooks/useFiscalProdutos";

const campo = "bg-surface-raised text-foreground border border-border rounded-lg px-3 py-2 text-sm w-full";
const btn = "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border";
const erroMsg = (e: unknown) => (e instanceof Error ? e.message : (e as { message?: string })?.message) || "Não foi possível concluir.";
const rotulo = (k: string) => CAMPOS_FISCAIS.find((c) => c.k === k)?.l || k;

function Badge({ s }: { s: StatusFiscal }) {
  const m = STATUS_FISCAL[s];
  return <span className={`text-[11px] px-2 py-0.5 rounded-full border whitespace-nowrap ${m?.className}`}>{m?.label || s}</span>;
}

function CamposFiscais({ valores, onChange, herdado }: { valores: Record<string, unknown>; onChange: (k: string, v: string) => void; herdado?: Record<string, unknown> }) {
  const [abertos, setAbertos] = useState<Record<string, boolean>>({ basico: true });
  return (
    <div className="space-y-2">
      {Object.entries(GRUPOS_FISCAIS).map(([g, nome]) => (
        <div key={g} className="border border-border rounded-lg">
          <button type="button" onClick={() => setAbertos({ ...abertos, [g]: !abertos[g] })} className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-foreground">
            {nome} <ChevronDown size={14} className={abertos[g] ? "rotate-180" : ""} />
          </button>
          {abertos[g] && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-3 pt-0">
              {CAMPOS_FISCAIS.filter((c) => c.g === g).map((c) => (
                <label key={c.k} className="text-[11px] text-muted-foreground space-y-1">
                  <span>{c.l}</span>
                  <input value={valores[c.k] == null ? "" : String(valores[c.k])} onChange={(e) => onChange(c.k, e.target.value)}
                    placeholder={herdado?.[c.k] != null ? `Herdado: ${herdado[c.k]}` : ""} inputMode={"n" in c ? "decimal" : undefined} className={campo} />
                </label>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const normalizar = (v: Record<string, unknown>) => {
  const out: Record<string, unknown> = {};
  for (const c of CAMPOS_FISCAIS) {
    const raw = v[c.k];
    const t = raw == null ? "" : String(raw).trim();
    out[c.k] = t === "" ? null : "n" in c ? Number(t.replace(",", ".")) : t;
  }
  return out;
};

/* ---------------- Perfis ---------------- */
function EditorPerfil({ perfil, onFechar }: { perfil: Partial<PerfilTributario> | null; onFechar: () => void }) {
  const { salvarPerfil } = useFiscalMutations();
  const { tiposPerfumeConfig } = useConfiguracoes();
  const [v, setV] = useState<Record<string, unknown>>({ ...(perfil || {}) });
  const salvar = async () => {
    try {
      await salvarPerfil.mutateAsync({ id: (perfil?.id as string) || null, dados: { ...normalizar(v), nome: v.nome, descricao: v.descricao || "", categoria_padrao: v.categoria_padrao || null } });
      toast.success("Perfil salvo."); onFechar();
    } catch (e) { toast.error(erroMsg(e)); }
  };
  return (
    <div className="card p-4 space-y-3">
      <div className="grid md:grid-cols-3 gap-2">
        <input value={String(v.nome ?? "")} onChange={(e) => setV({ ...v, nome: e.target.value })} placeholder="Nome do perfil" className={campo} />
        <input value={String(v.descricao ?? "")} onChange={(e) => setV({ ...v, descricao: e.target.value })} placeholder="Descrição" className={campo} />
        <select value={String(v.categoria_padrao ?? "")} onChange={(e) => setV({ ...v, categoria_padrao: e.target.value })} className={campo}>
          <option value="">Sem categoria padrão</option>
          {Object.entries(tiposPerfumeConfig).map(([k, n]) => <option key={k} value={k}>Padrão para {n}</option>)}
        </select>
      </div>
      <CamposFiscais valores={v} onChange={(k, val) => setV({ ...v, [k]: val })} />
      <div className="flex gap-2 justify-end">
        <button onClick={onFechar} className={`${btn} border-border text-muted-foreground`}>Cancelar</button>
        <button onClick={salvar} disabled={salvarPerfil.isPending} className={`${btn} border-gold/40 text-gold bg-gold/5 disabled:opacity-50`}>Salvar perfil</button>
      </div>
    </div>
  );
}

function AbaPerfis() {
  const { data: perfis = [], isLoading } = usePerfisTributarios();
  const { salvarPerfil } = useFiscalMutations();
  const [editando, setEditando] = useState<Partial<PerfilTributario> | null | undefined>(undefined);
  const [verArquivados, setVerArquivados] = useState(false);
  if (editando !== undefined) return <EditorPerfil perfil={editando} onFechar={() => setEditando(undefined)} />;
  const lista = perfis.filter((p) => verArquivados || !p.arquivado);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button onClick={() => setEditando(null)} className={`${btn} border-gold/40 text-gold bg-gold/5`}><Plus size={14} /> Novo perfil</button>
        <label className="ml-auto text-xs text-muted-foreground flex items-center gap-1.5">
          <input type="checkbox" checked={verArquivados} onChange={(e) => setVerArquivados(e.target.checked)} /> Mostrar arquivados
        </label>
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {lista.map((p) => (
        <div key={p.id} className={`card p-3 flex items-center gap-3 ${p.arquivado ? "opacity-60" : ""}`}>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">{p.nome} {p.arquivado && <span className="text-[11px] text-muted-foreground">(arquivado)</span>}</p>
            <p className="text-[11px] text-muted-foreground truncate">
              {p.descricao} · NCM {String(p.ncm ?? "—")} · CFOP {String(p.cfop ?? "—")} · CSOSN {String(p.csosn ?? "—")}
            </p>
          </div>
          <button onClick={() => setEditando(p)} className={`${btn} border-border text-muted-foreground`}><Pencil size={13} /> Editar</button>
          <button onClick={() => setEditando({ ...p, id: undefined, nome: `${p.nome} (cópia)`, categoria_padrao: null })} className={`${btn} border-border text-muted-foreground`}><Copy size={13} /> Duplicar</button>
          <button onClick={() => salvarPerfil.mutateAsync({ id: p.id, dados: { ...p, arquivado: !p.arquivado } }).then(() => toast.success(p.arquivado ? "Perfil reativado." : "Perfil arquivado."), (e) => toast.error(erroMsg(e)))}
            className={`${btn} border-border text-muted-foreground`}><Archive size={13} /> {p.arquivado ? "Reativar" : "Arquivar"}</button>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Produto individual ---------------- */
function EditorProduto({ linha, onFechar }: { linha: ProdutoFiscalLinha; onFechar: () => void }) {
  const { data: perfis = [] } = usePerfisTributarios();
  const { salvarProduto } = useFiscalMutations();
  const f = linha.fiscal;
  const sobrescritos = new Set(f.sobrescritos || []);
  const [perfil, setPerfil] = useState<string>(f.perfil_id || "");
  const [vinculo, setVinculo] = useState<string>(f.vinculo || "herdar");
  const [emite, setEmite] = useState<boolean>(f.emite_nota !== false);
  const [v, setV] = useState<Record<string, unknown>>(Object.fromEntries(CAMPOS_FISCAIS.filter((c) => sobrescritos.has(c.k)).map((c) => [c.k, f[c.k]])));
  const salvar = async () => {
    try {
      await salvarProduto.mutateAsync({ id: linha.id, dados: { ...normalizar(v), perfil_id: perfil || null, vinculo, emite_nota: emite } });
      toast.success("Dados fiscais salvos."); onFechar();
    } catch (e) { toast.error(erroMsg(e)); }
  };
  return (
    <div className="card p-4 space-y-3">
      <div>
        <p className="text-sm font-medium text-foreground">{linha.codigo} - {linha.marca} - {linha.nome} - {linha.concentracao} - {linha.volume}ml</p>
        <div className="flex items-center gap-2 mt-1"><Badge s={linha.status.status} />
          {[...linha.status.erros, ...linha.status.faltam.map((k) => `Falta ${rotulo(k)}`)].map((m) => <span key={m} className="text-[11px] text-destructive">{m}</span>)}
        </div>
      </div>
      <div className="grid md:grid-cols-3 gap-2">
        <select value={perfil} onChange={(e) => setPerfil(e.target.value)} className={campo}>
          <option value="">Sem perfil</option>
          {perfis.filter((p) => !p.arquivado || p.id === perfil).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
        <select value={vinculo} onChange={(e) => setVinculo(e.target.value)} className={campo}>
          <option value="herdar">Herdar do perfil (atualiza junto)</option>
          <option value="copiar">Valores copiados (desvinculado)</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-foreground"><input type="checkbox" checked={emite} onChange={(e) => setEmite(e.target.checked)} /> Emite nota fiscal</label>
      </div>
      <p className="text-[11px] text-muted-foreground">Deixe em branco para usar o valor do perfil (mostrado em cinza). Preencha só o que for diferente para este produto.</p>
      <CamposFiscais valores={v} onChange={(k, val) => setV({ ...v, [k]: val })} herdado={f} />
      <div className="flex gap-2 justify-end">
        <button onClick={onFechar} className={`${btn} border-border text-muted-foreground`}>Cancelar</button>
        <button onClick={salvar} disabled={salvarProduto.isPending} className={`${btn} border-gold/40 text-gold bg-gold/5 disabled:opacity-50`}>Salvar</button>
      </div>
    </div>
  );
}

/* ---------------- Aplicação em massa ---------------- */
function AplicarPerfil({ ids, onFechar }: { ids: string[]; onFechar: () => void }) {
  const { data: perfis = [] } = usePerfisTributarios();
  const { aplicar } = useFiscalMutations();
  const [perfil, setPerfil] = useState("");
  const [modo, setModo] = useState<"sobrescrever" | "vazios">("sobrescrever");
  const [vinculo, setVinculo] = useState<"herdar" | "copiar">("herdar");
  const [previa, setPrevia] = useState<Awaited<ReturnType<typeof aplicar.mutateAsync>> | null>(null);
  const rodar = async (soPrevia: boolean) => {
    try {
      const r = await aplicar.mutateAsync({ perfil, produtos: ids, modo, vinculo, previa: soPrevia });
      if (soPrevia) setPrevia(r); else { toast.success(`Perfil aplicado: ${r.alterados} produto(s) alterado(s).`); onFechar(); }
    } catch (e) { toast.error(erroMsg(e)); }
  };
  return (
    <div className="card p-4 space-y-3 border-gold/30">
      <p className="text-sm font-medium text-foreground">Aplicar perfil a {ids.length} produto(s)</p>
      <div className="grid md:grid-cols-3 gap-2">
        <select value={perfil} onChange={(e) => { setPerfil(e.target.value); setPrevia(null); }} className={campo}>
          <option value="">Escolha o perfil</option>
          {perfis.filter((p) => !p.arquivado).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
        <select value={modo} onChange={(e) => { setModo(e.target.value as typeof modo); setPrevia(null); }} className={campo}>
          <option value="sobrescrever">Sobrescrever tudo</option>
          <option value="vazios">Preencher só campos vazios</option>
        </select>
        <select value={vinculo} onChange={(e) => { setVinculo(e.target.value as typeof vinculo); setPrevia(null); }} className={campo}>
          <option value="herdar">Herdar (alterar o perfil atualiza estes produtos)</option>
          <option value="copiar">Copiar valores (desvinculado)</option>
        </select>
      </div>
      {previa && (
        <div className="text-xs space-y-1 bg-surface-raised rounded-lg p-3 max-h-64 overflow-auto">
          <p className="text-foreground font-medium">{previa.alterados} de {previa.total} produto(s) terão alteração.</p>
          {previa.amostra.map((a) => (
            <p key={a.perfume_id} className="text-muted-foreground">
              {Object.entries(a.campos).map(([k, d]) => `${rotulo(k)}: ${d.de ?? "vazio"} → ${d.para ?? "vazio"}`).join(" · ")}
            </p>
          ))}
          {previa.alterados > previa.amostra.length && <p className="text-muted-foreground">… e mais {previa.alterados - previa.amostra.length}.</p>}
        </div>
      )}
      <div className="flex gap-2 justify-end">
        <button onClick={onFechar} className={`${btn} border-border text-muted-foreground`}>Cancelar</button>
        <button onClick={() => rodar(true)} disabled={!perfil || aplicar.isPending} className={`${btn} border-border text-foreground disabled:opacity-50`}>Ver prévia</button>
        <button onClick={() => rodar(false)} disabled={!previa || aplicar.isPending} className={`${btn} border-gold/40 text-gold bg-gold/5 disabled:opacity-50`}>Confirmar aplicação</button>
      </div>
    </div>
  );
}

/* ---------------- Produtos ---------------- */
const vazio: FiltrosFiscal = { busca: "", status: "", perfil: "", tipo: "" };
const csvCel = (v: unknown) => { const t = v == null ? "" : String(v); return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };

function AbaProdutos() {
  const { data: perfis = [] } = usePerfisTributarios();
  const { tiposPerfumeConfig } = useConfiguracoes();
  const { salvarProduto } = useFiscalMutations();
  const [f, setF] = useState<FiltrosFiscal>(vazio);
  const [pagina, setPagina] = useState(0);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [editando, setEditando] = useState<ProdutoFiscalLinha | null>(null);
  const [aplicando, setAplicando] = useState<string[] | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);
  const filtros = useMemo(() => ({ ...f, busca: f.busca.trim() }), [f]);
  const { data, isLoading, error } = useProdutosFiscal(filtros, pagina);
  const set = (k: keyof FiltrosFiscal, v: string) => { setF({ ...f, [k]: v }); setPagina(0); setSel(new Set()); };
  const resumo = data?.resumo || {};
  const pendentes = (resumo.incompleto || 0) + (resumo.erro || 0);

  const selecionarFiltro = async () => {
    setOcupado(true);
    try { const r = await listarProdutosFiscal(filtros, 0, 0); setSel(new Set(r.ids || [])); toast.info(`${r.ids?.length || 0} produto(s) selecionado(s).`); }
    catch (e) { toast.error(erroMsg(e)); } finally { setOcupado(false); }
  };

  const exportar = async () => {
    setOcupado(true);
    try {
      const r = await listarProdutosFiscal(filtros, 5000, 0);
      const cab = ["id", "codigo", "produto", "status", "perfil", "emite_nota", ...CAMPOS_FISCAIS.map((c) => c.k)];
      const linhas = r.itens.map((i) => [i.id, i.codigo, `${i.marca} - ${i.nome} - ${i.concentracao} - ${i.volume}ml`, STATUS_FISCAL[i.status.status]?.label,
        i.fiscal.perfil_nome || "", i.fiscal.emite_nota === false ? "nao" : "sim", ...CAMPOS_FISCAIS.map((c) => i.fiscal[c.k] ?? "")]);
      const csv = "\uFEFF" + [cab, ...linhas].map((l) => l.map(csvCel).join(";")).join("\n");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      a.download = `fiscal-produtos-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(a.href);
    } catch (e) { toast.error(erroMsg(e)); } finally { setOcupado(false); }
  };

  const importar = async (file: File) => {
    setOcupado(true);
    try {
      const texto = (await file.text()).replace(/^\uFEFF/, "");
      const linhas = texto.split(/\r?\n/).filter(Boolean).map((l) => l.split(";").map((c) => c.replace(/^"|"$/g, "").replace(/""/g, '"')));
      const [cab, ...corpo] = linhas;
      const iId = cab.indexOf("id");
      if (iId < 0) throw new Error("A planilha precisa da coluna id (use a exportação como modelo).");
      let ok = 0, falhas = 0;
      for (const l of corpo) {
        const dados: Record<string, unknown> = {};
        CAMPOS_FISCAIS.forEach((c) => { const i = cab.indexOf(c.k); if (i >= 0) dados[c.k] = l[i]; });
        const iEm = cab.indexOf("emite_nota");
        const norm = normalizar(dados);
        const payload: Record<string, unknown> = Object.fromEntries(Object.entries(norm).filter(([k]) => cab.includes(k)));
        if (iEm >= 0) payload.emite_nota = l[iEm]?.toLowerCase() !== "nao";
        try { await salvarProduto.mutateAsync({ id: l[iId], dados: payload }); ok++; } catch { falhas++; }
      }
      toast.success(`Importação concluída: ${ok} produto(s) atualizados${falhas ? `, ${falhas} com erro` : ""}.`);
    } catch (e) { toast.error(erroMsg(e)); } finally { setOcupado(false); if (arquivo.current) arquivo.current.value = ""; }
  };

  if (editando) return <EditorProduto linha={editando} onFechar={() => setEditando(null)} />;
  const total = data?.total ?? 0;
  const itens = data?.itens || [];
  const todosPagina = itens.length > 0 && itens.every((i) => sel.has(i.id));

  return (
    <div className="space-y-3">
      {pendentes > 0 && (
        <div className="card p-3 border-amber-500/40 bg-amber-500/5 text-xs flex items-center gap-2 flex-wrap">
          <AlertTriangle size={14} className="text-amber-500" />
          <span className="text-amber-500 font-medium">{pendentes} produto(s) com cadastro fiscal incompleto ou com erro</span>
          <button onClick={() => { setF({ ...vazio, status: resumo.erro ? "erro" : "incompleto" }); setPagina(0); }} className="ml-auto underline text-amber-500">Ver e corrigir em massa</button>
        </div>
      )}
      <div className="flex flex-wrap gap-2 text-[11px]">
        {(Object.keys(STATUS_FISCAL) as StatusFiscal[]).map((s) => (
          <button key={s} onClick={() => set("status", f.status === s ? "" : s)} className={`px-2 py-1 rounded-full border ${f.status === s ? STATUS_FISCAL[s].className : "border-border text-muted-foreground"}`}>
            {STATUS_FISCAL[s].label}: {resumo[s] || 0}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <input value={f.busca} onChange={(e) => set("busca", e.target.value)} placeholder="Buscar nome, marca, código ou NCM" className={`${campo} col-span-2`} />
        <select value={f.tipo} onChange={(e) => set("tipo", e.target.value)} className={campo}>
          <option value="">Todas as categorias</option>
          {Object.entries(tiposPerfumeConfig).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
        </select>
        <select value={f.perfil} onChange={(e) => set("perfil", e.target.value)} className={campo}>
          <option value="">Qualquer perfil</option>
          {perfis.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-2 text-xs flex-wrap">
        <span className="text-muted-foreground">{total} produto(s) · {sel.size} selecionado(s)</span>
        <button onClick={selecionarFiltro} disabled={ocupado || total === 0} className="text-gold underline disabled:opacity-50">Selecionar todos do filtro</button>
        {sel.size > 0 && <button onClick={() => setSel(new Set())} className="text-muted-foreground underline">Limpar seleção</button>}
        <div className="ml-auto flex gap-2">
          <button onClick={() => setAplicando([...sel])} disabled={sel.size === 0} className={`${btn} border-gold/40 text-gold bg-gold/5 disabled:opacity-50`}><Landmark size={14} /> Aplicar perfil</button>
          <button onClick={exportar} disabled={ocupado} className={`${btn} border-border text-muted-foreground disabled:opacity-50`}><Download size={14} /> Exportar</button>
          <button onClick={() => arquivo.current?.click()} disabled={ocupado} className={`${btn} border-border text-muted-foreground disabled:opacity-50`}><Upload size={14} /> Importar</button>
          <input ref={arquivo} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && importar(e.target.files[0])} />
        </div>
      </div>
      {aplicando && <AplicarPerfil ids={aplicando} onFechar={() => { setAplicando(null); setSel(new Set()); }} />}
      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {error && <p className="text-sm text-destructive">Não foi possível carregar os produtos.</p>}
      <div className="card overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-muted-foreground">
            <tr className="border-b border-border">
              <th className="p-2 w-8"><input type="checkbox" checked={todosPagina} onChange={(e) => {
                const n = new Set(sel); itens.forEach((i) => (e.target.checked ? n.add(i.id) : n.delete(i.id))); setSel(n);
              }} aria-label="Selecionar página" /></th>
              <th className="text-left p-2">Produto</th><th className="text-left p-2">Perfil</th>
              <th className="text-left p-2">NCM</th><th className="text-left p-2">CFOP</th><th className="text-left p-2">CSOSN</th><th className="text-left p-2">Situação</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((i) => (
              <tr key={i.id} className="border-b border-border/50 hover:bg-surface-raised cursor-pointer" onClick={() => setEditando(i)}>
                <td className="p-2" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={sel.has(i.id)} onChange={(e) => { const n = new Set(sel); e.target.checked ? n.add(i.id) : n.delete(i.id); setSel(n); }} aria-label="Selecionar" />
                </td>
                <td className="p-2 text-foreground">{i.codigo} - {i.marca} - {i.nome} - {i.concentracao} - {i.volume}ml</td>
                <td className="p-2 text-muted-foreground">{i.fiscal.perfil_nome || "—"}</td>
                <td className="p-2">{String(i.fiscal.ncm ?? "—")}</td><td className="p-2">{String(i.fiscal.cfop ?? "—")}</td><td className="p-2">{String(i.fiscal.csosn ?? "—")}</td>
                <td className="p-2"><Badge s={i.status.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {total > 30 && (
        <div className="flex items-center justify-center gap-3 text-xs">
          <button disabled={pagina === 0} onClick={() => setPagina(pagina - 1)} className="px-3 py-1 border border-border rounded disabled:opacity-40">Anterior</button>
          <span className="text-muted-foreground">{pagina + 1} / {Math.ceil(total / 30)}</span>
          <button disabled={(pagina + 1) * 30 >= total} onClick={() => setPagina(pagina + 1)} className="px-3 py-1 border border-border rounded disabled:opacity-40">Próxima</button>
        </div>
      )}
    </div>
  );
}

/* ---------------- Histórico ---------------- */
function AbaHistorico() {
  const [pagina, setPagina] = useState(0);
  const { data, isLoading } = useHistoricoFiscal(pagina);
  const total = data?.total ?? 0;
  return (
    <div className="space-y-2">
      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {!isLoading && total === 0 && <p className="text-sm text-muted-foreground">Nenhuma alteração fiscal registrada.</p>}
      {data?.itens.map((h) => {
        const mud = CAMPOS_FISCAIS.filter((c) => (h.antes?.[c.k] ?? null) !== (h.depois?.[c.k] ?? null));
        return (
          <div key={h.id} className="card p-3 text-xs space-y-1">
            <p className="text-foreground">
              <span className="font-medium">{h.entidade === "perfil" ? `Perfil ${String(h.depois?.nome ?? "")}` : "Produto"}</span> · {h.acao.replace("aplicar_perfil:", "aplicou perfil ")}
              <span className="text-muted-foreground"> · {h.usuario_nome} · {new Date(h.created_at).toLocaleString("pt-BR", { timeZone: "America/Manaus" })}</span>
            </p>
            {mud.length > 0 && <p className="text-muted-foreground">{mud.map((c) => `${c.l}: ${h.antes?.[c.k] ?? "vazio"} → ${h.depois?.[c.k] ?? "vazio"}`).join(" · ")}</p>}
          </div>
        );
      })}
      {total > 30 && (
        <div className="flex items-center justify-center gap-3 text-xs">
          <button disabled={pagina === 0} onClick={() => setPagina(pagina - 1)} className="px-3 py-1 border border-border rounded disabled:opacity-40">Anterior</button>
          <span className="text-muted-foreground">{pagina + 1} / {Math.ceil(total / 30)}</span>
          <button disabled={(pagina + 1) * 30 >= total} onClick={() => setPagina(pagina + 1)} className="px-3 py-1 border border-border rounded disabled:opacity-40">Próxima</button>
        </div>
      )}
    </div>
  );
}

const ABAS = { produtos: "Produtos", perfis: "Perfis tributários", historico: "Histórico" } as const;

export default function ConfiguracaoFiscalProdutos() {
  const [aba, setAba] = useState<keyof typeof ABAS>("produtos");
  return (
    <section className="card-premium p-5 space-y-4">
      <div className="flex items-center gap-2">
        <FileSpreadsheet size={16} className="text-gold" />
        <h2 className="text-sm font-semibold text-foreground">Fiscal dos produtos</h2>
      </div>
      <p className="text-xs text-muted-foreground">Dados da empresa, certificado e numeração da NFC-e continuam na tela de Notas Fiscais, por loja.</p>
      <div className="flex gap-1 border-b border-border">
        {(Object.keys(ABAS) as (keyof typeof ABAS)[]).map((k) => (
          <button key={k} onClick={() => setAba(k)} className={`px-3 py-2 text-xs border-b-2 -mb-px ${aba === k ? "border-gold text-gold" : "border-transparent text-muted-foreground"}`}>{ABAS[k]}</button>
        ))}
      </div>
      {aba === "produtos" && <AbaProdutos />}
      {aba === "perfis" && <AbaPerfis />}
      {aba === "historico" && <AbaHistorico />}
    </section>
  );
}
