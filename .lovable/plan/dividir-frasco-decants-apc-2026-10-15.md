# Dividir frasco — Decants + APC

Evolução do módulo Decants existente. Nada é recriado: reaproveita frascos (FR-xxxxx), ledger de ml, SKUs/preços por tamanho, Produção, Estoque de Decants, Vender decants do PDV e permissões fn__pode. Módulo continua desligado para lojas até o Master ativar.

## Entrega em 3 etapas (parar e aguardar aprovação ao fim de cada uma)

### Etapa 1 — Divisão do frasco e APC (banco + tela)
- Ação **"Dividir frasco"** em Frascos Abertos e atalho na ficha do perfume no Estoque.
- Formulário: perfume, filial, frasco, volume nominal, saldo real (vindo do ledger, não editável acima dele), ml para decants, reservar APC sim/não, ml APC, preços 5/8/10 ml, preço total do APC, condição/tampa/caixa/observações, resumo antes de salvar.
- Regra: decants + APC = saldo real. APC 0 permitido (não cria item APC).
- Perfume não elegível: explica o motivo e permite habilitar ali (Master/decant.configurar).
- Tamanhos 5, 8 e 10 ml criados se não existirem; preços gravados nos SKUs existentes do perfume (sem cálculo automático; calculadora só como sugestão).
- Frasco lacrado: reaproveita a abertura existente (baixa 1 unidade uma única vez). Frasco já aberto/tester não sofre nova baixa.
- APC fica protegido: o ml reservado sai do saldo de envase via movimento próprio no ledger (`reserva_apc`), então produção, venda sob demanda e perdas nunca o alcançam.
- Status do APC: reservado → em preparação → disponível → vendido / cancelado. Só fica "disponível" quando o saldo a granel de decants daquele frasco chega a zero (regra física).
- Reclassificação de volumes: só gestor, com justificativa e histórico.

### Etapa 2 — Vendas (sob demanda + APC) no PDV
- No "Vender decants": escolher frasco de origem, tamanho 5/8/10, quantidade, preço do SKU. Preço ausente bloqueia só aquele tamanho.
- Venda sob demanda grava envase interno + venda + pagamento + baixa em ml numa única operação atômica (trava do frasco, chave anti-repetição). Excedeu saldo de decants: bloqueia, nunca usa APC/outro frasco/outra filial.
- Venda de decant pronto continua baixando a unidade pronta (sem retirar ml de novo).
- Venda do APC: só com status disponível, uma única vez, item com descrição "Nome — APC com X ml remanescentes / frasco original de Y ml".
- Cancelamento: decant envasado volta a estoque pronto (quarentena se entregue), APC volta a disponível; histórico preservado; caixa estornado pelo fluxo existente.

### Etapa 3 — Ficha do frasco no celular e rentabilidade
- Ficha: identificação, volumes, saldo a granel, prontos/vendidos por tamanho, total vendido em ml, APC (preço/status), receita decants + APC + total.
- Botões Vender 5/8/10, Produzir, Preparar/Vender APC, Histórico — desabilitados com o motivo (ex.: "sobram 2 ml").
- Rentabilidade separa receita realizada × potencial, rateia o custo do frasco entre decants e APC por ml, sinaliza "custos incompletos" quando faltar custo.

## Testes
Testes SQL dentro de transação com rollback (sem vendas nem estoque reais) para os 12 cenários do pedido, incluindo 100→80+20, 5/8/10 → 57 ml, saldo 7 ml, APC bloqueado enquanto há granel, segunda venda de APC, chave repetida. Testes Vitest para os cálculos. FR-000016 conferido antes e depois.

## Detalhes técnicos
- Migração aditiva: `decant_apc` (frasco_id único, ml, preco, condicao, tampa, caixa, status, venda_id, histórico), colunas `ml_decants`/`dividido_em` em `decant_frascos`, novos tipos de movimento no ledger (`reserva_apc`, `liberacao_apc`, `venda_sob_demanda`), `decant_vendas.apc_id`/`frasco_id` nullable.
- RPCs: `fn_decant_dividir_frasco`, `fn_decant_reclassificar_apc`, `fn_decant_apc_status`, `fn_decant_vender_sob_demanda`, `fn_decant_vender_apc`, `fn_decant_frasco_ficha`; todas SECURITY DEFINER, FOR UPDATE no frasco, idempotency key, numeric para ml e R$.
- Rollback escrito para cada migração.
