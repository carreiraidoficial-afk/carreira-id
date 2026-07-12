## Objetivo
Fazer o botão "Assinar por R$ 12,00/mês" dar sequência de forma clara e mostrar qualquer erro (validação local ou recusa do Asaas) dentro do próprio formulário.

## O que muda no `CarreiraPaywall.tsx` (etapa `card_form`)

1. **Novo estado local** `cardError: string | null` (limpa sempre que o usuário edita qualquer campo do cartão).
2. **Trocar todos os `toast.error(...)` do `submitCardSubscription` por `setCardError(...)`** (validações + erro da Edge Function + erro genérico do catch). Remover os toasts desse fluxo — vira exclusivamente inline conforme sua escolha.
3. **Caixa vermelha inline** renderizada logo acima do botão "Assinar…":
   - Fundo `bg-destructive/10`, borda `border-destructive/40`, texto `text-destructive`, ícone de alerta.
   - Só aparece quando `cardError` tem conteúdo.
   - Ao aparecer, faz `scrollIntoView({ block: 'center' })` para garantir visibilidade acima do teclado no celular.
4. **Log de diagnóstico**: `console.log('[card-submit]', { step, hasUser, hasCrianca, validationOk })` no início de `submitCardSubscription` para conseguirmos ver no console se o botão está executando quando você tocar.
5. **Ajuste de layout do botão**: adicionar `pb-4` no container e remover barreira do teclado — o botão hoje fica no final do `overflow-y-auto`; garantir que ele role até a visualização quando o formulário tem foco.

## Sobre o motivo de "não dar sequência"
Provável causa: um `toast.error` disparado por validação (ex.: CVV, telefone) que fica escondido atrás do teclado do Android — o botão executa, mas você não vê feedback. Ao trocar para caixa inline visível dentro do próprio formulário, o problema some por definição.

Se, mesmo assim, o clique não disparar nada, o log `[card-submit]` no console vai confirmar (ou negar) que o `onClick` foi acionado, e o próximo passo será verificar `disabled={cardSubmitting}` travado por render anterior.

## CEP e Número
Mantidos exatamente como estão — a API `/subscriptions` da Asaas com `billingType: CREDIT_CARD` exige `creditCardHolderInfo.postalCode` e `addressNumber` para autorização/antifraude. Nenhuma alteração nesses campos.

## Fora de escopo
- Edge Function `create-carreira-card-subscription` não muda.
- Fluxo PIX, webhook, cleanup não mudam.
- Nenhuma migration.

## Arquivo tocado
- `src/components/carreira/CarreiraPaywall.tsx`