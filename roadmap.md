# Roadmap Le Jess

- [x] Estoque — Todos mostra todos os depósitos; filtro individual mostra somente o selecionado no resumo e produtos. Sete testes aprovados; cada depósito e retorno a Todos validados na tela autenticada. Sem migração ou alteração de saldos.

- [x] Varredura filtro Estoque — 1.677 saldos por unidade conferidos com dados reais: páginas, resumo, exportação e ordenação; 91 associações produto/loja antes ocultas, todas contempladas pela correção global.
- [x] Correção filtro Estoque — saldo positivo incluído sem histórico anterior; Amazonica validada na UI, lista, resumo e exportação (5 unidades), testes do hook aprovados.
- [x] Fase 1A — Cancelamento, devolução, troca, crédito
- [ ] Fase 1B-DIRETA — NFC-e direto na SEFAZ-AM (serviço fiscal separado + edge functions). Etapas: 1 segredos/certificado, 2 XML/assinatura/XSD, 3 homologação, 4 eventos, 5 contingência, 6 DANFE/interface, 7 produção — aguardando: escolha do servidor, certificado A1, credenciamento e CSC
- [ ] Fase 1C — Desempenho (✅ Estoque → ✅ Vendas → ✅ Pedidos → ✅ Movimentações → ✅ carga global sob demanda aguardando validação; PDV busca no servidor; medições antes/depois)
- [ ] Fase 1D — Governança do PDV (limite de desconto + PIN gerente, preço mínimo, vendedora como entidade, comissão, venda suspensa, orçamento/reserva)
- [x] Ajuste NFC-e/Clientes — descrição fiscal padronizada, CPF/CNPJ na nota e cadastro opcional ampliado
- [x] Decants Fase 1 (frascos, ledger de ml, tamanhos, conferência) — aguardando aprovação
- [x] Decants Fase 2 (SKUs, ficha técnica, lotes, reserva, conferência) — aguardando aprovação
- [x] Decants Fase 3 (estoque, PDV, cancelamento, devolução, inventário, transferências) — aguardando aprovação
- [x] Decants Fase 4 (perdas, dashboard, 360°, rentabilidade, comparativo, relatórios) — aguardando aprovação
- [ ] Decants Fases seguintes — aguardando aprovação da Fase 4
- [x] NT Etapa 1 — base (tabelas, numeração NT-AAAA-NNNNNN, imutabilidade, aba Notas, PDF/QR /nt/:codigo) — aguardando aprovação
- [x] NT Etapa 2 — emissão automática (Transferências, Decants, Reposição atômica, manual 1 por produto + envio direto) — aguardando aprovação
- [x] NT Etapa 3 — PDF A4 com 3 vias e assinaturas, térmica 72 mm, registro de impressão, QR com detalhes para logado — aguardando aprovação
- [x] NT Etapa 4 — cartão da nota nos detalhes, aba Notas com filtros/CSV, configuração, alerta sem recebimento — aguardando aprovação
- [x] NT Etapa 5 — notas retroativas (uma por vez, só Master, sem mexer no estoque) — aguardando aprovação
- [x] Fiscal Etapa 1 — perfis tributários, produto_fiscal, histórico, tentativas (banco) — aguardando aprovação
- [x] Fiscal Etapa 2 — telas (produtos, perfis, massa, histórico, CSV) — aguardando aprovação
- [x] Fiscal Etapa 3 — validação antes de emitir + XML a partir do perfil — aguardando aprovação
- [x] Fiscal Etapa 4 — tentativas na tela da NFC-e, corrigir e reenviar, sem mensagem duplicada — aguardando aprovação
- [ ] Fiscal — conferência pelo XSD oficial antes do envio (não feita)
- [x] Trocas/Devoluções Fases 1–5 — entrada central, quarentena, permissões, Central, reembolso confirmado
- [x] Trocas/Devoluções Fase 6 — troca entre unidades (0052/0053, teste SQL transacional) — aprovada
- [x] Trocas/Devoluções Fase 7A — acompanhamento fiscal, vínculos, análise/rejeição e preservação da NFC-e original (0054; 74 testes; SQL rollback). Relatório: docs/trocas-fase7-validacao.md. Aguardar aprovação; formulário com devolução real não verificado porque não há registros.
- [ ] Trocas/Devoluções Fase 7B — emissão e acompanhamento automático de NF-e de entrada modelo 55 — bloqueada pela integração específica e validação contábil (CFOP/CST/CSOSN/tributos/natureza); CNPJ real da unidade recebedora necessário.
