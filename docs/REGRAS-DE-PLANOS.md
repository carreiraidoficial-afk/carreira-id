# Regras de planos, teste grátis e pagamentos — Carreira ID

Documento de consulta. Responde: "o que cada plano permite, quem decide isso, onde está implementado e o que ainda está pendente".
Atualize este arquivo sempre que uma regra mudar (veja o Histórico no fim).

Última revisão: 15/10/2026.

> **Nome do plano pago: Elite** (desde 15/10/2026, antes se chamava Premium). Só o nome que as pessoas veem mudou: no banco e no código o identificador interno continua sendo `premium` (ex.: `plano = 'premium'`, `carreira_valor_premium`).

---

## 1. Planos

| | Base (grátis) | Elite |
|---|---|---|
| Preço | R$ 0 | R$ 12,00/mês (anual R$ 120,00: ver seção 6, ainda não publicado) |
| Quem escolhe o preço | — | `saas_config` chaves `carreira_valor_premium` e `carreira_valor_premium_anual` |
| Registros de Carreira (histórico) | **1 por mês** (`saas_config.carreira_limite_free` = 1) | ilimitado (`carreira_planos_config.carreira_mes` = 9999) |
| Registros de Jornada | **1 campeonato novo por mês** (`carreira_planos_config.jornada_mes` = 1). Os jogos dentro do campeonato não contam. Imposto no servidor | ilimitado (9999) |
| Posts no feed por dia | 1 | 99 |
| Vídeo | não | até 60 s e 40 MB |
| YouTube (highlights) | não | sim |
| Prioridade nas buscas / destaque em listagens | não | sim |
| Selo no perfil | não | sim (aparece escrito "Elite") |
| Estatísticas avançadas | não | sim |
| Liga de Conexões | não | sim |
| Ver quem visualizou o perfil (cartão "Quem viu seu perfil" dentro de Conexões) | só o número de visitas dos últimos 30 dias, lista borrada | lista de quem visitou (nome, foto, tipo, quando). Imposto no servidor |
| Currículo em PDF (Resumo de 1 página ou Completo com todos os jogos; claro ou escuro; QR do perfil) | não: o botão aparece com selo Elite e a janela leva aos planos | sim: botão "Currículo PDF" na linha de seções do perfil, ao lado de Premiações (só para quem gerencia o perfil). **Em teste:** hoje só aparece para atletas da lista `carreira_recursos_liberados` (recurso `curriculo_pdf`; João Guilherme e Enzo Lima; estar na lista dá acesso mesmo sem Elite ativo). A chave `curriculo_pdf` em Admin → Planos está desligada no Elite; ao ligá-la, o recurso vale para todo o Elite. Decisão pendente: liberar o Resumo para o Base |

Plano Família: R$ 19,90/mês, cobre 2 ou mais atletas do mesmo responsável (tabela `carreira_assinaturas_familia`). Só mensal.

Nomes antigos: `competidor`, `elite`, `mensal`, `pro_mensal` valem como Elite (função `normalizePlano` e a função do banco).

## 2. Teste grátis (trial) — regra atual

- 15 dias de Elite, **sem cartão**, ao criar o perfil do atleta (ou os dias de um cupom válido, `carreira_cupons.dias_trial`; cupom com menos de 15 dias vale o padrão).
- **Perfil completo = +15 dias, uma vez por atleta** (total de 30). Completo é: foto, bio, categoria, cidade e estado, posição, data de nascimento e pelo menos 1 jogo registrado. Conferido no servidor (`_perfil_completo_itens`, gatilhos em `perfil_atleta`, `carreira_jogos` e `criancas`); só concede a quem está no teste; registro em `carreira_bonus_perfil_completo`. A tela mostra o progresso (`PerfilCompletoCard`).
- **Mensagem ao público:** o Carreira ID é gratuito; o plano Base não tem prazo. O Elite é experimental e depois pago.
- Durante o teste o atleta tem **tudo do Elite** (tela e, desde 14/10/2026, também os limites de registros de Carreira e da Jornada).
- Uma vez por atleta. O servidor recusa um segundo teste para o mesmo atleta.
- **Quem assina durante o teste não precisa esperar:** a assinatura vale na hora, a cobrança é feita já, e a pessoa ganha **pelo menos 15 dias a mais** (se sobravam mais de 15 dias, por exemplo num teste de cupom, ganha o que sobrava). O teste só é encerrado quando o pagamento confirma. Teste já vencido não dá bônus.
- Avisos: push e e-mail, 2 dias antes e quando acaba (e-mail só para quem não pediu para sair dos lembretes).
- Ao terminar, volta sozinho para Base (decisão de 19/10/2026: 15 dias + 15 ao completar o perfil, antes eram 7). Nada é apagado; só valem de novo os limites do Base e os recursos exclusivos do Elite voltam a ficar fechados. Ninguém é cobrado sem ter informado cartão ou pago um PIX.
- O usuário não consegue se dar Elite pelo app: o banco bloqueia (gatilho `assinaturas_protege`).

