# Fase 7 — Acompanhamento fiscal de trocas e devoluções

## Entregue
- Situação fiscal na Central: pendente, análise contábil, rejeição e NF-e de entrada informada.
- Detalhe sob demanda vincula a venda original e suas NFC-e; a saída dos novos produtos é mostrada separadamente.
- Atualização administrativa exige `fiscal.configurar` na unidade, bloqueio de concorrência e auditoria.
- Chave de entrada exige 44 dígitos, modelo 55, dígito verificador e CNPJ da unidade recebedora.
- Trocas e devoluções não alteram mais o status autorizado da NFC-e original. Não existe cancelamento automático.
- CNPJs diferentes geram aviso para tratamento contábil; CNPJ ausente aparece como não conferido.
- Nenhuma emissão SEFAZ foi executada nos testes; nenhum saldo ou documento de teste persistiu.

## Limites e riscos
- **Não é emissão de NF-e de entrada.** A integração atual emite NFC-e de saída (modelo 65); emissão modelo 55 depende de integração e configuração contábil de CFOP, CST/CSOSN, tributos e natureza da operação.
- “Documento informado” é vínculo administrativo, não confirmação de autorização SEFAZ. Não foi criada opção manual de “autorizada”.
- Rejeições de entrada são anotadas pelo responsável fiscal; não são respostas automáticas de um emissor modelo 55.
- A unidade usada no teste não possui CNPJ completo. Sem o cadastro real, a vinculação de chave é bloqueada.
- Não foram alterados documentos fiscais antigos. Eventual status legado `PENDENTE_DEVOLUCAO_FISCAL` permanece sem correção retroativa.
- Banco sem devoluções reais. A Central autenticada e o diálogo de busca foram conferidos; **o novo formulário não foi validado ponta a ponta com uma devolução real**. Não foram criadas operações permanentes apenas para testar.

## Arquivos
- `src/lib/devolucaoFiscal.ts` e `src/lib/devolucaoFiscal.test.ts`
- `src/hooks/useDevolucaoFiscal.ts`
- `src/components/fiscal/FiscalDevolucao.tsx`
- `src/hooks/useDevolucoes.ts`
- `src/pages/TrocasDevolucoes.tsx`
- `supabase/tests/devolucao_fiscal.sql`
- `AGENTS.md`, `roadmap.md` e este relatório.
- Tipos da integração atualizados automaticamente.

## Migração
- `drizzle/migrations/0054_devolucao_acompanhamento_fiscal.sql`: cinco campos aditivos, índice, duas RPCs e proteção do status original por trigger. Sem exclusões.

## Validação executada
- 74 testes Vitest passaram.
- Teste SQL transacional com rollback passou: devolução comercial, NFC-e original preservada, pendência vinculada, rejeição anotada, autorização manual recusada, chave modelo 55, auditoria e acesso anônimo recusado.
- Confirmação pós-teste: zero devoluções e zero notas de teste persistidas; execução anônima da RPC negada.
- Compilação sem erros; Central autenticada abre na página principal, sem erros de execução capturados.

## Consultas de validação
```sql
SELECT numero, fiscal_status, fiscal_chave_entrada,
       fiscal_atualizado_por, fiscal_atualizado_em
FROM public.devolucoes
ORDER BY created_at DESC LIMIT 30;

SELECT d.numero, n.numero_nfce, n.status
FROM public.devolucoes d
JOIN public.nfce_emissoes n
  ON n.venda_grupo_venda = d.grupo_venda_origem
ORDER BY d.created_at DESC LIMIT 30;

SELECT acao, entidade_id, created_at
FROM public.audit_logs
WHERE acao = 'DEVOLUCAO_FISCAL_TRATADA'
ORDER BY created_at DESC LIMIT 30;
```

## Roteiro para aprovação
1. Em uma devolução real, abrir Trocas e expandir o registro: conferir vínculo original e situação fiscal.
2. Como responsável com permissão, abrir Tratar fiscal; registrar análise ou rejeição com observação.
3. Reabrir o registro: confirmar situação, nome e data persistidos.
4. Informar chave real de NF-e de entrada da unidade recebedora; conferir bloqueio de chave inválida/modelo 65/CNPJ divergente.
5. Em troca, conferir venda de saída separada; em troca entre CNPJs, conferir aviso contábil.
6. Conferir que NFC-e original permanece autorizada e que nenhum documento é cancelado automaticamente.

**Parada:** aguardar aprovação do acompanhamento entregue; emissão modelo 55 permanece pendente da integração e validação contábil.