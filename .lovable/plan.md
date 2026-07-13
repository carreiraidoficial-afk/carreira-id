
## Problema

Ao assinar por cartão, a Asaas cria a cobrança mas o primeiro pagamento fica em `PENDING` por alguns segundos/minutos (análise de risco / autorização assíncrona). Hoje:

- A edge function `create-carreira-card-subscription` retorna `success: true` mesmo com status `PENDING`.
- O frontend, ao receber `success`, dá `toast.success("Assinatura ativada!")` e chama `onSubscribed?.()`, que fecha o dialog.
- Resultado: usuário sai da tela sem saber se o pagamento foi aprovado, recusado ou ainda está sendo processado. No Asaas aparece a cobrança pendente e nada mais acontece do lado do app até o webhook chegar (e o dialog já fechou).

## Solução

Tratar cartão como um fluxo de 3 estados: **aprovado imediatamente**, **em análise (pending)** ou **recusado**. Só fechar o modal em aprovado. Em pending, mostrar tela "Processando pagamento" e pollar `check-carreira-payment` (que já sabe resolver `sub_...` e ativa a assinatura quando `CONFIRMED/RECEIVED`). O webhook `asaas-webhook` continua ativando em segundo plano — os dois caminhos convergem.

### 1. `supabase/functions/create-carreira-card-subscription/index.ts`

- Depois de criar a subscription e buscar o primeiro payment, classificar:
  - `CONFIRMED` / `RECEIVED` → retornar `{ success: true, status: 'approved', subscriptionId, paymentId, ... }`.
  - `REFUSED` ou `refusalReason` presente → manter o comportamento atual (deletar sub no Asaas + retornar 400 com `friendlyRefusal`).
  - Qualquer outro (`PENDING`, `AWAITING_RISK_ANALYSIS`, sem payment ainda) → retornar `{ success: true, status: 'processing', subscriptionId, paymentId, valor, card }` e salvar a linha em `carreira_assinaturas` com `status: 'pendente'` (já faz).
- Não mudar assinaturas do banco a partir desse retorno "processing" — o webhook e o polling cuidam disso.

### 2. `src/components/carreira/CarreiraPaywall.tsx`

- Em `submitCardSubscription`, após sucesso da chamada:
  - Se `data.data.status === 'approved'` → comportamento atual (toast + invalidar queries + `setStep('success')` + `onSubscribed`).
  - Se `data.data.status === 'processing'` → **não** chamar `onSubscribed`, **não** mostrar toast de sucesso. Guardar `checkoutData = { paymentId: data.data.paymentId || data.data.subscriptionId, subscriptionId: '' }` e `setStep('checking')`. O `useEffect` de polling existente para `checking` já chama `check-carreira-payment` a cada 5s; ele resolve `sub_...` corretamente, então funciona para cartão também.
- Adaptar o texto da tela `checking` para cobrir os dois casos (PIX/checkout aberto em outra aba vs. cartão em processamento):
  - Título: "Processando pagamento" quando `paymentMethod === 'cartao'`.
  - Descrição: "Estamos confirmando a autorização do seu cartão com o banco. Isso pode levar até 1 minuto." (mantém o texto atual quando for checkout externo).
  - Esconder o botão "Já paguei, verificar agora" no fluxo de cartão (não faz sentido) e manter o "Cancelar" que reseta para `info`.
- Timeout de 10 min já existente vira "A autorização está demorando mais que o normal. Você receberá uma confirmação por e-mail assim que o banco responder." + botão "Fechar".
- Se o polling detectar recusa futura (via webhook marcando `inadimplente`/`cancelada`), adicionar um caso: `check-carreira-payment` retorna `isPaid: false` indefinidamente. Não conseguimos distinguir recusa de pending só pelo polling atual — aceitável, pois o webhook `PAYMENT_REFUSED` já registra `observacoes` e o usuário será notificado por e-mail Asaas. Fora de escopo mudar isso agora.

### 3. Deploy manual

Como o Supabase é externo (sem CLI), o usuário precisa **substituir o código da edge function `create-carreira-card-subscription`** pela nova versão via Dashboard (mesmo processo que já usou). Nenhum SQL novo.

## O que o usuário verá depois

- **Cartão aprovado na hora:** tela verde "Pagamento confirmado" (igual hoje).
- **Cartão em análise:** tela "Processando pagamento" com spinner, atualiza sozinha em segundos quando o Asaas responder; se aprovar → tela verde; se recusar → e-mail do Asaas + assinatura fica `inadimplente` no admin.
- **Cartão recusado imediato:** caixa vermelha com motivo (já funciona hoje).
