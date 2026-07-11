# Subconta Asaas — Carreira ID

Fluxo replicado do Atleta ID para criar uma **subconta Asaas dedicada ao Carreira ID** (mesmo CNPJ, autorização já concedida pelo Asaas). Uma vez aprovada, a `apiKey` da subconta passa a ser usada pelas edge functions de cobrança do Carreira, mantendo Atleta e Carreira financeiramente separados.

## Passos de deploy no Supabase (`fppsotlycinwqsjpoybg`)

### 1) Rodar a migration

No SQL Editor do Supabase, cole e execute o conteúdo de `01_migration.sql`. Cria:

- `public.carreira_cadastro_bancario` (singleton — 1 linha)
- `public.carreira_documentos`
- `public.carreira_asaas_jobs`
- bucket privado `carreira-asaas-documentos` + policies admin-only
- trigger `updated_at`

RLS: apenas `has_role(auth.uid(), 'admin')` lê/escreve.

### 2) Deploy das edge functions

```bash
supabase functions deploy carreira-asaas-create-subaccount --project-ref fppsotlycinwqsjpoybg
supabase functions deploy carreira-asaas-send-documents    --project-ref fppsotlycinwqsjpoybg
supabase functions deploy carreira-asaas-check-account-status --project-ref fppsotlycinwqsjpoybg
supabase functions deploy carreira-asaas-submit-registration --project-ref fppsotlycinwqsjpoybg
```

Elas usam:
- `ASAAS_API_KEY` (chave da conta raiz Atleta ID, já configurada) — apenas para **criar** a subconta.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (automáticos).
- Após a criação, cada consulta/envio de docs usa a `asaas_api_key` gravada na tabela (retornada pelo Asaas na criação da subconta).

### 3) Uso no admin

`/carreira/admin/banco` (item **Banco** no menu do admin do Carreira). Fluxo:

1. Formulário pré-preenchido com dados do Atleta ID (mesmo CNPJ), com `email = contato@carreiraid.com.br` e `telefone = 21969622045`.
2. **Salvar cadastro** → grava/atualiza a linha em `carreira_cadastro_bancario`.
3. Upload dos documentos (Contrato Social + Doc do responsável para CNPJ).
4. **Enviar para validação** → chama `carreira-asaas-submit-registration`, que dispara `create-subaccount` e depois `send-documents`.
5. **Consultar status no Asaas** → chama `carreira-asaas-check-account-status` e atualiza a timeline.

### 4) Após a aprovação

Quando a subconta ficar `APPROVED`, grave a chave da subconta (`asaas_api_key`) como secret dedicado:

```
ASAAS_CARREIRA_API_KEY = <apiKey retornada pelo Asaas>
```

Isso será o próximo passo (Parte 4 do plano): refatorar `create-carreira-checkout`, `generate-carreira-pix`, `renew-carreira-pix` e as futuras `*-carreira-subscription` para usarem `ASAAS_CARREIRA_API_KEY` em vez de `ASAAS_API_KEY`, e roteamento por origem no `asaas-webhook`.