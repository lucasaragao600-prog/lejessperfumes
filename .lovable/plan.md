# Fase 1A — Cancelamento, devolução, troca e crédito do cliente

## O que o usuário ganha
- Em Vendas e Pedidos: botões **Cancelar venda**, **Devolver itens** e **Trocar itens**. Cada um abre uma janela para escolher os itens e as quantidades, informar o motivo, o destino do item (estoque, avaria ou tester) e a forma de reembolso.
- No PDV: pagar com **crédito da loja / vale-troca** do cliente, mostrando o saldo disponível.
- Comprovante de devolução/troca para imprimir na térmica de 80mm (mesmo estilo do comprovante atual).
- O fechamento de caixa e os relatórios passam a mostrar as vendas **brutas**, as devoluções/cancelamentos e as vendas **líquidas**.

## Banco — migração aditiva (aplicada só depois da sua aprovação)
Nada é apagado ou alterado nas tabelas existentes, exceto colunas novas opcionais.

Tabelas novas (todas com RLS por `usuario_tem_acesso_unidade`, `unidade_id`, `created_at`/`updated_at` e índices):
- `venda_cancelamentos`: grupo_venda, unidade_id, motivo, cancelado_por, aprovado_por, sessao_caixa_ajuste_id.
- `devolucoes`: numero por unidade/ano (`DEV-2026-000001`), grupo_venda_origem, unidade_id, cliente_id, motivo, tipo (devolucao | troca), status, valor_total, forma_reembolso (dinheiro | estorno_cartao | pix | credito_loja | vale_troca), grupo_venda_troca, fora_do_prazo, registrado_por, aprovado_por.
- `devolucao_itens`: devolucao_id, venda_id, produto_id, quantidade, valor_unitario, volta_ao_estoque, destino (estoque | avaria | tester).
- `devolucao_sequencias`: contador por unidade/ano, com bloqueio.
- `credito_cliente`: cliente_id, unidade_id, saldo, validade.
- `credito_movimentos`: extrato de entradas e usos, com a origem (devolução/venda).

Colunas novas opcionais: `vendas.cancelada` (padrão falso) e `vendas.cancelada_em`; `nfce_emissoes.status` recebe o valor `PENDENTE_CANCELAMENTO` / `PENDENTE_DEVOLUCAO_FISCAL` (texto, sem mudar o tipo).

Configuração: `configuracoes` chave `devolucao_prazo_dias` = 30.

Permissões novas (em `permissoes_catalogo` + `role_permissions` do master): `venda.cancelar`, `venda.devolver`, `venda.trocar`, `venda.cancelar_caixa_fechado`, `credito.gerenciar`, `venda.devolver_fora_prazo` (aprovação de gerente).

## Operações no banco (todas numa única transação — se algo falhar, nada é gravado)
- `fn_venda_cancelar(grupo_venda, motivo)`: motivo obrigatório; confere a unidade e a permissão; bloqueia a venda (não cancela duas vezes nem se já houve devolução); devolve o estoque à unidade certa (exceto vendas de teste) e registra a movimentação "Cancelamento". Se o caixa da venda já foi fechado, exige `venda.cancelar_caixa_fechado` e lança uma sangria de ajuste no caixa aberto atual. Marca a NFC-e como pendente de cancelamento. Registra na auditoria.
- `fn_devolucao_registrar(grupo_venda, itens, motivo, forma_reembolso, cliente_id)`: nunca devolve mais que o vendido menos as devoluções anteriores; confere o prazo (fora do prazo exige `venda.devolver_fora_prazo`); devolve ao estoque só os itens com destino "estoque" (avaria só registra; tester entra em testers); reembolso em dinheiro gera saída no caixa aberto; crédito/vale gera saldo para o cliente.
- `fn_troca_registrar(grupo_venda, itens_devolvidos, itens_novos, pagamentos_diferenca, ...)`: devolução + nova venda vinculada com baixa de estoque; calcula a diferença: a pagar (entra nos pagamentos) ou a receber (vira crédito ou dinheiro).
- `fn_credito_usar(cliente_id, valor, grupo_venda)`: bloqueia o saldo, não deixa ficar negativo nem usar crédito vencido, registra no extrato.

## Pontos de atenção
- Hoje as vendas do PDV são gravadas pelo aplicativo, linha por linha. O pagamento com crédito será debitado via `fn_credito_usar` logo após gravar a venda. Deixar a venda inteira do PDV numa única operação no banco fica para uma fase futura.
- A emissão fiscal real (cancelamento da NFC-e / nota de devolução) fica para a Fase 1B. Aqui a nota só é marcada como pendente.
- Os relatórios existentes passam a ignorar as vendas canceladas e a descontar as devoluções. Os números de dias anteriores podem mudar se já houver algo cancelado.

## Detalhes técnicos
- Novos: `src/hooks/useDevolucoes.ts`, `src/hooks/useCreditoCliente.ts`, `src/components/vendas/CancelarVendaDialog.tsx`, `DevolverItensDialog.tsx`, `TrocarItensDialog.tsx`, `ComprovanteDevolucao.tsx`, `src/lib/devolucao.ts` (cálculo de saldo devolvível, diferença da troca, prazo) + `src/lib/devolucao.test.ts`.
- Alterados: `Vendas.tsx`, `PedidosVenda.tsx`, `PDV.tsx` (forma de pagamento "Crédito loja"), `FechamentoCaixa.tsx`, `useVendas.ts`/`Relatorios.tsx` (filtrar `cancelada`, líquido vs. bruto), `usePermissoes`.
- Mutações invalidam as consultas de vendas, pagamentos, perfumes/saldos, movimentações, caixa e crédito.
- Testes SQL (com ROLLBACK): cancelar com estoque; devolução parcial; devolução acima do vendido (falha); devolução duplicada; troca com diferença a pagar e a receber; usuário sem permissão; unidade errada.

## Entrega
O que mudou, arquivos, migração, riscos, roteiro de teste e consultas de conferência. Depois paro e espero sua aprovação.
