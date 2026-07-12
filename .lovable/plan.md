# Fase 3 — DROP das tabelas Atleta ID + Jornada Esportiva independente

**Confirmação:** trabalhando exclusivamente no Supabase Carreira ID (`fppsotlycinwqsjpoybg`). Atleta ID (`vxzktyklzkfqitptzctk`) intocado.

**Decisão registrada:** Jornada Esportiva permanece no Carreira, editável pelo próprio atleta, **sem depender da ponte** com o Atleta ID.

---

## Bloco A — DROP: tabelas Atleta puras (sem uso em `src/` nem em edge functions Carreira)

Uma migration única com `DROP TABLE ... CASCADE`:

```
access_logs, pwa_installs, push_notifications_log,
mensalidades, presencas, aulas, aulas_extras, turmas, professores,
responsaveis, crianca_responsavel, crianca_turma,
escolinha_financeiro, escolinha_cadastro_bancario,
comunicados, comunicados_escola, comunicado_leituras,
escola_push_config, pedidos, historico_cobrancas, cobrancas_entrada,
loja_estoque, loja_pedidos, loja_relatorio,
enrollments, enrollment_payments,
amistosos, amistoso_convocacoes,
campeonatos, campeonato_jogos, campeonato_convocacoes,
eventos, eventos_esportivos, evento_gols, evento_premiacoes,
evento_presencas, evento_times, evento_conquistas,
conquistas, conquistas_coletivas,
indicacoes, motivos_cancelamento, motivos_aula_extra
```

Antes de rodar, listo a existência real de cada tabela via `information_schema` (algumas podem já não existir).

## Bloco B — Ponte Atleta → Carreira: remover só o transporte, manter os dados

**Remover:**
- Edge function `receive-atleta-data` (arquivo + entrada em `supabase/config.toml`)
- Secret `CARREIRA_SYNC_SECRET` (marcar para deleção manual no painel)
- Colunas de rastreamento da ponte em `perfil_atleta`: `atleta_id_vinculado`, `atleta_id_sync_at`
- Componente `MigrarPerfilBanner` se ele existir só pra vincular Atleta ID (confirmo antes)

**Manter as tabelas de dados** (deixam de ser "sync", viram tabelas normais editáveis pelo próprio atleta):
- `atividades_externas_sync`, `evento_gols_sync`, `evento_premiacoes_sync`
- `amistoso_convocacoes_sync`, `campeonato_convocacoes_sync`, `conquistas_coletivas_sync`
- `atividades_externas_whitelist`

Não vou renomear as tabelas agora (evita quebrar 6 hooks). Trato como dívida técnica pra depois; funcionam iguais.

## Bloco C — Jornada Esportiva editável (nova UI de escrita)

Hoje `useCarreiraJornadaData` só **lê** os `_sync`. Preciso adicionar mutations e ligar aos dialogs que já existem:

- Adicionar em `useCarreiraJornadaData`: `createCampeonatoConvocacao`, `updateCampeonatoConvocacao`, `deleteCampeonatoConvocacao`, e o equivalente para `amistoso_convocacoes_sync`, `evento_gols_sync`, `evento_premiacoes_sync`, `conquistas_coletivas_sync`.
- Cada insert manual gera um `atleta_id_convocacao_id` local (UUID v4) só pra respeitar o unique — flag `origem: 'manual'` ajuda a distinguir de dado sincronizado futuro.
- Ligar `JornadaCampeonatoFormDialog` e `JornadaJogoFormDialog` (que já existem) à nova API.
- Ajustar RLS: policies `INSERT/UPDATE/DELETE WHERE user_id = auth.uid()` nas 6 tabelas (hoje só têm SELECT porque só a service_role escrevia).
- `atividades_externas_sync` já tem CRUD pelo `useAtividadesExternasData` — só verifico policies e adiciono `INSERT/UPDATE/DELETE` do próprio dono, se faltar.

## Bloco D — Cleanup adicional

- `useCarreiraDiagnostico`: remover checagens que consultavam tabelas do Bloco A.
- `CarreiraAdminDiagnosticoPage`: remover o health-check em `criancas` que faz `insert/delete` de teste (não faz mais sentido).
- Enums órfãos (`app_role` valores `school|teacher|guardian`, motivos, status Asaas Atleta) e functions Postgres (`get_guardian_escolinha_id`, `has_school_role`, etc.): mapeio e removo em migration separada, se seguros.

---

## Ordem de execução

1. **Ler** `information_schema` p/ confirmar quais tabelas do Bloco A ainda existem.
2. **Migration 1**: `DROP TABLE CASCADE` (Bloco A).
3. **Migration 2**: adicionar policies `INSERT/UPDATE/DELETE` nas 6 tabelas do Bloco C; remover colunas `atleta_id_vinculado`/`atleta_id_sync_at` de `perfil_atleta`.
4. **Deletar** `supabase/functions/receive-atleta-data/` e sua entrada em `supabase/config.toml`.
5. **Código Bloco C**: mutations no `useCarreiraJornadaData` + wiring dos dialogs existentes.
6. **Código Bloco D**: cleanup de diagnóstico.
7. **Migration 3** (opcional, após validar): DROP dos enums/functions órfãs.
8. **Build check** — se sobrar `.from('tabela_dropada')`, ajusto.

## Fora do escopo desta fase
- Renomear `*_sync` para nomes finais (dívida técnica).
- Tocar em qualquer coisa no Supabase do Atleta ID.
- Storage buckets órfãos e limpeza de secrets do Asaas antigo (fica pra Fase 4).
