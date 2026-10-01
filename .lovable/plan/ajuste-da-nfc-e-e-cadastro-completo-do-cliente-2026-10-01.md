# Ajuste da NFC-e e cadastro completo do cliente

## Resultado
- Exibir na NFC-e somente `CASA - NOME - CONCENTRAÇÃO - VOLUME` como descrição do produto.
- Permitir selecionar ou cadastrar o cliente no fechamento da venda e enviar CPF/CNPJ à NFC-e quando informado.
- Ampliar o cadastro do cliente com dados pessoais, contato, endereço e observações, todos opcionais na tela.

## Implementação
1. Adicionar campos opcionais ao cadastro existente de clientes, sem remover ou substituir dados atuais.
2. Atualizar o formulário do caixa com seções de identificação, contato e endereço; quando o nome ficar vazio, salvar uma identificação neutra apenas para atender à estrutura legada.
3. Gravar o cliente selecionado em todos os itens da venda.
4. No servidor fiscal, buscar o cliente da venda, validar CPF/CNPJ pelo tamanho e incluir a identificação no XML da NFC-e somente quando preenchida corretamente.
5. Montar a descrição fiscal usando casa/marca, nome, concentração e volume, sem o código interno do produto.
6. Mostrar CPF/CNPJ também no DANFE e nos comprovantes quando houver identificação.
7. Validar compilação e o fluxo sem emitir uma nota real.

## Alterações de dados
- Migração aditiva e idempotente: somente novas colunas opcionais em `clientes`.
- Nenhum dado será apagado e nenhuma coluna antiga será removida ou alterada.

## Validação
- Conferir venda sem cliente, cliente sem CPF e cliente com CPF.
- Conferir no XML gerado as tags do destinatário e a descrição exata do produto.
- Conferir que a venda mantém o vínculo com o cliente selecionado.
