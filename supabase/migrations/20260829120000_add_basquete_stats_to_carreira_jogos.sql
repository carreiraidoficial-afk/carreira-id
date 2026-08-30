-- Estatisticas de basquete, mesmo padrao das colunas de volei ja existentes
-- (pontos_ataque, sets_detalhe etc) -- um bloco de campos opcionais por
-- modalidade na mesma tabela carreira_jogos, gated no front-end por
-- isModalidadeBasquete(). Nomenclatura em portugues seguindo a sumula
-- oficial da LNB/CBB (PTS, RO, RD, BR, TO, FC, 2P, 3P, LL).
ALTER TABLE public.carreira_jogos
  ADD COLUMN pontos integer,
  ADD COLUMN rebotes_ofensivos integer,
  ADD COLUMN rebotes_defensivos integer,
  ADD COLUMN roubos_bola integer,
  ADD COLUMN tocos integer,
  ADD COLUMN faltas_cometidas integer,
  ADD COLUMN arremessos_2pt_tentados integer,
  ADD COLUMN arremessos_2pt_convertidos integer,
  ADD COLUMN arremessos_3pt_tentados integer,
  ADD COLUMN arremessos_3pt_convertidos integer,
  ADD COLUMN lances_livres_tentados integer,
  ADD COLUMN lances_livres_convertidos integer,
  ADD COLUMN quartos_detalhe jsonb;
