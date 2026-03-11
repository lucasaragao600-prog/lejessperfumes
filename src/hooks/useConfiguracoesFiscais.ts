import { useNfce, type ConfiguracaoFiscal } from "./useNfce";

// Re-export for convenience
export type { ConfiguracaoFiscal };

export function useConfiguracoesFiscais() {
  const { configFiscal, salvarConfigFiscal } = useNfce();
  
  return {
    configFiscal,
    salvarConfigFiscal,
  };
}
