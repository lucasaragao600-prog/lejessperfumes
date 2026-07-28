import { useEffect, useState } from "react";
import { ImageIcon } from "lucide-react";
import { getReposicaoFotoUrl } from "@/hooks/useReposicoes";

interface Props {
  path: string | null | undefined;
  alt?: string;
  className?: string;
  onClick?: () => void;
}

export default function ReposicaoFotoPreview({ path, alt = "Foto", className = "", onClick }: Props) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!path) {
      setUrl(null);
      return;
    }
    getReposicaoFotoUrl(path).then((u) => {
      if (!cancelled) setUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (!path) {
    return (
      <div className={`flex items-center justify-center bg-surface-raised text-muted-foreground ${className}`}>
        <ImageIcon size={20} />
      </div>
    );
  }
  if (!url) {
    return <div className={`bg-surface-raised animate-pulse ${className}`} />;
  }
  return <img src={url} alt={alt} className={className} onClick={onClick} loading="lazy" />;
}
