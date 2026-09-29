# Fase 1 — Diagnóstico de desempenho (Estoque, Vendas, Pedidos, Movimentações)

## Como funciona hoje
- **Carga global no login:** o `AppContext` chama `usePerfumes`, `useVendas`, `useMovimentacoes` e `useTesters` para o app inteiro. Cada hook baixa a **tabela inteira** em blocos de 1.000 (1.150 perfumes + todos os saldos, ~2.150 vendas + todos os pagamentos, ~3.300 movimentações, todos os testers). Tudo isso acontece antes de qualquer tela aparecer, e o volume cresce a cada venda.
- **Estoque (`Estoque.tsx`):** filtra tudo no navegador (`useMemo` sobre `perfumes`) e desenha **todos** os cards filtrados de uma vez (`filtrados.map`, linha 517). Cada card tem ~80–90 elementos (foto, etiquetas, quebra por loja com testers e o `QuickActionMenu` completo com diálogos). 1.150 × ~85 ≈ **98 mil elementos no DOM** — causa confirmada. Fotos usam `<img>` direto, sem `loading="lazy"`, em tamanho original (links externos; ~90 dão erro ORB). As listas "sem código de barras" e "sem tester" também desenham tudo.
- **Vendas (`Vendas.tsx`):** filtra, agrupa e soma (total do dia, relatório por loja, pagamentos por grupo com `pagamentos.filter` dentro de loop — custo O(n²)) sobre o histórico inteiro no navegador.
- **Pedidos (`PedidosVenda.tsx`):** monta os pedidos a partir de todas as vendas + pagamentos no navegador (também O(n²)) e desenha todos.
- **Movimentações (`Movimentacoes.tsx`):** filtra as ~3.300 no navegador e desenha todas as linhas.
- **Re-renderizações:** qualquer mudança no `AppContext` (ex.: registrar venda) redesenha todas as telas que o usam (25 lugares); os cards não são memoizados.

## Plano de implementação (uma tela por vez, aguardando validação)

### 1. Estoque
- Nova consulta paginada no servidor: 30 itens por vez, com contagem total e ordenação estável (nome → id).
- Busca (nome, SKU, código de barras, marca), tipo, classificação, casa e loja movidos para a consulta; busca com espera de 300 ms; filtros salvos na URL.
- **Rolagem infinita com botão "Carregar mais" de reserva** (escolha: o uso é majoritariamente no celular, com lista de cards — paginação numerada é ruim no toque; o DOM fica limitado porque só são desenhadas as páginas carregadas).
- Filtros de estoque baixo/zerado por loja via função no banco (saldo está em outra tabela).
- Fotos: `loading="lazy"`, tamanho fixo 56×56, espaço reservado durante o carregamento, reaproveitando `ProdutoFoto`.
- Card memoizado; o menu de ações rápidas só monta os diálogos quando aberto.
- Totais do topo e o "Todos do filtro" (Lista PDF/Excel) passam a usar consultas próprias, para exportar todos os filtrados e não só a página.
- Estados: esqueleto, erro com "Tentar novamente", vazio amigável.

### 2. Vendas → 3. Pedidos → 4. Movimentações
- Mesmo padrão: busca por período (padrão: hoje), loja, vendedora, tipo; paginação por pedido (`grupo_venda`).
- Totais do dia/relatório por loja calculados por uma função no banco (somas exatas, respeitando `is_teste` e permissões por unidade), sem baixar o histórico.
- Pagamentos buscados só para os pedidos da página.

### 5. Carga global
- Só depois das 4 telas: remover do `AppContext` a carga completa, mantendo-a apenas nas telas que ainda precisam (PDV, Dashboards, Relatórios), para não quebrar nada.

## Detalhes técnicos
- React Query com `useInfiniteQuery` / `placeholderData: keepPreviousData`, `staleTime` 30 s; invalidação nas mutações atuais (venda, ajuste, tester, transferência).
- Migração **aditiva** (informada antes de aplicar): índices `pg_trgm` em `perfumes(nome, marca, codigo, codigo_barras)`, `vendas(data desc, created_at desc, id)`, `vendas(unidade_id, data)`, `vendas(grupo_venda)`, `venda_pagamentos(grupo_venda)`, `movimentacoes(data desc, created_at desc)`, `estoque_unidades(unidade_id, produto_id)`; funções SECURITY DEFINER de leitura `fn_estoque_listar` e `fn_vendas_resumo` que respeitam `usuario_tem_acesso_unidade`. Sem alteração de dados.
- Regras preservadas: parcelas/MDR, totais, permissões por unidade, visual preto e dourado, exportações.

## Ganho estimado (Estoque)
- DOM: ~98.000 → ~2.500 elementos na primeira tela (30 cards); cresce só conforme a rolagem.
- Dados na abertura: ~1.150 produtos + todos os saldos → 30 produtos + seus saldos.
- Tempo até a lista aparecer: de vários segundos para menos de 1 s (a medir antes/depois).

## Entrega por tela
O que mudou, arquivos alterados, como testar e medição de elementos no DOM e tempo antes/depois; depois paro e aguardo aprovação.