## 3. Quem decide cada coisa (fonte da verdade)

| O que | Onde se muda | Observação |
|---|---|---|
| Limites e recursos do Elite/Base (posts, vídeo, selo, etc.) | Admin → Planos & Features (`carreira_planos_config`) | Vale só na tela do app; **não é imposto no servidor** |
| Limite mensal de registros de Carreira | Elite: `carreira_planos_config.carreira_mes`. Base: `saas_config.carreira_limite_free` | Imposto pela função do banco `check_carreira_atividade_limit` |
| Limite mensal de campeonatos da Jornada | `carreira_planos_config.jornada_mes` (Base 1, Elite 9999) | Imposto no servidor por gatilho em `carreira_campeonatos` (função `check_carreira_jornada_limit`); a tela mostra a oferta de Elite ao bater o limite |
| Preço cobrado | `saas_config` (`carreira_valor_premium`, `carreira_valor_premium_anual`) | O campo "Preço" do Admin → Planos **não altera a cobrança** |
| Preço mostrado nas telas | Constantes em `src/config/carreiraPlanos.ts` (`PRECO_PREMIUM`, `PRECO_PREMIUM_ANUAL`, `PRECO_FAMILIA`) | Hoje precisam bater com o `saas_config` na mão |
| Textos da página de planos ("1 registro por mês" etc.) | `src/config/carreiraPlanos.ts` (lista `destaques`) | Fixos no código; o admin não muda |
| Duração do teste e bônus | `TRIAL_DIAS` (15) e `BONUS_PERFIL_COMPLETO_DIAS` (15) em `src/config/carreiraPlanos.ts`; no banco: `assinaturas_protege`, `carreira_assinatura_converte_trial`, `_conceder_bonus_perfil_completo` | Mudar nos dois lados |

## 4. Como o acesso é decidido no app

1. Lista de exceções manual (`atividades_externas_whitelist`) → Elite sem limite.
2. Assinatura `ativa` dentro da validade, ou `trial` dentro do prazo → Elite.
3. Qualquer outra coisa → Base.

Isso vale por atleta (`crianca_id`), não por pessoa logada: quem colabora no perfil herda o plano do atleta.
Implementado em `src/hooks/useCarreiraPlano.ts` (telas) e em `check_carreira_atividade_limit` (banco).

## 5. Cobrança e segurança (resumo; detalhes em `ANALISE-PAGAMENTOS-2026-10.md`)

- Gateway: Asaas (produção). Cartão e PIX.
- O webhook (`asaas-webhook`) só vale se a cobrança for confirmada direto na API do Asaas; também confere o valor e trata reembolso e chargeback.
- As funções de pagamento exigem login e usam o usuário do token (nunca o `user_id` do corpo).
- Renovação por PIX (`renew-carreira-pix`, todo dia 8h): uma cobrança por vencimento, avisa por push e e-mail.
- Configurar no painel do Asaas: eventos `PAYMENT_REFUNDED` e `PAYMENT_CHARGEBACK_REQUESTED` no webhook de produção.

## 6. Plano anual (publicado em 14/10/2026; ainda sem teste real de pagamento)

- R$ 120,00 por 365 dias, pagamento único: PIX, ou cartão à vista / até 12x. **Não renova sozinho**; aviso 7 dias antes de vencer.
- Quem já tem assinatura ativa só contrata o anual quando ela vencer ou for cancelada.
- Colunas novas em `carreira_assinaturas`: `ciclo` (mensal/anual), `duracao_dias`, `ultimo_pagamento_id`.
- A validade passa a somar ao que resta, e cada cobrança é contada uma vez.

## 7. Decisões e pendências

| # | Pendência | Situação |
|---|---|---|
| 1 | Limite do Base para registros de Carreira | **Resolvido em 14/10/2026: 1 por mês** |
| 2 | Limite da Jornada no Base | **Resolvido em 14/10/2026: 1 campeonato novo por mês** (a regra conta campeonatos, não jogos; confirmar se é isso mesmo que se quer) |
| 3 | "Ver quem visualizou o perfil" saiu da tela de Conexões, mas é promessa do Elite | **Resolvido em 14/10/2026**: aba "Visitas" em Conexões |
| 4 | Currículo em PDF | **Resolvido em 16/10/2026**: botão no perfil do atleta (dono), Elite; vôlei e basquete ainda mostram só números gerais |
| 5 | Preço editável no admin não faz efeito | Unificar a fonte do preço |
| 6 | Limites só valem na tela, não no servidor | Avaliar travas no banco |
| 7 | Teste grátis: manter, simplificar ou remover | Em discussão |
| 9 | Nova categoria acima do Elite, com upload de dados de campeonatos (sob consulta) | Em desenho: nome, preço e forma de cobrança a definir |
| 8 | Google Play: cobrança de assinatura dentro do app pode exigir o sistema do Google | Decidir antes de publicar na loja |

