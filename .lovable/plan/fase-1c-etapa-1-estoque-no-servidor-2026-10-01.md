# Fase 1C — Etapa 1: Estoque no servidor

## Medição atual (antes)
- Elementos na tela: **2.889** (já com o limite de 30 cards feito antes).
- Tempo até a lista aparecer: **2,6 s a 4,3 s**. A maior parte do tempo vai para baixar, ao abrir o app, todos os produtos, vendas, movimentações e testers.
- Meta: menos de 1 s, com só 30 produtos e seus saldos baixados por vez.

## O que muda para você
- O Estoque abre mais rápido. Busca, loja, tipo, classificação, casa, faixas de custo, venda e estoque e a ordenação passam a ser feitos no banco, 30 produtos por vez, com rolagem infinita e botão "Carregar mais".
- Os totais do topo (unidades por loja, custo, venda e lucro) e os contadores (alertas, sem código de barras, testers) vêm de um resumo calculado no banco.
- "Lista PDF" e Excel com "Todos do filtro" continuam exportando todos os itens filtrados, não só a página carregada.
- Tela de carregamento em esqueleto, erro com "Tentar novamente" e aviso de lista vazia.
- O visual, os cards, as ações rápidas e as permissões por loja continuam iguais.

## Mudança no banco (só acréscimos, sem mexer em dados)
- Liga a extensão de busca por semelhança (`pg_trgm`).
- Índices de busca em produtos (nome, marca, código, código de barras) e em códigos GTIN.
- Índices compostos: `estoque_unidades(unidade_id, produto_id)`, `vendas(data, created_at, id)`, `vendas(unidade_id, data)`, `movimentacoes(data, created_at)`, `testers(perfume_id)`. Os de vendas e movimentações já servem às próximas etapas.
- Função de leitura `fn_estoque_listar(filtros, limite 30, deslocamento)`: devolve produtos com saldo por loja visível ao usuário, testers e contagem total. Usa SECURITY DEFINER e só soma lojas em que `usuario_tem_acesso_unidade` é verdadeiro. Ordenação estável: critério escolhido, depois nome, depois id.
- Função de leitura `fn_estoque_resumo(filtros)`: totais e contadores com as mesmas regras de acesso.
- `fn_vendas_resumo` será criada na etapa de Vendas, junto com a tela que vai usá-la.
- Nada é apagado nem alterado. O saldo continua mudando só pelas funções atuais.

## Detalhes técnicos
- Novo hook `useEstoqueLista` com `useInfiniteQuery`, `staleTime` de 30 s e `keepPreviousData`, invalidado pelas mesmas ações que hoje mexem no estoque: venda, ajuste, tester, transferência, reposição e cadastro.
- Card extraído para `ProdutoEstoqueCard` com `React.memo`. O `QuickActionMenu` só monta os diálogos quando é aberto.
- Fotos com `loading="lazy"` e tamanho fixo, usando o `ProdutoFoto`.
- Filtros e busca com espera de 300 ms, salvos na URL.
- O `AppContext` continua carregando tudo por enquanto, para PDV, Relatórios e ações. A remoção dessa carga fica para a última etapa da 1C.
- Testes: Vitest para montar os filtros. Teste SQL com rollback: um vendedor só vê o saldo da sua loja e a contagem bate com a lista.

## Entrega
Medição depois (elementos e tempo), arquivos alterados, migração, riscos e roteiro de teste. Depois disso eu paro e espero sua aprovação para a etapa de Vendas.
