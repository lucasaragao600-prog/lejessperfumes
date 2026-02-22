import { useState, useRef, useEffect, useMemo } from "react";
import { Search, X } from "lucide-react";
import type { Perfume } from "@/data/mockData";

interface PerfumeSearchSelectProps {
  perfumes: Perfume[];
  value: string;
  onChange: (perfumeId: string) => void;
  concentracoesConfig: Record<string, string>;
  placeholder?: string;
}

export default function PerfumeSearchSelect({
  perfumes,
  value,
  onChange,
  concentracoesConfig,
  placeholder = "Digite para buscar perfume...",
}: PerfumeSearchSelectProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selected = perfumes.find((p) => p.id === value);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return perfumes;
    const terms = query.toLowerCase().split(/\s+/);
    return perfumes.filter((p) => {
      const text = `${p.marca} ${p.nome} ${p.codigo} ${concentracoesConfig[p.concentracao] || p.concentracao} ${p.volume}ml ${p.tamanho}`.toLowerCase();
      return terms.every((t) => text.includes(t));
    });
  }, [perfumes, query, concentracoesConfig]);

  const handleSelect = (perfumeId: string) => {
    onChange(perfumeId);
    setQuery("");
    setOpen(false);
  };

  const handleClear = () => {
    onChange("");
    setQuery("");
  };

  return (
    <div ref={wrapperRef} className="relative">
      {/* Display selected or search input */}
      {selected && !open ? (
        <div
          className="w-full bg-surface-overlay border border-border rounded-lg px-3 py-2.5 text-sm text-foreground flex items-center justify-between cursor-pointer"
          onClick={() => { setOpen(true); setQuery(""); }}
        >
          <span className="truncate">
            {selected.marca} - {selected.nome} - {concentracoesConfig[selected.concentracao] || selected.concentracao} - {selected.volume}ml
          </span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleClear(); }}
            className="ml-2 text-muted-foreground hover:text-foreground flex-shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            autoFocus={open}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className="w-full bg-surface-overlay border border-border rounded-lg pl-9 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold-muted"
          />
        </div>
      )}

      {/* Dropdown list */}
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-52 overflow-y-auto bg-surface border border-border rounded-lg shadow-lg">
          {filtered.length === 0 ? (
            <p className="px-3 py-4 text-xs text-muted-foreground text-center">Nenhum perfume encontrado</p>
          ) : (
            filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelect(p.id)}
                className={`w-full text-left px-3 py-2.5 text-sm hover:bg-gold/10 transition-colors border-b border-border last:border-b-0 ${
                  p.id === value ? "bg-gold/10 text-gold" : "text-foreground"
                }`}
              >
                <span className="font-medium">{p.marca}</span>
                <span className="text-muted-foreground"> - </span>
                <span>{p.nome}</span>
                <span className="text-muted-foreground text-xs ml-1">
                  · {concentracoesConfig[p.concentracao] || p.concentracao} · {p.volume}ml
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
