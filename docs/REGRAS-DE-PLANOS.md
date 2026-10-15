# Regras de planos, teste grátis e pagamentos — Carreira ID

Documento de consulta. Responde: "o que cada plano permite, quem decide isso, onde está implementado e o que ainda está pendente".
Atualize este arquivo sempre que uma regra mudar (veja o Histórico no fim).

Última revisão: 14/10/2026.

---

## 1. Planos

| | Base (grátis) | Premium |
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
| Currículo em PDF | não | **botão existe, mas não está em nenhuma tela** |

Plano Família: R$ 19,90/mês, cobre 2 ou mais atletas do mesmo responsável (tabela `carreira_assinaturas_familia`). Só mensal.

Nomes antigos: `competidor`, `elite`, `mensal`, `pro_mensal` valem como Premium (função `normalizePlano` e a função do banco).

## 2. Teste grátis (trial) — regra atual

- 7 dias, **sem cartão**, ao criar o perfil do atleta (ou os dias de um cupom válido, `carreira_cupons.dias_trial`).
- Durante o teste o atleta tem **tudo do Premium** (tela e, desde 14/10/2026, também os limites de registros de Carreira e da Jornada).
- Uma vez por atleta. O servidor recusa um segundo teste para o mesmo atleta.
- Ao terminar, volta sozinho para Base (decisão de 14/10/2026: o teste continua de 7 dias). Nada é apagado; só valem de novo os limites do Base e os recursos exclusivos do Premium voltam a ficar fechados. Ninguém é cobrado sem ter informado cartão ou pago um PIX.
- O usuário não consegue se dar Premium pelo app: o banco bloqueia (gatilho `assinaturas_protege`).

## 3. Quem decide cada coisa (fonte da verdade)

| O que | Onde se muda | Observação |
|---|---|---|
| Limites e recursos do Premium/Base (posts, vídeo, selo, etc.) | Admin → Planos & Features (`carreira_planos_config`) | Vale só na tela do app; **não é imposto no servidor** |
| Limite mensal de registros de Carreira | Premium: `carreira_planos_config.carreira_mes`. Base: `saas_config.carreira_limite_free` | Imposto pela função do banco `check_carreira_atividade_limit` |
| Limite mensal de campeonatos da Jornada | `carreira_planos_config.jornada_mes` (Base 1, Premium 9999) | Imposto no servidor por gatilho em `carreira_campeonatos` (função `check_carreira_jornada_limit`); a tela mostra a oferta de Premium ao bater o limite |
| Preço cobrado | `saas_config` (`carreira_valor_premium`, `carreira_valor_premium_anual`) | O campo "Preço" do Admin → Planos **não altera a cobrança** |
| Preço mostrado nas telas | Constantes em `src/config/carreiraPlanos.ts` (`PRECO_PREMIUM`, `PRECO_PREMIUM_ANUAL`, `PRECO_FAMILIA`) | Hoje precisam bater com o `saas_config` na mão |
| Textos da página de planos ("1 registro por mês" etc.) | `src/config/carreiraPlanos.ts` (lista `destaques`) | Fixos no código; o admin não muda |
| Duração do teste | `TRIAL_DIAS` (7) em `src/config/carreiraPlanos.ts` e regra do banco | |

## 4. Como o acesso é decidido no app

1. Lista de exceções manual (`atividades_externas_whitelist`) → Premium sem limite.
2. Assinatura `ativa` dentro da validade, ou `trial` dentro do prazo → Premium.
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
| 3 | "Ver quem visualizou o perfil" saiu da tela de Conexões, mas é promessa do Premium | **Resolvido em 14/10/2026**: aba "Visitas" em Conexões |
| 4 | Currículo em PDF existe no código, sem tela | Decidir onde entra ou remover da lista de recursos |
| 5 | Preço editável no admin não faz efeito | Unificar a fonte do preço |
| 6 | Limites só valem na tela, não no servidor | Avaliar travas no banco |
| 7 | Teste grátis: manter, simplificar ou remover | Em discussão |
| 9 | Nova categoria acima do Premium, com upload de dados de campeonatos (sob consulta) | Em desenho: nome, preço e forma de cobrança a definir |
| 8 | Google Play: cobrança de assinatura dentro do app pode exigir o sistema do Google | Decidir antes de publicar na loja |

## 8. Histórico de mudanças nas regras

- **15/10/2026** — Cupons: a tabela deixou de ser pública (antes qualquer visitante listava todos os códigos). Validação do código, selo de escola parceira e lista de escolas parceiras agora passam por funções do servidor (`carreira_cupom_validar`, `carreira_escola_e_parceira`, `carreira_escolas_parceiras_ids`). Código vale só por igualdade exata (sem curingas).

- **14/10/2026** — "Quem viu" deixou de ser uma aba separada: virou um cartão no topo da aba Conexões (decisão do usuário). Mesma regra: Premium vê quem visitou; Base vê só o número.

- **14/10/2026** — Aba "Visitas" em Conexões: Premium (e teste) vê quem visitou; Base vê só o número dos últimos 30 dias. A leitura da lista é bloqueada no servidor para o Base.

- **14/10/2026** — Base passa a 1 registro de Carreira por mês (antes o banco aplicava 2). Base passa a ter limite de 1 campeonato novo por mês na Jornada, imposto no servidor; Premium e teste continuam ilimitados.

- **14/10/2026** — Função `check_carreira_atividade_limit` corrigida: Premium e teste passam a ser ilimitados em registros de Carreira. Antes, qualquer plano pago era travado em 3 por mês e o teste valia como Base. O Base seguiu igual (2).
- **14/10/2026** — Gatilho `assinaturas_protege` (usuário não se promove sozinho); funções de pagamento exigem login; webhook confere no Asaas.
- **14/10/2026** — Plano anual publicado (banco, funções e tela). Pendente: primeiro pagamento real de teste.
- **14/10/2026** — Tela Admin → Planos corrigida (cache com a mesma chave que os limites do app causava erro).

## 9. Cupons (como funcionam hoje)

- Um cupom dá **dias de teste extras** (campo `dias_trial`) a um atleta novo, digitado no cadastro. Não dá desconto e não paga assinatura.
- Só vale no cadastro de um atleta novo; não se aplica a atleta que já existe.
- Admin → Cupons: criar, editar, ativar/desativar, validade, vínculo com escola parceira e contagem de atletas trazidos.
- Limite de usos por código: **ainda não existe** (proposta em discussão).
- Para dar Premium a uma conta que já existe: Admin → Assinaturas → "Conceder isenção".
