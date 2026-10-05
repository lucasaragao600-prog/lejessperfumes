# Módulo de Configurações Fiscais (perfis tributários + validação antes de emitir)

## Situação atual (validada)
- A rejeição 215 da nota #1AC17826 já foi corrigida: o produto usava CSOSN 500 (ST) e o XML só sabia montar o grupo do CSOSN 102. Falta reenviar a nota.
- A emissão é própria do sistema, sem provedor pago: o backend monta e assina o XML 4.00 (com IBS/CBS) e um relay no Fly.io envia direto à SEFAZ-AM.
- Os dados do emitente já ficam por loja (CNPJ, IE, CRT, série, CSC, ambiente), e os segredos (senha do certificado e CSC) nunca chegam à tela.
- Hoje o produto guarda só NCM, CFOP, CSOSN, código de barras e unidade fiscal. Origem, CEST, PIS/COFINS e IBS/CBS vão fixos no XML.

## Suposições
1. Todas as lojas estão no Simples Nacional (CRT 1). Os campos do regime normal (CST, alíquota, redução de base, ST/MVA) entram preparados, mas o XML só monta o grupo de cada um quando ele for escolhido.
2. Perfume é quase sempre NCM 3303.00.10, com ST no AM (CFOP 5405 + CSOSN 500) ou sem ST (5102 + 102). O sistema vai sugerir esses dois perfis.
3. Não vamos criar uma tabela nova para o emitente: aproveitamos os dados fiscais por loja que já existem e só acrescentamos campos (CNAE, IM, código IBGE, validade do certificado).
4. A tabela oficial de NCM não será importada inteira. Validamos o formato (8 dígitos) e uma lista de NCMs aceitos que você pode editar.
5. A validação pelo XSD oficial roda no backend, antes do envio, com os arquivos da versão vigente (PL 4.00 / NT da reforma).

## Etapas (cada uma para e aguarda aprovação)
**Etapa 1 – Base de dados e perfis**
- Novas tabelas: `perfil_tributario`, `produto_fiscal` (1:1 com o produto, herda do perfil e pode sobrescrever campos), `historico_fiscal` (antes/depois, quem, quando) e `nfce_tentativas` (cada envio com retorno, protocolo e XML).
- Todas as alterações são só acréscimos, com RLS e permissão `fiscal.configurar` (Master).
- Uma função no banco calcula o status fiscal de cada produto: Completo, Incompleto ou Com erro.
- Os dados atuais (NCM, CFOP, CSOSN) são copiados para `produto_fiscal` sem apagar as colunas antigas.

**Etapa 2 – Telas**
- Configurações > Fiscal, com as abas Empresa, Produtos, Perfis tributários, Certificado, Numeração e Histórico.
- CRUD de perfis: criar, editar, duplicar e arquivar.
- Aplicação em massa com busca, filtros, "selecionar todos do filtro", prévia antes/depois e escolha entre sobrescrever ou preencher só os vazios, herdando ou copiando do perfil.
- Seção "Fiscal" na edição do produto, com seletor de perfil e campos avançados.
- Painel "X produtos com cadastro fiscal incompleto" e etiqueta de status na lista de produtos.
- Perfil padrão por categoria (Árabe, Importado, Nicho) para produtos novos.
- Exportar e importar dados fiscais por planilha.

**Etapa 3 – Validação e XML**
- Um validador comum (frontend e backend) para NCM, CFOP×CSOSN/CST, regime×CSOSN/CST, dígito do GTIN, unidade e dados do emitente.
- A nota é bloqueada antes de reservar o número, mostrando o produto e o campo, com link para a edição.
- O XML é montado com os dados de `produto_fiscal` já resolvidos com o perfil: grupos ICMS SN101/102/500/900 e CST 00/20/60, origem, CEST, PIS/COFINS e IBS/CBS por produto.
- Validação pelo XSD no backend antes de transmitir.
- Testes unitários do validador e da montagem do XML.

**Etapa 4 – Nota rejeitada**
- Tradução dos principais códigos da SEFAZ (215, 225, 386, 539, 778 etc.) em causa provável e ação sugerida.
- Botão "Corrigir e reenviar", que abre o campo com problema.
- Histórico de tentativas na tela da venda, mostrando uma só mensagem (sem toast repetido).
- Checklist de homologação e uma documentação curta.

## Riscos
- O PDV emite notas reais todos os dias. Por isso a troca da montagem do XML (Etapa 3) só passa a valer após um teste em homologação. Até lá a regra atual continua.
- Alterar um perfil afeta todos os produtos vinculados a ele, por isso haverá prévia e histórico antes de cada alteração.

## Técnico
- Herança: valor efetivo = sobrescrita do produto, depois perfil, depois padrão da loja; calculado por `fn_produto_fiscal_resolver` (SECURITY DEFINER), usada pela edge function `fiscal-sefaz`.
- Aplicação em massa só pela RPC `fn_perfil_aplicar(perfil, produtos[], modo, vinculo)`, com trava e auditoria; nunca por UPDATE direto do navegador.
- Rollback escrito para cada migração.
