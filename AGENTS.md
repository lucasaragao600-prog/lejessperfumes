
- Cancelamento/devolução/troca/crédito só via RPCs fn_venda_cancelar, fn_devolucao_registrar, fn_troca_registrar, fn_credito_usar; vendas canceladas ficam com cancelada=true e saem de useVendas — por quê: estoque, caixa e auditoria atômicos no banco.
