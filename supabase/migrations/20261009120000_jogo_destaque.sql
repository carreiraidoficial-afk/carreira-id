-- Destaque do jogo: o atleta foi o destaque da partida (selo no cartao do jogo, estatistica "Destaques" e Sala de Trofeus).
ALTER TABLE public.carreira_jogos ADD COLUMN IF NOT EXISTS destaque_jogo BOOLEAN NOT NULL DEFAULT false;

-- Enzo Lima, Supercopa Trivella 2026: destaque do jogo nas rodadas 2 e 3 (dado do iFut). O texto que eu tinha deixado
-- nas observacoes sai, porque agora o destaque aparece como selo.
UPDATE public.carreira_jogos j
SET destaque_jogo = true,
    observacoes = NULL
FROM public.perfil_atleta p, public.carreira_campeonatos c
WHERE p.slug = 'enzo-lima-4yhz'
  AND j.crianca_id = p.crianca_id
  AND c.id = j.campeonato_id AND c.nome ILIKE '%supercopa%trivella%2026%'
  AND j.data_jogo IN ('2026-09-20', '2026-09-27')
  AND j.observacoes = 'Jogador destaque do jogo (dado do iFut).';
