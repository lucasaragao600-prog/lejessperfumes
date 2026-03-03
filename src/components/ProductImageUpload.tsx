import { useState, useRef } from "react";
import { Camera, X, Loader2, Link, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  currentUrl?: string;
  onUpload: (url: string) => void;
}

export default function ProductImageUpload({ currentUrl, onUpload }: Props) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(currentUrl || "");
  const [urlInput, setUrlInput] = useState("");
  const [mode, setMode] = useState<"upload" | "url">("url");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("product-photos")
        .upload(path, file, { upsert: true });
      if (error) throw error;

      const { data } = supabase.storage
        .from("product-photos")
        .getPublicUrl(path);

      onUpload(data.publicUrl);
    } catch (err) {
      console.error("Upload error:", err);
    } finally {
      setUploading(false);
    }
  };

  const handleUrlSubmit = () => {
    const url = urlInput.trim();
    if (!url) return;
    setPreview(url);
    onUpload(url);
    setUrlInput("");
  };

  const handleRemove = () => {
    setPreview("");
    onUpload("");
    setUrlInput("");
  };

  return (
    <div>
      <label className="text-xs text-muted-foreground mb-2 block">Foto do Produto</label>

      {/* Mode toggle */}
      <div className="flex gap-1.5 mb-3">
        <button
          type="button"
          onClick={() => setMode("url")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${
            mode === "url"
              ? "border-gold-muted bg-primary/10 text-gold"
              : "border-border bg-surface text-muted-foreground"
          }`}
        >
          <Link size={12} /> URL da imagem
        </button>
        <button
          type="button"
          onClick={() => setMode("upload")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${
            mode === "upload"
              ? "border-gold-muted bg-primary/10 text-gold"
              : "border-border bg-surface text-muted-foreground"
          }`}
        >
          <Upload size={12} /> Enviar arquivo
        </button>
      </div>

      {mode === "url" ? (
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="https://exemplo.com/foto.jpg"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
            className="input-premium flex-1 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={handleUrlSubmit}
            disabled={!urlInput.trim()}
            className="btn-primary px-3 py-2 text-xs disabled:opacity-40"
          >
            Salvar
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <div
            onClick={() => inputRef.current?.click()}
            className="w-20 h-20 rounded-xl border border-border bg-surface flex items-center justify-center overflow-hidden cursor-pointer hover:border-gold-muted transition-colors relative"
          >
            {uploading && (
              <div className="absolute inset-0 bg-background/70 flex items-center justify-center z-10">
                <Loader2 size={20} className="text-gold animate-spin" />
              </div>
            )}
            <Camera size={24} className="text-muted-foreground" />
          </div>
          <p className="text-[11px] text-muted-foreground">Clique para selecionar</p>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUpload}
          />
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div className="mt-3 flex items-start gap-3">
          <div className="w-20 h-20 rounded-xl border border-border overflow-hidden flex-shrink-0">
            <img
              src={preview}
              alt="Produto"
              className="w-full h-full object-cover"
              onError={() => setPreview("")}
            />
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className="p-1.5 rounded-lg bg-surface-overlay text-muted-foreground hover:text-destructive transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
