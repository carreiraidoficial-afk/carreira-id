
## 1) "Olhinho" no campo de senha

**Status atual:** o toggle mostrar/ocultar senha **já existe** em `src/pages/Auth.tsx` (linhas 32 e 203-210) — ícone `Eye`/`EyeOff`, cobrindo login e cadastro no mesmo campo.

Se o objetivo é ter o olhinho em **todas** as telas de senha, hoje ele **não está** em:
- `src/pages/carreira/CarreiraCadastroPage.tsx` (cadastro público)
- `src/pages/carreira/ResetPasswordPage.tsx` (redefinição)
- `src/components/auth/ChangePasswordDialog.tsx` (alterar senha)
- `src/components/auth/ForcePasswordChangeDialog.tsx` (troca forçada)

Padrão a replicar: `type={show ? 'text' : 'password'}` + botão absoluto à direita, idêntico ao `Auth.tsx`. Confirme se propago para essas 4 telas.

## 2) Sistema de assinatura — está gerando cobrança de verdade?

**Sim, integrado à API de produção do Asaas** (`https://api.asaas.com/v3`).

```text
CarreiraPlanosPage → CarreiraPaywall (modal)
   ├─ PIX  → generate-carreira-pix   → cria payment PIX + QR + insere assinatura 'pendente'
   └─ Cartão → create-carreira-checkout → cria payment billingType 'UNDEFINED' + invoiceUrl
                                        (checkout hospedado do Asaas)
Polling → check-carreira-payment → ativa assinatura (+30 dias)
Cron   → renew-carreira-pix    → gera nova cobrança PIX 2 dias antes de expirar
```

Edge functions encontradas: `generate-carreira-pix`, `create-carreira-checkout`, `check-carreira-payment`, `renew-carreira-pix`, `asaas-webhook-handler`, `asaas-webhook`, `asaas-configure-webhook`.

**Pontos de atenção:**
- Chave `ASAAS_API_KEY` aponta para produção (não sandbox) → cobranças reais.
- `notificationDisabled: true` desativa e-mail/SMS do Asaas — comunicação depende do app (push próprio).
- Não usa `/subscriptions` do Asaas: é PIX avulso mensal renovado por cron.
- `renew-carreira-pix` sobrescreve `gateway_subscription_id` da mesma linha; se polling do pagamento antigo ainda estiver ativo, pode perder rastreio.
- Fallback de valor no `create-carreira-checkout` está R$ 15,90 (linha 60) enquanto `generate-carreira-pix` usa R$ 17,90 → **inconsistência** se `saas_config.carreira_valor_competidor` não estiver preenchido.

## 3) Pagamento por Cartão de Crédito — configurado e funcional?

**Parcialmente. Funcional via checkout hospedado, mas NÃO via cartão nativo/tokenizado.**

- **Frontend:** `CarreiraPaywall.tsx` (linha 25-39) tem `paymentMethod: 'pix' | 'cartao'`, com `'cartao'` como default. Botão de cartão existe e chama `create-carreira-checkout`.
- **Backend (`create-carreira-checkout`):** cria payment com `billingType: 'UNDEFINED'` e devolve `invoiceUrl` → o usuário é redirecionado para a **página de checkout hospedada do Asaas**, onde escolhe entre cartão, PIX ou boleto (o que estiver habilitado na conta Asaas).
- **Não há fluxo tokenizado nativo:** nenhum lugar do código chama `billingType: 'CREDIT_CARD'` com dados do cartão, nem usa a integração de tokenização/checkout embutido do Asaas. Não há campos de número do cartão, CVV, validade.
- **Recorrência de cartão:** também **não existe**. O fluxo de renovação (`renew-carreira-pix`) só gera PIX — se o usuário assinou por cartão, na renovação vai receber PIX (não há cobrança automática recorrente no cartão).
- **Registro:** `check-carreira-payment` grava `metodo_pagamento` como `'pix'` ou `'cartao_credito'` conforme `paymentData.billingType`, então o admin mostra o método correto após o pagamento ser efetivamente feito no checkout do Asaas.
- **Ativação da conta Asaas:** funcionamento real do cartão depende de:
  - Cadastro da empresa aprovado no Asaas (verificação KYC concluída).
  - Cartão de crédito habilitado como meio de recebimento no painel Asaas.
  - Se algum desses estiver pendente, o checkout hospedado abre mas o botão de cartão fica indisponível.

**Veredito:** funciona para pagamento único via redirect (checkout hospedado). **Não há** cobrança recorrente automática por cartão nem UI de cartão dentro do próprio app.

**Recomendações (a decidir depois):**
- (a) Confirmar no painel Asaas se cartão está aprovado como meio de recebimento (verificação externa).
- (b) Se quiser cartão recorrente de verdade, implementar `/subscriptions` do Asaas com `billingType: 'CREDIT_CARD'` + tokenização — feature nova, não é bug.
- (c) Corrigir fallback R$ 15,90 → R$ 17,90 no `create-carreira-checkout`.

## 4) Regras dos planos — o que está ativo

Fonte: `src/config/carreiraPlanos.ts` + `carreira_planos_config` (dinâmica). Gating por `useCarreiraPlano.temAcesso()` / `temPlano()`.

| Recurso | Base (grátis) | Competidor (R$17,90) | Elite (R$29,90) |
|---|---|---|---|
| Jornada / mês | 1 | 3 | ilimitado |
| Histórico carreira / mês | 1 | 3 | ilimitado |
| Posts / dia | 1 | 3 | 99 |
| Upload vídeo | ❌ | 20s / 20MB | 60s / 40MB |
| Link YouTube | ❌ | ❌ | ✅ |
| Selo Elite | ❌ | ❌ | ✅ |
| Ver visualizações | ❌ | ❌ | ✅ |
| Prioridade em buscas | ❌ | ❌ | ✅ |
| Destaque em listagens | ❌ | ❌ | ✅ |
| Stats avançadas | ❌ | ❌ | ✅ |
| Liga de Conexões | ✅ | ✅ | ✅ |

Locais de gate no código a verificar: `usePostsDiaCount` + `CreatePostForm`, `lib/video-validator.ts`, `VideoEmbedCard`, `JornadaEsportivaSection`, `ExperienciaSection`, `HistoricoProfissionalSection`, `PerfilHeader` (selo/views), `DescobrirAtletasSection` (prioridade), `CarreiraStatsCards`.

Bypass: `atividades_externas_whitelist.ativo=true` concede Elite equivalente ao `user_id`.

## Entregáveis (após aprovação)

1. Aplicar olhinho nas 4 telas de senha extras.
2. Corrigir fallback R$ 15,90 → R$ 17,90 em `create-carreira-checkout` (bug pequeno).
3. Relatório em chat (sem código) com: contagens de `carreira_assinaturas` por status, valores em `saas_config`, últimas 10 assinaturas, e ✅/⚠️ para cada limite realmente gated.
4. Nada de mudança em recorrência de cartão / integração de tokenização sem seu ok explícito.

## Perguntas

- Propago o olhinho para as 4 telas extras?
- Aplico a correção do fallback R$ 15,90?
- Autoriza rodar consultas de leitura no banco para gerar o relatório?
