## Objetivo
Replicar o fluxo já testado do Atleta ID (cadastro bancário + upload de documentos + envio à análise + acompanhamento de status Asaas) dentro do admin do Carreira ID, e usá-lo para criar a **subconta Asaas dedicada ao Carreira** (mesmo CNPJ, já autorizado). Após a subconta ficar aprovada, a `apiKey` retornada será salva num secret exclusivo do Carreira e todas as edge functions de cobrança do Carreira passam a usar essa chave — sem afetar Atleta/Escolinhas.

## Parte 1 — Nova aba "Banco" no admin Carreira

### Rota e navegação
- Nova página `CarreiraAdminBancoPage.tsx` montada em `/carreira/admin/banco`.
- Item "Banco" (ícone `Landmark`) adicionado à sidebar do `CarreiraAdminLayout` logo abaixo de "Assinaturas".
- Acesso restrito ao admin `carreiraidoficial@gmail.com` (mesmo guard das outras páginas admin do Carreira).

### Componentes reaproveitados do fluxo Atleta/Escolinha
Vou **forkar** os três componentes hoje escopados por `escolinha_id` para uma versão "singleton" do Carreira, sem mexer nos originais:

- `src/components/carreira/admin/CadastroBancarioCarreiraForm.tsx` — cópia enxuta do `school/CadastroBancarioForm.tsx` operando sobre a nova tabela `carreira_cadastro_bancario` (linha única). Mesmos campos: Tipo (PF/CNPJ, default CNPJ e travado para este caso), Nome/Razão Social, e-mail, telefone, data de nascimento (só PF), renda mensal, CEP+endereço, dados bancários (banco, agência, conta, tipo de conta). Validações e máscaras iguais.
- `src/components/carreira/admin/AsaasStatusTimelineCarreira.tsx` — mesma timeline (Cadastro Preenchido → Documentos → Enviado para Análise → Conta Aprovada) lendo os campos `asaas_status`, `asaas_enviado_em`, `asaas_account_id` do registro Carreira.
- `src/components/carreira/admin/DocumentUploadCarreira.tsx` — cópia do `DocumentUploadSection` para o bucket novo `carreira-asaas-documentos`, listando documentos exigidos para PJ (contrato social, CNPJ, doc do responsável).

Botões de ação da página (idênticos aos do Atleta):
- **Salvar cadastro** — grava/atualiza a linha em `carreira_cadastro_bancario`.
- **Enviar para validação** — chama a nova edge `carreira-asaas-create-subaccount`.
- **Consultar Cadastro Asaas** — chama a nova edge `carreira-asaas-check-account-status` e atualiza a timeline.
- **Verificar Status no Asaas** (botão do bloco de status) — mesmo endpoint acima.

Pré-preenchimento com os dados do Atleta ID: no primeiro load, se não existe linha em `carreira_cadastro_bancario`, o form vem preenchido com:
- Nome/Razão Social, CNPJ, endereço, telefone, renda mensal e dados bancários copiados de `escola_cadastro_bancario` da conta raiz Atleta ID (mesma pessoa jurídica).
- E-mail: `contato@carreiraid.com.br` (fixo, editável).
- Telefone: `21969622045` (fixo, editável).
- Tipo: `cnpj`.

O admin revisa, salva e envia.

## Parte 2 — Backend (tabela + storage + RLS)

Nova migration:

```text
carreira_cadastro_bancario  (linha única — id UUID, singleton lógico)
  ├─ tipo_pessoa, nome, email, telefone, data_nascimento, income_value
  ├─ cep, rua, numero, complemento, bairro, cidade, estado
  ├─ banco, agencia, conta, tipo_conta
  ├─ asaas_account_id, asaas_wallet_id, asaas_status, asaas_status_detail
  ├─ asaas_enviado_em, asaas_atualizado_em
  └─ created_at / updated_at

carreira_asaas_jobs         (auditoria — mesmo shape do escola_asaas_jobs)
carreira_asaas_documentos   (documentos anexados — bucket + status)
```

