import { useState } from "react";
import { ImageOff } from "lucide-react";

interface Props {
  url?: string;
  nome: string;
  size?: number;
}

export default function ProdutoFoto({ url, nome, size = 44 }: Props) {
  const [erro, setErro] = useState(false);
  const valida = url && url.trim() !== "" && !erro;

  return (
    <div
      className="shrink-0 rounded-lg border border-border bg-surface-raised overflow-hidden flex items-center justify-center"
      style={{ width: size, height: size }}
      title={nome}
    >
      {valida ? (
        <img
          src={url}
          alt={nome}
          loading="lazy"
          onError={() => setErro(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <ImageOff size={Math.round(size * 0.4)} className="text-muted-foreground opacity-40" />
      )}
    </div>
  );
}
