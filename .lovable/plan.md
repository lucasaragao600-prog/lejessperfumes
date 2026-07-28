
# Plano de Implementação — Lejess

Trabalho grande, dividido em 7 blocos. Sugiro **aprovar em fases** (1→2→3→...) para revisar cada entrega antes de seguir. Posso executar tudo de uma vez se preferir, mas o risco de regressão sobe.

---

## Fase 1 — Remoção do módulo Balanço

**Frontend**
- Deletar: `src/pages/BalancoEstoque.tsx`, `src/components/BalancoNovo.tsx`, `src/components/BalancoConferencia.tsx`, `src/components/BalancoDetalhes.tsx`, `src/hooks/useBalancos.ts`, `src/hooks/useBalancoLeituras.ts`.
- Remover rota e item de menu em `App.tsx` (via `Index.tsx`), `BottomNav.tsx`, `SidebarNav.tsx`, `QuickActionMenu.tsx`.
- Rodar `rg balanco` para garantir zero referências restantes (relatórios, dashboards, etc).

**Backend (migration)**
- `DROP TABLE` em cascata: `balanco_leituras`, `balanco_itens`, `balanco_auditoria`, `balancos` (com policies).

---

## Fase 2 — Módulo de Reposição

**Migration**
- `ALTER TABLE movimentacoes ADD COLUMN entregue_por uuid, conferido_por uuid, foto_saida_url text, foto_chegada_url text`.
- Criar bucket privado `reposicoes` + policies (leitura autenticados, escrita autenticados no próprio path).

**Frontend**
- Nova página `src/pages/Reposicao.tsx` + rota + menu.
- Sugestão automática reaproveitando lógica de `InteligenciaOperacional.tsx` (`mediaDiaria * diasReposicao − estoque atual`), agrupada por loja destino.
- Fluxo: gerar sugestão → conferente edita quantidades → tira foto saída (upload storage) → registra movimentação tipo `transferencia`/`entrada` → destinatário confirma chegada com foto → status atualiza.
- Bloqueio de salvar sem as 2 fotos.
- Aba "Histórico" com filtros (produto, loja, responsável, período).

---

## Fase 3 — Ajuste de Estoque com auditoria

**Migration**
- Criar `auditoria_estoque` (produto_id, loja, estoque_antes, estoque_depois, diferenca, motivo text NOT NULL, usuario_id, usuario_nome, created_at) + RLS + GRANT.

**Frontend**
- Novo `src/components/AjusteEstoqueDialog.tsx` substituindo `window.confirm` em `Estoque.tsx`.
- Campos: novo valor (readonly do input), diferença calculada, `<Select>` de motivo (Quebra, Perda, Erro de contagem, Correção, Outro) + `<Textarea>` obrigatório.
- Ao confirmar: aplica ajuste + insere linha em `auditoria_estoque`.
- Aba de consulta do log dentro de Relatórios.

---

## Fase 4 — Histórico do Item

**Frontend apenas** (dados já existem)
- Novo `src/components/HistoricoItemDialog.tsx` acionado por botão no card de produto (Estoque) e no Editar.
- Abas:
  1. **Custos** — timeline de `produto_custos` + `preco_historico` (linha, recharts).
  2. **Compras** — tabela `notas_fiscais_itens` join `notas_fiscais` (fornecedor, data, qtd, custo unit).
  3. **Vendas** — tabela + gráfico de tendência mensal por `vendas`.

---

## Fase 5 — Perfil Olfativo

**Migration**
- `ALTER TABLE perfumes ADD COLUMN perfil_olfativo text, notas_saida text[], notas_coracao text[], notas_fundo text[]`.

**Frontend**
- `CadastroPerfume.tsx` e `EditarPerfume.tsx`: nova seção "Perfil Olfativo" com Select de família (amadeirado/floral/cítrico/oriental/aquático/gourmand/aromático/chipre/fougère) + 3 inputs de tags (notas separadas por vírgula ou chips).
- Preenchimento 100% manual (sem scraping).

---

## Fase 6 — DRE (Despesas + Relatório)

**Migration**
- Criar tabela `despesas` conforme spec (categoria enum, descricao, valor, data, loja opcional, comprovante_url opcional, criado_por, created_at, updated_at + trigger).
- Bucket privado `comprovantes-despesas`.
- RLS: leitura autenticados; escrita master (via `has_role`).

**Frontend**
- `src/pages/Despesas.tsx` — lançamento (form) + lista com filtros por categoria/período/loja + upload comprovante.
- `src/pages/DRE.tsx` — período (mês/tri/ano/custom):
  - Receita bruta (`vendas.total`)
  - (−) CMV (soma custo médio × qtd vendida)
  - = Lucro Bruto
  - (−) Despesas agrupadas por categoria
  - = Resultado Líquido
  - Gráficos: barras por categoria + evolução mensal (recharts).
- Menu Master-only.

---

## Fase 7 — Higienizações técnicas

- **Lazy loading**: converter todas rotas em `Index.tsx` para `React.lazy()` + `<Suspense fallback={...}>`.
- **Testes vitest**:
  - `src/lib/reposicao.test.ts` — cálculo de sugestão.
  - `src/lib/dre.test.ts` — agregação de DRE.
  - `src/lib/ajusteEstoque.test.ts` — cálculo de diferença + validação de motivo.
- **Tipagem**: novos hooks 100% tipados via `Database` gerado; zero `any`.

---

## Detalhes técnicos

- Todas migrations seguem: CREATE TABLE → GRANT → ENABLE RLS → CREATE POLICY.
- RLS de escrita nas novas tabelas usa `has_role(auth.uid(),'master')`.
- Buckets novos são **privados** com signed URLs (fotos podem conter info sensível).
- Ordem dos DROPs na Fase 1 respeita FKs.

---

## Como prefere executar?

**A)** Aprovo tudo, você entrega em sequência (7 fases, várias horas de trabalho, PR gigante).
**B)** Aprovo fase a fase — envio "ok fase 1", revejo, "ok fase 2", etc. **(recomendado)**
**C)** Priorizar subset — me diga quais fases entram primeiro.
