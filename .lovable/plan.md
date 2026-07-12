# Limpar Atleta ID deste projeto (Supabase + código)

Você confirmou: **Atleta ID roda 100% no Supabase próprio (`vxzktyklzkfqitptzctk`)** e este projeto Lovable/Supabase (`fppsotlycinwqsjpoybg`) vai ficar **exclusivo do Carreira ID**. A ponte `receive-atleta-data` (webhook que o Atleta ID chama pra popular perfis do Carreira) fica.

Faço em 4 fases, cada uma reversível na History, começando pelo mais seguro (código) e terminando no destrutivo (drop de tabelas).

---

## Fase 1 — Rotas, layouts e páginas Atleta ID (sem risco de dados)

**Remover do `src/`:**
- `src/pages/dashboard/` inteiro (Admin/Guardian/School/Teacher + subpastas `admin/`, `guardian/`, `school/`)
- `src/pages/Dashboard.tsx`, `src/pages/InstallApp.tsx`, `src/pages/IndicacaoPage.tsx`, `src/pages/ShortIndicacaoRedirect.tsx`
- `src/pages/atleta/`, `src/pages/atletaid/`
- `src/components/layout/`: `DashboardLayout`, `GuardianDashboardLayout`, `GuardianSidebar`, `MobileGuardianLayout`, `MobileHeader`, `MobileBottomNav`, `SchoolDashboardLayout`, `SchoolSidebar`, `AtletaIdLayout`
- `src/components/guardian/`, `src/components/school/`, `src/components/admin/`, `src/components/atleta-id/`, `src/components/jornada/`
- Hooks Atleta-only: `useGuardianData`, `useSchoolData`, `useTeacherData`, `useAdminData`, `useEnrollmentData`, `useAulasData`, `useAulaHistoricoData`, `useAlunoHistoricoData`, `useAmistosoConvocacoesData`, `useCampeonatosData`, `useCampeonatoConvocacoesData`, `useComunicadosData`, `useComunicadosEscolaData`, `useEscolaPostsData`, `useEscolaPublicaData`, `useAdminAulasData`, `useAccessLogData`, `useAtividadesExternasData`, `useAtletaIdData`, `useConquistasData`, `useConsolidatedViewEnabled`, `useEventosData` (+ `useEvento*`), `useExistingGuardianLookup`, `useGuardianConvocacoesData`, `useGuardianEventosData`, `useGuardianNotifications`, `useIndicacoesData`, `useJornada`, `useLojaData`, `useMensal*`, `useParentAccessAnalytics`, `usePeneirasData`, `usePwaInstall*`
- `src/contexts/StudentRegistrationContext.tsx`
- `src/data/mockData.ts`, `src/types/jornada-esportiva.ts`
- `src/lib/processar-convite-ref.ts`

**Atualizar:**
- `src/App.tsx`: remover todas rotas `/dashboard/*`, `/install`, `/indicacao/*`, `/atleta/*`, `/atletaid/*`. `RootRoute` passa a redirecionar direto pra Carreira (landing / `/carreira/minha`).
- `src/pages/RootRoute.tsx`, `src/pages/Auth.tsx`: retirar branches por role escolinha; todos usuários viram fluxo Carreira.
- `src/contexts/AuthContext.tsx`: remover `escolinhaId`, roles `school`/`teacher`/`guardian` (fica só `admin` + user carreira). `src/types/index.ts` idem.
- `src/components/layout/CarreiraLayout.tsx`: remover botão "Voltar ao App" e item "App da Escolinha".
- `public/sitemap.xml`: remover bloco `atletaid.com.br`.
- `index.html`: se houver título/meta genéricos, ajustar para Carreira ID.

## Fase 2 — Edge functions Atleta ID

