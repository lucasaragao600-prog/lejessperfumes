# Correção urgente de unidade e carregamento

## O que será corrigido
- Impedir operações com unidade vazia enquanto a lista de lojas ainda carrega.
- Sincronizar automaticamente a unidade selecionada assim que as unidades disponíveis forem carregadas.
- Aguardar e capturar todos os passos da saída de tester, evitando erros soltos e confirmações falsas.
- Validar a saída de tester no fluxo principal e nas ações rápidas.

## Validação
- Confirmar que Casa e Sumaúma são resolvidas corretamente.
- Testar a saída de tester com carregamento inicial lento.
- Conferir compilação, erros do navegador e registros gravados.

## Limites
- Nenhuma unidade, estoque ou histórico será apagado.
- A correção reutilizará as rotinas atuais e não alterará módulos fora do fluxo afetado.
