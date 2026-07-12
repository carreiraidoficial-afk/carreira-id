## Diagnóstico

A cobrança recorrente no cartão **NÃO está funcionando** hoje. O que existe:

- `create-carreira-checkout` chama `POST /v3/payments` do Asaas com `billingType: 'UNDEFINED'` e devolve o `invoiceUrl`. Isso cria **uma cobrança avulsa** (o cliente escolhe cartão ou PIX na tela do Asaas), sem qualquer vínculo de recorrência.
- Não existe chamada a `POST /v3/subscriptions`, nem token de cartão salvo, nem `cycle: 'MONTHLY'`.
- Consequência: o cartão só é cobrado uma vez. Depois de 30 dias nada acontece — o `renew-carreira-pix` só renova quem tem `metodo_pagamento = 'pix'`.
- A UI (`CarreiraPaywall`) promete "Cobrança mensal automática" no cartão, o que hoje é falso.

## Plano de correção

### 1. `create-carreira-checkout` — trocar Payment por Subscription

Quando `paymentMethod = 'cartao'` (default do novo modelo), criar uma **assinatura Asaas** em vez de um pagamento único:

```ts
POST /v3/subscriptions
{
  customer: customerId,
  billingType: 'CREDIT_CARD',
  cycle: 'MONTHLY',
  value: 12.00,
  nextDueDate: <hoje + 7 dias do trial, ou hoje+1 se não for trial>,
  description: 'Carreira ID Premium - Assinatura mensal',
  externalReference: `carreira_premium_${user_id}_${crianca_id}`,
}
```

Retornar o `invoiceUrl` da primeira cobrança (Asaas gera automaticamente e devolve em `subscription.id` + primeiro payment via `GET /subscriptions/{id}/payments`). Abrir esse `invoiceUrl` numa aba — o Asaas coleta e tokeniza o cartão, e a partir daí cobra sozinho todo mês.

Salvar na `carreira_assinaturas`:
- `gateway_subscription_id` = `subscription.id` (não mais o `payment.id`)
- `metodo_pagamento = 'cartao_credito'`
- `status = 'pendente'` até o primeiro pagamento confirmar

### 2. `check-carreira-payment` — suportar subscription

Hoje ele consulta `/v3/payments/{id}`. Precisa aceitar também o caso de subscription:
- Se o registro tem `metodo_pagamento = 'cartao_credito'`, consultar `GET /v3/subscriptions/{id}/payments?limit=1&order=desc` e checar o status do payment mais recente.
- Ao confirmar o primeiro pagamento, marcar `status = 'ativa'` e `expira_em = hoje + 30`.

### 3. Webhook recorrente (novo endpoint)

Criar `supabase/functions/asaas-webhook/index.ts` (com `verify_jwt = false` no `config.toml`) para receber eventos do Asaas:
- `PAYMENT_CONFIRMED` / `PAYMENT_RECEIVED` → localizar assinatura por `gateway_subscription_id` = `payment.subscription`, empurrar `expira_em` +30 dias e garantir `status = 'ativa'`.
- `PAYMENT_OVERDUE` → marcar `status = 'inadimplente'`.
- `SUBSCRIPTION_DELETED` → marcar `status = 'cancelada'`.

Instruir o usuário a cadastrar a URL do webhook no painel Asaas (Configurações → Integrações → Webhooks) com os eventos acima.

### 4. UI (`CarreiraPaywall`)

Nenhuma mudança de layout — só ajustar os textos que já prometem recorrência para refletir o novo fluxo real (mensagem de sucesso do cartão continua correta).

### 5. Trial de 7 dias × cartão

Como decidimos "só pedir cartão no fim dos 7 dias", o botão de cartão só aparece quando o trial expira (já é o caso do paywall atual, que só abre após o gate). Nenhuma mudança extra necessária — a assinatura Asaas simplesmente começa no dia da conversão.

## Detalhes técnicos / arquivos afetados

- `supabase/functions/create-carreira-checkout/index.ts` — trocar chamada `/payments` por `/subscriptions`.
- `supabase/functions/check-carreira-payment/index.ts` — buscar último payment da subscription.
- `supabase/functions/asaas-webhook/index.ts` **(novo)** — recorrência de verdade.
- `supabase/config.toml` — adicionar `[functions.asaas-webhook] verify_jwt = false`.
- `src/components/carreira/CarreiraPaywall.tsx` — pequenos ajustes de copy se necessário.

Nenhuma nova migração SQL é necessária: a coluna `metodo_pagamento` e `gateway_subscription_id` já existem em `carreira_assinaturas`.

## Perguntas antes de implementar

1. Confirma que quer que eu **crie o webhook novo** (`asaas-webhook`) e te passe a URL para cadastrar no painel Asaas? Sem ele, a recorrência funciona no Asaas, mas seu banco não vai saber que o mês foi pago e o acesso expira em 30 dias.
2. Posso alterar o `create-carreira-checkout` para trocar `POST /payments` por `POST /subscriptions` (isso muda o comportamento atual para todo mundo que pagar por cartão daqui pra frente)?