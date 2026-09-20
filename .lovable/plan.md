# Correção urgente da saída de tester

## Objetivo
Eliminar o erro “Unidade não encontrada” e impedir baixas parciais ao registrar uma saída de tester.

## Implementação
- Criar uma RPC transacional para validar a unidade, bloquear o saldo, baixar o estoque e registrar o tester numa única operação.
- Fazer as três entradas de saída de tester usarem essa RPC: Testers, Movimentações e ação rápida do produto.
- Manter o modo “Inventariar” sem baixa, mas validando a unidade no banco.
- Atualizar os tipos do Supabase e invalidar os dados de estoque, testers e movimentações após sucesso.
- Preservar tabelas, dados legados, unidades e histórico; nenhuma exclusão estrutural.

## Validação
- Testar unidade válida, unidade inexistente, estoque insuficiente e tentativa sem permissão.
- Confirmar que falhas não alteram nem estoque nem testers.
- Verificar compilação e carregamento do aplicativo no navegador.

## Entrega
Informar arquivos e migração alterados, riscos, consultas de validação e roteiro de teste em produção.
