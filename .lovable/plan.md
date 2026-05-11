## Plano de Implementação — Estoque

Duas features novas na página `src/pages/Estoque.tsx`, sem alterar funcionalidades existentes.

---

### Feature 1 — Botão de alerta para produtos sem código de barras

**Onde**: ao lado do botão vermelho de alerta de estoque já existente (header de `Estoque.tsx`, linha ~211-235).

**Comportamento**:
- Novo botão com ícone `Barcode` (lucide) + badge numérica com a contagem de produtos sem `codigoBarras`.
- Estado: amarelo/âmbar (`warning`) quando há pendentes; neutro (btn-secondary) quando zerado.
- Animação `animate-pulse` discreta na badge quando `count > 0`.
- Mesmo padrão visual: `rounded-xl`, hover suave, font Inter, dark theme.
- Ao clicar abre um **Dialog** (shadcn) listando todos os produtos sem código de barras com:
  - Nome, Marca, Tipo (categoria), SKU (`codigo`), Estoque total
  - Botão "Editar" → abre o modal `EditarPerfume` já existente (passa o perfume ao `setEditandoPerfume`)
- Empty state: "Todos os produtos possuem código de barras cadastrado".
- Lista é derivada de `perfumes` (já em memória via `useApp`), filtrando `!p.codigoBarras?.trim()`. A badge recalcula automaticamente via `useMemo`, então editar um produto atualiza na hora.
- Sem alteração de schema/backend — performance OK pois `perfumes` já está cached pelo react-query.

---

### Feature 2 — Filtro por estoque/local baseado em histórico de movimentação

**Regra**: ao selecionar um depósito específico (Casa / Sumaúma / Amazonas / futuros), só listar produtos que tiveram **alguma** movimentação nesse local.

**Fonte de verdade**: tabela `movimentacoes` (campos `perfume_id`, `deposito`, `deposito_origem`, `deposito_destino`) + tabela `vendas` (`perfume_id`, `deposito`).

**Implementação**:
1. Novo hook `useMovimentacoesPorDeposito()` (ou aproveitar `useMovimentacoes` + `useVendas` já carregados via `useApp`).
2. Construir um `Map<deposito, Set<perfumeId>>` via `useMemo` cruzando:
   - cada `movimentacao` → adiciona `perfumeId` em `deposito`, `depositoOrigem`, `depositoDestino` (quando preenchidos)
   - cada `venda` → adiciona `perfumeId` em `deposito`
3. No `filtrados`, quando `effectiveDeposito !== "Todos"`, exigir `historicoSet.get(deposito)?.has(p.id)`.
4. Filtro "Todos" continua mostrando tudo. Funciona automaticamente para novos depósitos (sem hardcode).
5. Produto com estoque zero mas com histórico **continua aparecendo**.
6. Empty state quando lista vazia por esse motivo: "Nenhum produto possui movimentação registrada neste estoque."
7. Cards de resumo financeiro continuam usando `filtrados` (já dependem do filtro — comportamento atual preservado).

**Performance**: o cruzamento é O(n) sobre movimentações + vendas, executado uma vez por mudança via `useMemo`. Os hooks já paginam recursivamente via `.range()` para superar 1000 linhas.

---

### Arquivos alterados
- `src/pages/Estoque.tsx` (header com novo botão + modal de produtos sem barcode + lógica de filtro por histórico)

Sem migrações de banco, sem mudança em `EditarPerfume`/`CadastroPerfume`, sem alteração de outros filtros.

Aguardando aprovação para implementar.