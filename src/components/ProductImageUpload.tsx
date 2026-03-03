import { useState, useRef } from "react";
import { Camera, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  currentUrl?: string;
  onUpload: (url: string) => void;
}

export default function ProductImageUpload({ currentUrl, onUpload }: Props) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(currentUrl || "");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview
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

  const handleRemove = () => {
    setPreview("");
    onUpload("");
  };

  return (
    <div>
      <label className="text-xs text-muted-foreground mb-2 block">Foto do Produto</label>
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
          {preview ? (
            <img src={preview} alt="Produto" className="w-full h-full object-cover" />
          ) : (
            <Camera size={24} className="text-muted-foreground" />
          )}
        </div>
        {preview && (
          <button
            onClick={handleRemove}
            className="p-1.5 rounded-lg bg-surface-overlay text-muted-foreground hover:text-destructive transition-colors"
          >
            <X size={14} />
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleUpload}
        />
      </div>
    </div>
  );
}
