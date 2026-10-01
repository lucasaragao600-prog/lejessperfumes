
- Cancelamento/devolução/troca/crédito só via RPCs fn_venda_cancelar, fn_devolucao_registrar, fn_troca_registrar, fn_credito_usar; vendas canceladas ficam com cancelada=true e saem de useVendas — por quê: estoque, caixa e auditoria atômicos no banco.
- Estoque lista/totais vêm de fn_estoque_listar/fn_estoque_resumo (useEstoqueLista, 30 por página) — por quê: não depender da carga global e respeitar acesso por unidade no banco.
- NFC-e identifies the customer only from the sale's cliente_id and a valid CPF/CNPJ stored in clientes — why: the fiscal XML must use persisted, server-validated data.
- AppProvider wraps the routed application once at the App root — why: shared menus and pages must never render outside application state during navigation or hot reload.
- Decants: ml balances live only in the append-only decant_ml_ledger and change only through fn_decant_* RPCs (row lock + idempotency key); the module is gated by configuracoes key 'decants' — why: no negative ml, full audit trail, and the module can be switched off without touching existing flows.
