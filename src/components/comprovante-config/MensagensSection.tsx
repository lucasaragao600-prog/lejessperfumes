import { Textarea } from "@/components/ui/textarea";
import type { ComprovanteConfig } from "@/hooks/useComprovanteConfig";

interface Props {
  config: ComprovanteConfig;
  onChange: (c: ComprovanteConfig) => void;
}

export default function MensagensSection({ config, onChange }: Props) {
  const update = (partial: Partial<ComprovanteConfig>) => onChange({ ...config, ...partial });

  return (
    <section className="card-premium p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Mensagens Personalizadas</h2>
        <p className="text-[10px] text-muted-foreground mt-0.5">Use variáveis: {"{cliente}"}, {"{data}"}, {"{pedido}"}, {"{total}"}</p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Mensagem de Agradecimento</label>
          <Textarea value={config.msgAgradecimento} onChange={(e) => update({ msgAgradecimento: e.target.value })} placeholder="Obrigada pela preferência!" className="mt-1 text-xs h-16" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Mensagem Promocional</label>
          <Textarea value={config.msgPromocional} onChange={(e) => update({ msgPromocional: e.target.value })} placeholder="Siga-nos @lejess_perfumes" className="mt-1 text-xs h-16" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Mensagem Legal / Termos</label>
          <Textarea value={config.msgLegal} onChange={(e) => update({ msgLegal: e.target.value })} placeholder="Troca em até 7 dias com embalagem lacrada" className="mt-1 text-xs h-16" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Observações Padrão</label>
          <Textarea value={config.msgObservacao} onChange={(e) => update({ msgObservacao: e.target.value })} placeholder="" className="mt-1 text-xs h-16" />
        </div>
      </div>
    </section>
  );
}
