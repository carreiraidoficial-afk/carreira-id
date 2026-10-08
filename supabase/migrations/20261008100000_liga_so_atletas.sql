-- Liga so para atletas: perfis profissionais (tecnico, professor, preparador, escola, scout, torcedor etc.) nao pontuam.
--
-- 1) adicionar_pontos (porta de entrada de TODOS os gatilhos de pontuacao): conta sem perfil_atleta nao ganha
--    ponto, XP, historico nem contador. Conta que tem atleta continua pontuando como antes.
-- 2) handle_post_criado: so post de ATLETA pontua. Post feito pelo perfil de rede (escola, tecnico...) de uma conta
--    que tambem tem atleta nao soma no ranking do atleta.
-- 3) handle_convite_confirmado: o convite continua REGISTRADO (rede_convites, com tipo_convidado) para o ranking de
--    convites do admin, mas so gera pontos, badges e progresso de desafio quando o convidante e a familia de um
--    atleta (perfis_rede tipo pai_responsavel de uma conta com perfil_atleta). Qualquer outro tipo: 0 pontos.

CREATE OR REPLACE FUNCTION public.adicionar_pontos(
  p_user_id uuid,
  p_acao_tipo text,
  p_pontos integer,
  p_descricao text,
  p_referencia_id uuid DEFAULT NULL::uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Liga so para atletas
  IF NOT EXISTS (SELECT 1 FROM public.perfil_atleta WHERE user_id = p_user_id) THEN
    RETURN;
  END IF;

  INSERT INTO public.pontos_historico (
    user_id, acao_tipo, pontos, descricao, referencia_id
  ) VALUES (
    p_user_id, p_acao_tipo, p_pontos, p_descricao, p_referencia_id
  );

  INSERT INTO public.user_gamificacao (
    user_id, pontos_total, xp_atual
  ) VALUES (
    p_user_id, p_pontos, p_pontos
  ) ON CONFLICT (user_id) DO UPDATE SET
    pontos_total = user_gamificacao.pontos_total + p_pontos,
    xp_atual = user_gamificacao.xp_atual + p_pontos;

  IF p_acao_tipo = 'convite_enviado' THEN
    UPDATE public.user_gamificacao
    SET convites_enviados = convites_enviados + 1
    WHERE user_id = p_user_id;
  ELSIF p_acao_tipo = 'convite_confirmado' THEN
    UPDATE public.user_gamificacao
    SET convites_confirmados = convites_confirmados + 1
    WHERE user_id = p_user_id;
  ELSIF p_acao_tipo = 'post_criado' THEN
    UPDATE public.user_gamificacao
    SET posts_criados = posts_criados + 1
    WHERE user_id = p_user_id;
  ELSIF p_acao_tipo = 'conexao_feita' THEN
    UPDATE public.user_gamificacao
    SET conexoes_feitas = conexoes_feitas + 1
    WHERE user_id = p_user_id;
  ELSIF p_acao_tipo = 'atividade_registrada' THEN
    UPDATE public.user_gamificacao
    SET atividades_registradas = atividades_registradas + 1
    WHERE user_id = p_user_id;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_post_criado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  post_user_id UUID;
  v_pontos INTEGER;
BEGIN
  -- So post de atleta pontua (post de perfil de rede nao entra na Liga)
  IF NEW.autor_id IS NOT NULL THEN
    SELECT user_id INTO post_user_id FROM perfil_atleta WHERE id = NEW.autor_id;
  END IF;

  IF post_user_id IS NOT NULL THEN
    v_pontos := public.get_acao_pontos('post_criado');
    IF v_pontos > 0 THEN
      PERFORM public.adicionar_pontos(
        post_user_id,
        'post_criado',
        v_pontos,
        'Post criado na timeline',
        NEW.id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_convite_confirmado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  convidante_user_id UUID;
  v_tipo_convidante TEXT;
  v_tipo_convidado TEXT;
  v_pontos INTEGER;
  v_pontua BOOLEAN;
  v_desafio RECORD;
  v_just_completed INTEGER;
BEGIN
  SELECT pr.user_id, pr.tipo INTO convidante_user_id, v_tipo_convidante
  FROM perfis_rede pr
  WHERE pr.id = NEW.convidante_perfil_id;

  SELECT tipo INTO v_tipo_convidado
  FROM perfis_rede
  WHERE user_id = NEW.convidado_user_id
  LIMIT 1;

  IF v_tipo_convidado IS NULL THEN
    IF EXISTS (SELECT 1 FROM perfil_atleta WHERE user_id = NEW.convidado_user_id) THEN
      v_tipo_convidado := 'atleta_filho';
    END IF;
  END IF;

  -- Pontua so a familia de atleta (pai_responsavel de conta com perfil_atleta). Profissional: convite registrado, 0 pontos.
  v_pontua := convidante_user_id IS NOT NULL
    AND v_tipo_convidante = 'pai_responsavel'
    AND EXISTS (SELECT 1 FROM perfil_atleta WHERE user_id = convidante_user_id);

  IF NOT v_pontua THEN
    UPDATE rede_convites
    SET tipo_convidado = v_tipo_convidado,
        pontos_concedidos = 0
    WHERE id = NEW.id;
    RETURN NEW;
  END IF;

  SELECT pontos INTO v_pontos
  FROM gamificacao_pontos_tipo
  WHERE tipo_perfil = v_tipo_convidado;

  v_pontos := COALESCE(v_pontos, 50);

  UPDATE rede_convites
  SET tipo_convidado = v_tipo_convidado,
      pontos_concedidos = v_pontos
  WHERE id = NEW.id;

  PERFORM public.adicionar_pontos(
    convidante_user_id,
    'convite_confirmado',
    v_pontos,
    'Convite confirmado - ' || COALESCE(v_tipo_convidado, 'usuario') || ' (' || v_pontos || ' pts)',
    NEW.id
  );

  PERFORM public.verificar_badges_convites(convidante_user_id);

  FOR v_desafio IN
    SELECT d.* FROM desafios_convite d
    WHERE d.ativo = true
    AND (d.data_fim IS NULL OR d.data_fim > now())
    AND (d.tipo_perfil_alvo = '{}' OR v_tipo_convidado = ANY(d.tipo_perfil_alvo))
  LOOP
    INSERT INTO desafio_progresso (user_id, desafio_id, progresso_atual)
    VALUES (convidante_user_id, v_desafio.id, 1)
    ON CONFLICT (user_id, desafio_id) DO UPDATE
    SET progresso_atual = desafio_progresso.progresso_atual + 1;

    UPDATE desafio_progresso
    SET completado = true, completado_em = now()
    WHERE user_id = convidante_user_id
    AND desafio_id = v_desafio.id
    AND progresso_atual >= v_desafio.quantidade_meta
    AND completado = false;

    GET DIAGNOSTICS v_just_completed = ROW_COUNT;

    IF v_just_completed > 0 AND v_desafio.pontos_bonus > 0 THEN
      PERFORM public.adicionar_pontos(
        convidante_user_id,
        'desafio_completado',
        v_desafio.pontos_bonus,
        'Desafio completado: ' || v_desafio.titulo,
        v_desafio.id
      );

      IF v_desafio.badge_premio_tipo IS NOT NULL THEN
        PERFORM public.dar_badge(
          convidante_user_id,
          v_desafio.badge_premio_tipo,
          COALESCE(v_desafio.badge_premio_nome, v_desafio.titulo),
          'Completou o desafio: ' || v_desafio.titulo,
          COALESCE(v_desafio.badge_premio_icone, U&'\+01F3C6'),
          COALESCE(v_desafio.badge_premio_cor, '#ffd700')
        );
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;
