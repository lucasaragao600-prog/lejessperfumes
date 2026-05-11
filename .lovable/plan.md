## Relatório de Fluxo de Caixa em PDF — Plano

### 1. Análise do banco (tabelas e campos identificados)

Tudo que o relatório precisa **já existe** no schema atual. Não há necessidade de migrações, novas views ou funções no banco.

**Lojas / Depósitos** → `casas` (`sigla`, `nome`, `tipo`)
A "loja" para fins de relatório é o `deposito` da venda (Casa, Sumaúma, Amazonas).

**Vendas confirmadas** → `vendas`
Campos: `id`, `data`, `perfume_id`, `perfume_nome`, `deposito`, `quantidade`, `preco_unitario`, `desconto`, `total`, `vendedora`, `tipo_pagamento`, `bandeira`, `grupo_venda`, `cliente_id`, `nfce_status`.
Filtro de "vendas válidas" = todas as linhas existentes (não há flag de cancelamento; exclusão é hard-delete). Nenhuma flag adicional necessária.

**Pagamentos (split)** → `venda_pagamentos`
Campos: `grupo_venda`, `tipo_pagamento`, `bandeira`, `valor`, `parcelas`.
Esta é a fonte de verdade para a Parte 1, pois uma venda pode ter múltiplas formas de pagamento. Soma por `tipo_pagamento` + `bandeira`, agrupando vendas do dia/loja via join com `vendas` por `grupo_venda`.

**Produtos / Estoque** → `perfumes`
Campos: `id`, `codigo`, `nome`, `marca`, `concentracao`, `tamanho`, `volume`, `estoque_casa`, `estoque_sumauma`, `estoque_amazonas`, `estoque_minimo`.
A coluna de estoque usada depende da loja selecionada.

**Vendedores** → coluna `vendedora` em `vendas` (texto). Lista mestre em `vendedoras`.

**Configuração da loja** (cabeçalho do PDF) → `configuracoes_fiscais` (`razao_social`, `nome_fantasia`, `endereco`, `cidade`, `uf`).

### 2. Permissões

Usar `useAuth()` — `role` (`master` | `vendedor`) + `profile.loja`.
- **Master**: pode escolher qualquer loja (Casa / Sumaúma / Amazonas).
- **Vendedor**: seletor de loja **trava** na `profile.loja` (regra já adotada no resto do app).

### 3. Estrutura de UI

Adicionar nova aba/seção em `src/pages/Relatorios.tsx` chamada **"Fluxo de Caixa"** com:

- Select **Loja** (Casa / Sumaúma / Amazonas, respeitando permissão)
- Tabs de período: **Diário** | **Quinzenal** | **Mensal**
- Diário → DatePicker (data única, default hoje em America/Manaus via `getHojeManaus()`)
- Quinzenal → seleção de mês + radio "1ª quinzena (1–15)" / "2ª quinzena (16–fim)"
- Mensal → seleção de mês
- Botão **"Gerar PDF"**

### 4. Geração do PDF (jspdf + jspdf-autotable, já instalados)

Novo arquivo: `src/lib/pdf/fluxoCaixa.ts` exportando `gerarFluxoCaixaDiario`, `gerarFluxoCaixaQuinzenal`, `gerarFluxoCaixaMensal`. Cada função recebe os dados já filtrados e devolve `jsPDF`.

**Cabeçalho padrão** (todas as variações):
- Nome fantasia da empresa + nome da loja
- Período (data ou intervalo)
- "Gerado em: {agora Manaus}"
- Linha divisória dourada (#C9A24A) seguindo a identidade do app

#### Relatório Diário

**Parte 1 — Modalidades de pagamento** (fonte: `venda_pagamentos` ⨝ `vendas` do dia/loja):
- Tabela: Modalidade | Bandeira | Qtde transações | Total (R$)
- Agrupamentos: Crédito (por bandeira), Débito (por bandeira), Pix, Dinheiro, Crediário, Conta Assinada
- Linha "TOTAL GERAL" destacada
- **Gráfico de pizza** desenhado em `<canvas>` off-screen com Chart.js (já no projeto via shadcn/ui chart? — se não, desenhar manualmente com `ctx.arc` no canvas e injetar via `doc.addImage`). Plano: usar canvas puro com fatias proporcionais + legenda colorida; sem nova dependência.

**Parte 2 — Vendas por vendedor** (fonte: `vendas` agrupado por `vendedora`):
- Para cada vendedor (ordenado desc por qtd total de produtos):
  - Subtítulo: "Vendedor: {nome}" + chips com totais
  - Tabela: Produto | Qtd | Valor unit. | Total
  - Rodapé do bloco: "Total de produtos: X · Valor total: R$ Y"

**Parte 3 — Perfumes vendidos no dia** (fonte: `vendas` agrupado por `perfume_id`):
- Tabela: Descrição (formato completo: SKU - Marca - Nome - Concentração - Volume) | Qtd | Valor unit. médio | Total
- Rodapé: "Soma total: X produtos · R$ Y"

**Parte 4 — Reposição de estoque** (fonte: `perfumes`, coluna correspondente à loja):
- Itens com `estoque_loja === 0` → badge **"REPOR URGENTE"** (vermelho)
- Itens com `0 < estoque_loja <= estoque_minimo` → badge **"ATENÇÃO"** (âmbar)
- Tabela: Produto | Estoque atual | Mínimo | Prioridade
- Ordenar zerados primeiro

#### Relatório Quinzenal (1–15 ou 16–fim do mês)
- Cabeçalho com intervalo
- Top produtos mais vendidos (tabela com qtd e valor)
- Vendas por vendedora (qtd total e valor total)
- **Ranking** das vendedoras: por quantidade e por valor (duas tabelas lado a lado)
- Faturamento total da quinzena destacado

#### Relatório Mensal
- Vendedora destaque (maior valor vendido) — card destacado
- Faturamento total do mês
- Top produtos mais vendidos (tabela completa)
- Total de produtos vendidos no mês
- Comparativo entre vendedoras (tabela: Vendedora | Qtd | Valor | % do total)
- Seção "Produtos com maior giro" para apoio à reposição (top 20 por qtd vendida)

### 5. Regras de cálculo

- Filtrar `vendas.data` no intervalo + `vendas.deposito === lojaSelecionada`
- Para Parte 1 do Diário: somar `venda_pagamentos.valor` (não `vendas.total`), pois reflete corretamente vendas com split
- Demais partes: usar `vendas.total`, `quantidade`, `preco_unitario`
- Sem flag de cancelamento — todas as linhas em `vendas` contam (exclusão remove a linha)

### 6. Arquivos a criar/editar

**Criar:**
- `src/lib/pdf/fluxoCaixa.ts` — geração dos três PDFs (compartilha helpers de header, paleta, formatação BRL e data)
- `src/lib/pdf/pieChart.ts` — desenha gráfico de pizza em canvas e devolve dataURL

**Editar:**
- `src/pages/Relatorios.tsx` — nova aba "Fluxo de Caixa" com filtros e botão de geração

Sem alterações em hooks (já existem `useVendas`, `usePerfumes`, `useCasas`, `useConfiguracoesFiscais`, `useAuth`). Sem migrações.

### 7. Validações de UX

- Botão desabilitado enquanto carrega
- Toast de sucesso ao gerar; toast de erro se nenhum dado no período
- Para vendedor (role), seletor de loja desabilitado e fixo na sua loja
- Datas exibidas em formato brasileiro (dd/MM/yyyy), sempre em America/Manaus

---

Aguardando aprovação para implementar.