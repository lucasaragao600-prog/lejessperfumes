import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { X, Camera, RefreshCw } from "lucide-react";

interface BarcodeScannerDialogProps {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
}

export function BarcodeScannerDialog({ open, onClose, onDetected }: BarcodeScannerDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  // Listar câmeras
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        // Pedir permissão antes pra que enumerateDevices retorne labels
        const tmp = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        tmp.getTracks().forEach((t) => t.stop());
        const list = await BrowserMultiFormatReader.listVideoInputDevices();
        setDevices(list);
        const back = list.find((d) => /back|traseira|environment/i.test(d.label));
        setDeviceId((back || list[list.length - 1] || list[0])?.deviceId);
      } catch (e: any) {
        setError(e?.message || "Não foi possível acessar a câmera");
      }
    })();
  }, [open]);

  // Iniciar scan
  useEffect(() => {
    if (!open || !deviceId || !videoRef.current) return;
    const reader = new BrowserMultiFormatReader();
    let stopped = false;

    reader
      .decodeFromVideoDevice(deviceId, videoRef.current, (result, _err, controls) => {
        if (!controlsRef.current) controlsRef.current = controls;
        if (result && !stopped) {
          stopped = true;
          const text = result.getText().trim();
          try {
            controls.stop();
          } catch {}
          onDetected(text);
        }
      })
      .catch((e) => setError(e?.message || "Erro ao iniciar scanner"));

    return () => {
      try {
        controlsRef.current?.stop();
      } catch {}
      controlsRef.current = null;
    };
  }, [open, deviceId, onDetected]);

  // Cleanup ao fechar
  useEffect(() => {
    if (open) return;
    try {
      controlsRef.current?.stop();
    } catch {}
    controlsRef.current = null;
  }, [open]);

  if (!open) return null;

  const trocarCamera = () => {
    if (devices.length < 2) return;
    const idx = devices.findIndex((d) => d.deviceId === deviceId);
    const next = devices[(idx + 1) % devices.length];
    try {
      controlsRef.current?.stop();
    } catch {}
    controlsRef.current = null;
    setDeviceId(next.deviceId);
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/90 backdrop-blur-sm flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          <Camera className="w-5 h-5 text-gold-muted" />
          <span className="text-sm font-medium">Ler código de barras</span>
        </div>
        <div className="flex items-center gap-2">
          {devices.length > 1 && (
            <button
              onClick={trocarCamera}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20"
              aria-label="Trocar câmera"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
          <button onClick={onClose} className="p-2 rounded-lg bg-white/10 hover:bg-white/20" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden flex items-center justify-center">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
        />
        {/* Overlay alvo */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="w-[80%] max-w-md aspect-[3/1.4] border-2 border-gold-muted/80 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
        </div>
        {error && (
          <div className="absolute bottom-6 left-4 right-4 bg-red-500/90 text-white text-sm rounded-xl p-3 text-center">
            {error}
          </div>
        )}
      </div>

      <div className="px-4 py-3 text-center text-white/80 text-xs">
        Posicione o código dentro do quadro. Boa iluminação ajuda na leitura.
      </div>
    </div>
  );
}