- Bucket privado `carreira-asaas-documentos` com policies admin-only.
- Grants + RLS: leitura/escrita apenas para `has_role(auth.uid(), 'admin')` (padrão do projeto). `service_role` full.
- A `apiKey` retornada pelo Asaas **NÃO é gravada em texto** aqui — vai só para o secret `ASAAS_CARREIRA_API_KEY`. Guardamos apenas `asaas_account_id`, `asaas_wallet_id` e um flag `api_key_stored: true`.

## Parte 3 — Edge functions dedicadas ao Carreira

Forks das funções Atleta com o CNPJ vindo do registro Carreira e usando `ASAAS_API_KEY` da conta raiz (Atleta ID) para criar a subconta:

- `supabase/functions/carreira-asaas-create-subaccount/index.ts` — `POST /v3/accounts` com os dados do form; grava `asaas_account_id`/`walletId` na tabela; **retorna a apiKey uma única vez** para o admin salvar no secret via `add_secret` (fluxo guiado na UI).
- `supabase/functions/carreira-asaas-check-account-status/index.ts` — `GET /v3/myAccount/status` usando `ASAAS_CARREIRA_API_KEY` (quando já configurada), atualizando `asaas_status` no banco.
- `supabase/functions/carreira-asaas-send-documents/index.ts` — envia os arquivos do bucket para `/v3/myAccount/documents/{id}` usando `ASAAS_CARREIRA_API_KEY`.
- `supabase/functions/carreira-asaas-configure-webhook/index.ts` — cria webhook da subconta apontando para o mesmo `asaas-webhook` do projeto, com token dedicado `ASAAS_CARREIRA_WEBHOOK_TOKEN` (gerado via `generate_secret`).

## Parte 4 — Ativar o secret e migrar as functions Carreira

Após a subconta ser aprovada:
1. UI mostra um botão "Salvar chave da subconta" que aciona `secrets--add_secret` para `ASAAS_CARREIRA_API_KEY` e (opcional) `ASAAS_CARREIRA_WALLET_ID`.
2. Refatoro para usar `ASAAS_CARREIRA_API_KEY` (com fallback + erro claro se ainda não estiver setada):
   - `create-carreira-checkout`
   - `generate-carreira-pix`
   - `renew-carreira-pix`
   - `create-carreira-subscription` / `cancel-carreira-subscription` (as novas do plano de recorrência já aprovado)
3. `asaas-webhook` ganha roteamento por origem: se `externalReference` começa com `carreira_` **ou** o header `asaas-access-token` bate com `ASAAS_CARREIRA_WEBHOOK_TOKEN`, entra no bloco Carreira.

## Fora de escopo
- Não altero o fluxo Atleta/Escolinha existente.
- Não gero variantes de imagem/thumbnails no servidor.
- A migração é forward-only: cobranças Carreira antigas emitidas na conta raiz continuam sendo pagas normalmente.

## Arquivos afetados
- **Novos**: `src/pages/carreira/admin/CarreiraAdminBancoPage.tsx`, `src/components/carreira/admin/CadastroBancarioCarreiraForm.tsx`, `src/components/carreira/admin/AsaasStatusTimelineCarreira.tsx`, `src/components/carreira/admin/DocumentUploadCarreira.tsx`, `supabase/functions/carreira-asaas-{create-subaccount,check-account-status,send-documents,configure-webhook}/index.ts`, migration `carreira_cadastro_bancario` + bucket + RLS, `docs/asaas-subconta-carreira.md`.
- **Editados**: `src/components/layout/CarreiraAdminLayout.tsx` (nova aba), `src/App.tsx` (rota), `supabase/functions/asaas-webhook/index.ts` (roteamento por conta) e as functions Carreira listadas na Parte 4.
- **Novos secrets runtime** (criados só após a subconta ser aprovada): `ASAAS_CARREIRA_API_KEY`, `ASAAS_CARREIRA_WEBHOOK_TOKEN`.

## Pré-requisito de plataforma
Este plano exige **Lovable Cloud habilitado** (edge functions + secrets + storage). Meu contexto atual indica que ele está desabilitado. Antes de eu começar a implementar, ative Lovable Cloud em Connectors → Lovable Cloud → Tool Permissions.