**Deletar** (`supabase/functions/`):
`asaas-check-account-status`, `asaas-configure-webhook`, `asaas-create-subaccount`, `asaas-disable-notifications`, `asaas-send-documents`, `asaas-submit-registration`, `asaas-webhook-handler`, `cancel-amistoso-payment`, `cancel-asaas-payment-only`, `cancel-enrollment-payment`, `cancel-mensalidade-payment`, `check-amistoso-payment`, `check-campeonato-payment`, `check-enrollment-payment`, `check-mensalidade-payment`, `check-pedido-payment`, `create-escolinha-admin`, `create-escolinha-socio`, `create-teacher-with-login`, `generate-amistoso-pix`, `generate-campeonato-pix`, `generate-enrollment-pix`, `generate-mensalidade-pix`, `generate-pedido-pix`, `generate-student-billing-asaas`, `notify-school-indicacao`, `register-student-initial`, `register-student-with-guardian`, `reset-escolinha-password`, `reset-escolinha-socio-password`, `reset-responsavel-password`, `reset-teacher-password`, `seed-test-data`, `send-guardian-credentials`, `send-peneira-push`, `send-teacher-welcome-email`, `whatsapp-bot`.

**Manter:** `receive-atleta-data` (ponte com Atleta ID), todas `carreira-*` / `create-carreira-checkout` / `check-carreira-payment` / `generate-carreira-pix` / `renew-carreira-pix` / `send-carreira-push`, `asaas-webhook` (Carreira), e utilitários compartilhados: `moderate-content`, `share-post`, `change-password`, `delete-account`, `fetch-link-preview`, `send-welcome-email`, `send-password-reset-email`, `update-user-email`, `send-push-notification`, `process-push-reminders`, `run-diagnostico`, `n8n-query`.

Atualizar `supabase/config.toml` removendo blocos das functions deletadas.

## Fase 3 — Levantamento das tabelas antes de dropar

Antes de gerar a migration destrutiva, listo pra você aprovar. Candidatas a drop (Atleta ID puro):
`escolinhas`, `professores`, `alunos`, `turmas`, `aulas`, `aulas_extras`, `presencas`, `mensalidades`, `enrollments`, `enrollment_payments`, `amistosos`, `amistoso_convocacoes`, `campeonatos`, `campeonato_*`, `eventos`, `evento_*`, `comunicados`, `comunicados_escola`, `comunicado_leituras`, `posts_escola`, `pedidos`, `loja_*`, `peneiras`, `peneira_*`, `indicacoes`, `atividades_externas`, `access_logs`, `pwa_installs`, `conquistas`, `perfil_atleta`, `posts_atleta`, `jornada_*`, `escolinha_cadastro_bancario`.

**Manter:** `carreira_*` (todas), `saas_config`, `user_roles`, tabelas usadas por `receive-atleta-data` (identifico ao rodar Fase 3).

Nesta fase eu ainda **não apago nada** — só te apresento a lista final `KEEP / DROP` lendo `information_schema` + grep de `.from('...')` no código restante, e você aprova.

## Fase 4 — Migration destrutiva + dashboard Supabase

- Uma migration `DROP TABLE ... CASCADE` pra cada tabela aprovada na Fase 3, junto com functions/triggers/enums só delas.
- Remover secrets órfãos (`ASAAS_API_KEY` root do Atleta, tokens de escolinha etc.) — te aviso quais antes.
- No painel Supabase (manual, te passo o passo-a-passo): remover domínio `atletaid.com.br` deste projeto Lovable, desconectar webhooks Asaas da conta-mãe Atleta.

---

## Detalhes técnicos

- **Ordem obrigatória:** Fases 1 → 2 → 3 → 4. Cada fase é 1 commit revertível pela History.
- **`receive-atleta-data` preservado:** identifico as colunas/tabelas que ele grava (provavelmente `carreira_perfis` + tabela ponte) antes da Fase 3, pra não dropar por engano.
- **Auth:** hoje `AuthContext` deriva role de `user_roles` + fallback guardian. Depois da limpeza, quem não for `admin` vira usuário Carreira comum (sem role especial).
- **Rotas /auth e reset password:** ficam, servem Carreira também.
- **Sem alteração no fluxo Asaas Carreira** desta limpeza — os ajustes de subconta/valor R$ 12 ficam para um plano separado depois.

## Fora do escopo
- Ajuste de valor R$ 17,90 → R$ 12,00 (plano separado).
- Refatorar webhook Carreira pra token próprio (plano separado).
- Migrar/mexer qualquer coisa no Supabase do Atleta ID (`vxzktyklzkfqitptzctk`).
