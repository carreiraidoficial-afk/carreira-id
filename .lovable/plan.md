## Objetivo
Fornecer ao usuário o código das edge functions dedicadas ao Carreira para que ele possa criá-las manualmente no Supabase (copy-paste), sem depender do deploy automático do Lovable Cloud.

## Edge functions entregues
1. `carreira-asaas-create-subaccount` — cria subconta no Asaas usando a conta raiz Atleta ID.
2. `carreira-asaas-check-account-status` — consulta status da subconta Carreira.
3. `carreira-asaas-send-documents` — envia documentos do bucket para análise Asaas.
4. `carreira-asaas-configure-webhook` — configura webhook de pagamentos na subconta Carreira (código novo, adaptado da versão escolinha).
5. `carreira-asaas-submit-registration` — orquestrador que chama create-subaccount e send-documents em sequência.

## Secrets necessários no Supabase
- `ASAAS_API_KEY` — chave da conta raiz Atleta ID (para criar subconta).
- `ASAAS_CARREIRA_API_KEY` — chave da subconta Carreira (fallback usado por check-status/configure-webhook).
- `ASAAS_WEBHOOK_TOKEN` — token de validação do webhook.
- `ASAAS_CARREIRA_WEBHOOK_TOKEN` — token dedicado do Carreira (fallback para `ASAAS_WEBHOOK_TOKEN`).
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — já gerenciados pelo Supabase.

## Fora de escopo
- Não alterar arquivos do projeto Lovable nesta etapa (usuário fará deploy manual).
- Não habilitar Lovable Cloud.
- Não configurar GitHub Actions.