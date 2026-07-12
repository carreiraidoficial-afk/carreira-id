# Plano: Cartão recorrente real + limpeza Asaas

## 1. Ajustar valor oficial
- Garantir `saas_config.carreira_valor_premium = 12.00` (via insert tool).

## 2. Nova tabela / colunas
Migration:
- Adicionar em `carreira_assinaturas`:
  - `gateway_card_token TEXT` (token retornado pela Asaas)
  - `card_last4 TEXT`
  - `card_brand TEXT`

## 3. Nova edge function `create-carreira-card-subscription`
Recebe do frontend:
```
user_id, crianca_id, cpf, nome, email,
card: { holderName, number, expiryMonth, expiryYear, ccv },
holderInfo: { name, email, cpfCnpj, postalCode, addressNumber, phone },
remoteIp
```
Fluxo:
1. Valida sessão + assinatura ativa (mesma lógica atual).
2. Busca/cria customer na Asaas (já existe).
3. `POST /subscriptions` com:
   - `billingType: 'CREDIT_CARD'`
   - `cycle: 'MONTHLY'`, `value: 12.00`
   - `nextDueDate: hoje` (não +1)
   - `creditCard`, `creditCardHolderInfo`, `remoteIp`
   - `notificationDisabled: true`
4. Se Asaas retornar erro de autorização, devolve `refusalReason` legível.
5. Se sucesso: salva assinatura como `ativa`, com `gateway_card_token`, `card_last4`, `card_brand`, `expira_em = hoje + 30d`.

## 4. Nova tela `CarreiraCartaoPage` (`/carreira/planos/cartao`)
- Formulário: número, validade (MM/AA), CVV, nome do titular, CPF do titular, CEP, número do endereço, telefone.
- Máscaras e validações (CPF, cartão via Luhn).
- Captura `remoteIp` no backend (`req.headers.get('x-forwarded-for')`).
- Botão "Assinar R$ 12,00/mês".
- Ao sucesso: toast + redirect para `/carreira/perfil`.
- Ao erro: exibe mensagem específica (recusa do banco, CPF divergente, etc.).

## 5. `CarreiraPlanosPage` — trocar destino do botão "Cartão"
Hoje chama `create-carreira-checkout` e abre `invoiceUrl` da Asaas. Passa a navegar para `/carreira/planos/cartao` (form interno).

`create-carreira-checkout` fica para compatibilidade (não removo agora).

## 6. Logar recusa no webhook
`asaas-webhook`: ao receber `PAYMENT_REFUSED` ou payment status `REFUSED`, gravar `refusalReason` em `carreira_assinaturas.observacoes` (nova coluna TEXT nullable) e marcar `status='pendente'`.

## 7. Limpeza William Nogueira + duplicatas
Edge function utilitária `cleanup-asaas-duplicates` (one-shot, chamada por mim via curl):
- Para cada `customer` Asaas com múltiplas subscriptions ativas do mesmo `externalReference`, mantém a mais recente e cancela as outras via `DELETE /subscriptions/{id}`.
- Marca as linhas correspondentes em `carreira_assinaturas` como `cancelada`.

## 8. Reset do teste `marcos.silva.teste2`
- Cancelar todas as assinaturas Asaas dele (via mesma função de cleanup ou manualmente).
- `UPDATE carreira_assinaturas SET status='cancelada' WHERE user_id=<marcos>`.
- Você refaz o fluxo pelo app usando a nova tela de cartão.

## Ordem de execução
1. Migration (colunas novas + observacoes)
2. Insert `carreira_valor_premium = 12.00`
3. Edge function `create-carreira-card-subscription` + `cleanup-asaas-duplicates`
4. Página `CarreiraCartaoPage` + rota + ajuste em `CarreiraPlanosPage`
5. Ajuste no `asaas-webhook`
6. Deploy → rodo cleanup do William Nogueira e reset do marcos
7. Você testa o cartão real

## Aviso PCI
O cartão vai direto para a Asaas via nossa edge function server-to-server (a Asaas é PCI-compliant e aceita esse formato). Não persistimos número/CVV em lugar nenhum — só o `creditCardToken` que a Asaas devolve.
