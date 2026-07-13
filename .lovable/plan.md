
# Frontend: Estatísticas de Goleiro

Migration confirmada no Supabase (10 colunas novas em `carreira_jogos`). Agora integramos no app.

## Regra de exibição
Campos de goleiro aparecem **por jogo**, quando `posicao_jogo === 'goleiro'` no formulário. Assim o mesmo atleta pode registrar jogos como goleiro e como linha sem poluir a UI.

## Alterações

### 1) `src/types/jornada-esportiva.ts`
Adicionar em `Jogo` e `CreateJogoInput` os 10 campos opcionais:
`minutos_jogados`, `gols_sofridos`, `defesas_importantes`, `penaltis_defendidos`, `teve_disputa_penaltis`, `placar_penaltis_time`, `placar_penaltis_adversario`, `penaltis_defendidos_disputa`, `penaltis_gol_lado_correto`, `penaltis_gol_lado_errado`.

### 2) `src/components/carreira/JornadaJogoFormDialog.tsx`
- Bloco **"Estatísticas de Goleiro"** exibido só quando `posicao_jogo === 'goleiro'`.
- Grid com: Minutos jogados · Gols sofridos · Defesas importantes · Pênaltis defendidos.
- Switch **"Houve disputa de pênaltis?"** → abre sub-bloco: Placar (time × adv), Defendidos na disputa, Gol lado correto, Gol lado errado.
- Quando é goleiro, esconder os campos "Gols marcados" e "Assistências" (não fazem sentido).

### 3) `src/hooks/useJornada.ts` (`criarJogo` e `editarJogo`)
Encaminhar os 10 campos novos no `insert`/`update` de `carreira_jogos`.

### 4) `src/components/carreira/CarreiraJogoCard.tsx`
Se o jogo tem `posicao_jogo === 'goleiro'`, trocar badges por: **Defesas · Gols sofridos · Pênaltis defendidos**. Se `teve_disputa_penaltis`, mostrar linha extra: `Pênaltis: 4 × 3 · Def: 2`.

### 5) `src/types/jornada-esportiva.ts` — `EstatisticasAtleta`
Adicionar (opcionais): `totalDefesas`, `totalGolsSofridos`, `totalPenaltisDefendidos`, `minutosTotais`, `jogosComoGoleiro`.

### 6) `src/hooks/useJornada.ts` — agregação
Calcular os totais acima somando os jogos com `posicao_jogo === 'goleiro'`.

### 7) `src/components/carreira/CarreiraStatsCards.tsx`
Se `estatisticas.jogosComoGoleiro > 0`, mostrar cards adicionais: **Defesas**, **Gols sofridos**, **Pênaltis def.**, **Minutos**. Cards de "Gols" e "Assistências" continuam (para jogos como linha).

### 8) Regenerar `src/integrations/supabase/types.ts`
Rodar para incluir as colunas novas (automático no próximo build/refresh do types).

## Fora de escopo
- Estatística por campeonato específica de goleiro (pode vir depois).
- Import/export de planilha.
- Comparação com "outro goleiro" da planilha.
