# Verificação da integração Asaas (assinatura recorrente + webhook)

Agora que o `ASAAS_WEBHOOK_TOKEN` está salvo no Supabase, faltam 2 passos de configuração + 3 testes.

## 1. Configurar o webhook no painel Asaas

No painel Asaas → **Configurações → Integrações → Webhooks → Adicionar**:

- **URL**: `https://fppsotlycinwqsjpoybg.supabase.co/functions/v1/asaas-webhook`
- **Email para notificação de falhas**: seu email
- **Versão da API**: v3
- **Token de autenticação**: cole o MESMO valor que você salvou em `ASAAS_WEBHOOK_TOKEN`
- **Enviar tipo**: `SEQUENCIALMENTE`
- **Eventos a marcar**:
  - Pagamentos: `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`, `PAYMENT_REFUNDED`, `PAYMENT_DELETED`
  - Assinaturas: `SUBSCRIPTION_DELETED`, `SUBSCRIPTION_INACTIVATED`
- Salvar e deixar **ativo**

## 2. Confirmar que a Edge Function está publicada

Vou verificar via logs se `asaas-webhook`, `create-carreira-checkout` e `check-carreira-payment` estão deployadas e sem erros de boot.

## 3. Testes end-to-end

### Teste A — Assinatura por cartão (sandbox)
1. Logar num usuário de teste, ir num atleta e disparar o paywall (`/cadastro` → escolher plano).
2. Escolher **Cartão** + CPF → clicar "Assinar por R$ 12,00/mês".
3. Verificar via logs da function `create-carreira-checkout`:
   - Requisição a `POST /v3/subscriptions` retornou `id` (sub_xxx)
   - Linha em `carreira_assinaturas` criada com `status='pendente'`, `metodo_pagamento='cartao_credito'`, `gateway_subscription_id=sub_xxx`
4. Aba do Asaas abre → preencher cartão sandbox (`5162 3062 5477 9138`, val futura, CVV 123).
5. Após pagar, Asaas dispara `PAYMENT_CONFIRMED` → logs de `asaas-webhook` mostram evento recebido → linha vira `status='ativa'` e `expira_em = hoje+30`.
6. UI faz polling e mostra tela "Pagamento confirmado 🎉".

### Teste B — Assinatura por PIX
1. Mesmo fluxo, escolher **PIX**.
2. `generate-carreira-pix` cria pagamento + retorna QR.
3. Pagar no sandbox → webhook recebe `PAYMENT_RECEIVED` → `status='ativa'`.

### Teste C — Segurança do webhook
Vou fazer um POST manual (sem o header `asaas-access-token`) e confirmar retorno **401**. Com o token correto → **200**.

## 4. O que checo agora (parte técnica)

- Listar as últimas invocações de `asaas-webhook`, `create-carreira-checkout` e `check-carreira-payment` (logs de erro/boot).
- Query em `carreira_assinaturas` para ver as últimas linhas criadas com `gateway_subscription_id` preenchido — confirma que já está gravando o ID da assinatura Asaas, não só de payment.
- Testar o endpoint do webhook diretamente (com e sem token) para validar a proteção.

## Após aprovar

Executo os checks técnicos, te digo o resultado e, se algo estiver quebrado (ex.: subscription não sendo criada, webhook rejeitando token válido, status não atualizando), corrijo na sequência. Se estiver tudo verde, você só precisa cadastrar o webhook no Asaas conforme o passo 1 e rodar o Teste A no sandbox.