## 8. Histórico de mudanças nas regras

- **16/10/2026** — Currículo em PDF volta ao app como recurso do Elite: botão "Currículo PDF" ao lado de Premiações, com janela para escolher Resumo ou Completo e aparência clara ou escura. Em fase de teste: liberado só para o João Guilherme (tabela `carreira_recursos_liberados`); chave `curriculo_pdf` do Elite desligada até a liberação geral.

- **15/10/2026** — O plano pago passa a se chamar **Elite** em toda a interface, e-mails e avisos (identificador interno segue `premium`).
- **15/10/2026** — Quem assina durante o teste ganha pelo menos 7 dias grátis a mais (antes: só os dias que sobravam).

- **15/10/2026** — Teste grátis: gerar o PIX ou enviar o cartão **não cancela mais o teste**; ele só termina quando o pagamento confirma, e os dias que sobravam do teste são somados ao primeiro período pago (gatilho `carreira_assinatura_converte_trial`). Avisos de fim de teste agora também por **e-mail** (2 dias antes e quando acaba, até 3 dias depois), para todos que não assinaram e não pediram para sair dos lembretes.

- **15/10/2026** — Cupons ganham limite opcional de usos (campo "Limite de usos" no admin), conferido no servidor.

- **15/10/2026** — Cupons: a tabela deixou de ser pública (antes qualquer visitante listava todos os códigos). Validação do código, selo de escola parceira e lista de escolas parceiras agora passam por funções do servidor (`carreira_cupom_validar`, `carreira_escola_e_parceira`, `carreira_escolas_parceiras_ids`). Código vale só por igualdade exata (sem curingas).

- **14/10/2026** — "Quem viu" deixou de ser uma aba separada: virou um cartão no topo da aba Conexões (decisão do usuário). Mesma regra: Elite vê quem visitou; Base vê só o número.

- **14/10/2026** — Aba "Visitas" em Conexões: Elite (e teste) vê quem visitou; Base vê só o número dos últimos 30 dias. A leitura da lista é bloqueada no servidor para o Base.

- **14/10/2026** — Base passa a 1 registro de Carreira por mês (antes o banco aplicava 2). Base passa a ter limite de 1 campeonato novo por mês na Jornada, imposto no servidor; Elite e teste continuam ilimitados.

- **14/10/2026** — Função `check_carreira_atividade_limit` corrigida: Elite e teste passam a ser ilimitados em registros de Carreira. Antes, qualquer plano pago era travado em 3 por mês e o teste valia como Base. O Base seguiu igual (2).
- **14/10/2026** — Gatilho `assinaturas_protege` (usuário não se promove sozinho); funções de pagamento exigem login; webhook confere no Asaas.
- **14/10/2026** — Plano anual publicado (banco, funções e tela). Pendente: primeiro pagamento real de teste.
- **14/10/2026** — Tela Admin → Planos corrigida (cache com a mesma chave que os limites do app causava erro).

## 9. Cupons (como funcionam hoje)

- Um cupom dá **dias de teste extras** (campo `dias_trial`) a um atleta novo, digitado no cadastro. Não dá desconto e não paga assinatura.
- Só vale no cadastro de um atleta novo; não se aplica a atleta que já existe.
- Admin → Cupons: criar, editar, ativar/desativar, validade, vínculo com escola parceira e contagem de atletas trazidos.
- **Limite de usos por código** (opcional, campo no admin): ex. IGOR30 com 20 = vale para até 20 famílias; vazio = ilimitado. Cada teste criado com o cupom conta um uso (excluir o teste devolve a vaga). Esgotado, o código deixa de ser aceito e a família ganha o teste padrão de 7 dias, sem erro. Conferido no servidor, com trava para a última vaga.
- Para dar Elite a uma conta que já existe: Admin → Assinaturas → "Conceder isenção".
- **19/10/2026** — Teste do Elite passou de 7 para 15 dias, com +15 ao completar o perfil (foto, bio, categoria, local, posição, nascimento e 1 jogo). Quem assina durante o teste ganha pelo menos 15 dias a mais. Quem já estava no teste (ativo ou vencido) ganhou +15 dias, uma vez. Comunicação: o Carreira ID é gratuito e o Base não vence.
