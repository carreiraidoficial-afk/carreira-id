
## Novo modelo de cobrança

- **Base (grátis)** — mantém o que já existe hoje.
- **Premium — R$ 12,00/mês** — substitui Competidor e Elite. Inclui todos os recursos que hoje estão nos dois planos pagos (jornada/carreira ilimitados, vídeos até 1 min, YouTube, selo, prioridade em buscas, destaque, stats avançadas, ver quem visualizou o perfil, mais publicações por dia).
- **Trial de 7 dias, sem cartão** — todo cadastro Carreira novo entra automaticamente com 7 dias de Premium liberados, sem pedir nenhuma forma de pagamento.
- **Fim do trial** — no 8º dia o usuário precisa escolher pagar (PIX ou cartão de crédito, R$ 12,00) para continuar como Premium. Se não pagar, cai para o plano Base automaticamente e perde os recursos Premium (dados ficam preservados).
- **Assinantes atuais (Competidor/Elite)** — migração automática para o Premium na próxima renovação, no valor novo de R$ 12,00. Comunicado in-app avisando a mudança.

## Como o trial vai funcionar

- No cadastro: nada de tela de pagamento. Grava `trial_termina_em = created_at + 7 dias` e o app trata o usuário como Premium enquanto essa data não passa.
- Durante o trial: badge "Premium grátis — X dias restantes" no perfil e no card de assinatura. A partir do 5º dia, banner suave convidando a assinar antecipado.
- No 6º e 7º dia: notificação push + comunicado in-app avisando que o trial está acabando, com CTA "Assinar por R$ 12,00".
- No dia 8: se não pagou, `useCarreiraPlano` passa a retornar `base`, paywalls voltam a bloquear recursos Premium. Sem cobrança-surpresa, sem cartão salvo, sem risco de chargeback.
- Se pagar (PIX ou cartão) antes ou depois do trial: assinatura ativa por 30 dias a partir do pagamento; renovações seguem o fluxo Asaas normal.

## Mudanças de código

**`src/config/carreiraPlanos.ts`**
- Tipo passa a ser `'base' | 'premium'`. Remover `competidor` e `elite`.
- `premium`: preço 12,00, limites = os atuais do `elite`. Ajustar `planoNivel`, `planoMinimoParaFeature`, `temAcessoAoPlano`.

**Banco**
- Migração de schema: adicionar `trial_termina_em TIMESTAMPTZ` em `carreira_assinaturas` (se ainda não existir) e um índice por `user_id, trial_termina_em`.
- Migração de dados (via insert tool): `UPDATE carreira_planos_config` para deixar só `base` e `premium` com os novos valores; `UPDATE carreira_assinaturas SET plano='premium', valor=12.00 WHERE plano IN ('competidor','elite')`.
- Backfill: para usuários Carreira já cadastrados que nunca assinaram e ainda estão dentro dos 7 dias após o cadastro, setar `trial_termina_em = created_at + 7 dias` (opcional — decidir se quer estender o trial para novos entrantes apenas ou também para os já cadastrados recentemente).
- Revisar policies/views que referenciam `competidor`/`elite`.

**Edge functions**
- `create-carreira-checkout`: passa a cobrar R$ 12,00 fixo, sem trial no Asaas (o trial é do lado do nosso app, não do Asaas). Método cartão ou PIX à escolha do usuário.
- `generate-carreira-pix` / `renew-carreira-pix`: valor fixo R$ 12,00, remover ramos por plano.
- Cron diário (função agendada) para: (a) enviar notificação nos dias -2 e -1 do fim do trial; (b) marcar assinatura como expirada no dia 8 se não houver pagamento (`status='expirada'`, `plano` efetivo volta a Base pela lógica do hook).
- Novo cadastro dispara insert em `carreira_assinaturas` com `plano='premium'`, `status='trial'`, `trial_termina_em = now() + interval '7 days'`, `valor=12.00`.

**Frontend**
- `CarreiraCadastroPage`: mensagem "Você ganhou 7 dias grátis do Premium — sem cartão." Nenhum passo de pagamento.
- `useCarreiraPlano` / `useCarreiraFreemium`: se `status='trial'` e `trial_termina_em > now()`, tratar como Premium ativo.
- `AssinaturaCard`: exibir estado "Trial — X dias restantes" com botão "Assinar por R$ 12/mês". Após vencer, exibir "Trial encerrado — assine por R$ 12/mês para reativar".
- `CarreiraPlanosPage`, `CarreiraLandingV2`, `CarreiraPaywall`: mostrar apenas Base × Premium, com selo "7 dias grátis, sem cartão".
- `FeatureGate`: mensagem consistente ("Recurso Premium — assine por R$ 12/mês" / durante trial: sem bloqueio).
- Admin (`CarreiraAdminPlanosPage`, `CarreiraAdminAssinaturasPage`, `CarreiraAdminDashboard`): remover Competidor/Elite; adicionar coluna "Em trial (dias restantes)" e filtro por status (trial / ativa / expirada / atrasada).

**Comunicação aos assinantes atuais**
- Comunicado in-app: "Simplificamos os planos. Seu plano vira Premium por R$ 12,00/mês na próxima renovação — mesmos recursos (ou mais, se você era Competidor)."

## Fora do escopo

- Cobrança de R$ 1,00 para validar cartão / trial com cartão (você optou por trial sem cartão).
- Retenção/dunning avançado.
- Mexer no fluxo Atleta ID × Carreira ID no Asaas (assunto anterior, independente).

## Observação sobre o modelo escolhido

Trial sem cartão maximiza conversão para experimentar, mas historicamente converte menos em pagantes (10–25%) do que trial com cartão (40–60%). Como o público são atletas jovens e famílias, tirar o atrito do cartão faz sentido no primeiro momento — dá pra medir a conversão real nos primeiros 60 dias e, se estiver baixa, testar depois o modelo "R$ 1,00 no 1º mês".
