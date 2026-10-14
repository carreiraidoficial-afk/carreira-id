# Análise de pagamentos, assinaturas e segurança — 14/10/2026

Escopo: Asaas (cartão e PIX), assinaturas individual e Família, webhook, funções de pagamento, regras do banco, e viabilidade do plano anual.
Só leitura: nada foi alterado. Base real hoje: **1 assinante pagante (cartão, Asaas produção)**, 3 isentos, 8 em teste, 1 inadimplente de sandbox. É a hora mais barata de corrigir.

## Falhas, em ordem de gravidade

### Crítico
1. **O webhook do Asaas aceita qualquer chamada.** `asaas-webhook` compara o token, mas em caso de diferença só registra "processing anyway" e segue. Ele também não confirma o pagamento no Asaas nem confere valor. Qualquer pessoa pode enviar um `PAYMENT_CONFIRMED` falso e ativar o próprio Premium de graça. (O token `ASAAS_WEBHOOK_TOKEN` existe no Supabase.)
2. **`check-carreira-payment` (sem login) ativa qualquer assinatura.** Recebe `subscription_id` no corpo e ativa essa linha se o `payment_id` informado estiver pago, sem checar que o pagamento pertence àquela assinatura nem àquele usuário. Um único pagamento de R$ 12 pode ativar várias assinaturas (outros atletas) por 30 dias cada.
3. **`create-carreira-checkout` (sem login) confia no `user_id` do corpo.** Qualquer um cria clientes e assinaturas no Asaas em nome de outro usuário e grava linhas pendentes que servem de alvo para os itens 1 e 2.
4. **`create-carreira-card-subscription` e `generate-carreira-pix` (com login) não comparam `user_id` com o usuário logado.** Dá para cancelar o teste/pendente de outro usuário e mandar apagar a assinatura dele no Asaas, conhecendo `user_id` e `crianca_id`.
5. **`renew-carreira-pix` (sem login) gera cobranças a cada chamada e nunca entrega o PIX.** A tarefa diária pega assinaturas PIX que vencem em até 2 dias, então gera uma cobrança nova por dia (2 a 3 duplicadas) e troca o `gateway_subscription_id` a cada vez. O código do PIX só volta na resposta da função: ninguém avisa o cliente. Hoje não há assinante PIX, então é latente. Além disso, a resposta devolve `user_id` e código PIX de outros usuários.

### Alto
6. Eventos não tratados: reembolso, chargeback, cartão recusado na renovação e assinatura excluída. O acesso continua até o fim do prazo.
7. Dados do cartão (número e CVV) passam pela função `create-carreira-card-subscription`. Não são gravados nem logados, mas o servidor toca neles. O checkout hospedado do Asaas (`invoiceUrl`, já usado em `create-carreira-checkout`) evita isso.
8. Duração fixa de 30 dias em `asaas-webhook`, `check-carreira-payment` e nas funções de checkout. Quebra qualquer plano anual.
9. Limites do Premium (jornada, posts, vídeo, etc.) são aplicados só na interface. Não há trava no banco.

### Médio
10. Preço espalhado: `PRECO_PREMIUM = 12` no app, `saas_config.carreira_valor_premium` nos checkouts, `12.0` fixo em `renew-carreira-pix`, mais chaves antigas em `saas_config` (mensal 19,90, competidor 17,90, elite 29,90). Rótulos legados "elite", "competidor" e "mensal" viram "premium" em `normalizePlano`.
11. `asaas-webhook-sandbox` e `carreira-asaas-configure-webhook` existem publicados fora do repositório; há uma linha `asaas_sandbox` no banco de produção.
12. CPF do responsável fica em `perfil_atleta.cpf_cnpj` (dado pessoal): rever quem consegue ler.
13. Ativação por webhook redefine a validade para "hoje + 30 dias" em vez de somar ao que restava.

### O que já está bom
- Trigger `assinaturas_protege` impede o usuário de se promover pelo app (corrigido hoje).
- `cancel-carreira-subscription` valida dono e cancela de verdade no Asaas antes de marcar cancelada.
- Cartão salva só token e últimos 4 dígitos; nenhuma chave do Asaas no código.
- Regras do banco das assinaturas: usuário só enxerga as próprias; admin gerencia.

## Correções propostas (ordem sugerida)
1. Webhook: confirmar cada evento consultando o Asaas (`GET /payments/{id}`: status, valor, referência) e passar a rejeitar token errado depois de confirmar qual token o painel do Asaas envia. Tratar reembolso, chargeback, recusa e exclusão.
2. `check-carreira-payment`: exigir login, validar que o pagamento pertence à assinatura do usuário, ou remover (o webhook já ativa).
3. Todas as funções de pagamento: usar o usuário do token e ignorar `user_id` do corpo.
4. `renew-carreira-pix`: exigir segredo interno, 1 cobrança por vencimento, entregar o PIX por push e e-mail; parar de devolver dados de usuários.
5. Cartão por checkout hospedado do Asaas (sem o número passar pelo servidor).
6. Duração e preço lidos de uma fonte única (campos `ciclo` e `duracao_dias` na assinatura; preços em `saas_config`).
7. Rever funções fora do repositório e limpar o sandbox da produção.

## Plano anual do Premium

Preço de referência: 12 × R$ 12 = R$ 144 por ano. Sugestões: **R$ 120** (2 meses grátis, cerca de R$ 10/mês) ou R$ 99,90 (mais agressivo).

Duas formas de cobrar:
- **A. Pagamento único anual, sem renovar sozinho (recomendado).** PIX ou cartão em até 12x (`installmentCount` do Asaas). O pai não leva susto em 12 meses, e lembramos antes de vencer. Menos cancelamento e menos disputa de cobrança.
- **B. Assinatura anual recorrente (`cycle: YEARLY`).** Renova sozinha no cartão. Dá mais receita recorrente, mas aumenta o risco de reclamação e chargeback em quem esqueceu.

Mudanças necessárias:
- Banco: `ciclo` (mensal/anual) e `duracao_dias` em `carreira_assinaturas` e na Família; preço anual em `saas_config`; a trava `assinaturas_protege` continua válida.
- Funções de checkout e webhook usam a duração da linha, não 30 dias fixos.
- Tela de planos com seletor mensal/anual e a economia destacada; Minhas Assinaturas mostra a próxima renovação.
- Troca de mensal para anual no meio do período: definir se paga o anual agora e cancela a recorrência mensal (sem reembolso proporcional é o mais simples).
- Cupons e teste de 7 dias: o teste continua igual; cupom vale só para o primeiro período, a definir.
- Plano Família anual: mesma lógica, decidir se entra junto.

## Google Play
App publicado na loja com cobrança de assinatura digital normalmente exige o sistema de cobrança do Google (Google Play Billing). Isso mexe em preço (taxa da loja) e no desenho dos planos. Precisa ser decidido antes do plano anual, porque pode obrigar a oferecer o anual pelo Google Play também.

## Pendências de verificação manual (painel do Asaas)
- Qual token de autenticação está configurado no webhook.
- Quais eventos o webhook de produção assina.
- Taxas de PIX, cartão e parcelamento para calcular o preço anual.
- Se a chave de produção está restrita por IP.
