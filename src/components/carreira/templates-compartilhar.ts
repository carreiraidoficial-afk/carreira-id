// Templates de mensagens para o modal "Compartilhar perfil"
// Placeholders: {nome} = nome do atleta, {link} = URL pronta

export type TemplateModo = 'torcedor' | 'atleta' | 'rede';

export interface Template {
  id: string;
  label: string;
  hint?: string;
  body: string;
}

export const TEMPLATES_TORCEDOR: Template[] = [
  {
    id: 'direto',
    label: 'Direto',
    hint: 'Curto e objetivo',
    body:
      'Aqui é o {nome}! 🙌\n' +
      'Tô montando meu perfil esportivo e queria te ter na minha torcida.\n' +
      'É rapidinho, é só clicar e me seguir:\n{link}',
  },
  {
    id: 'curto',
    label: 'Curto',
    hint: 'Pra mandar pra galera',
    body:
      'Aqui é o {nome} 👊\n' +
      'Cola na minha torcida! {link}',
  },
  {
    id: 'explicativo',
    label: 'Explicativo',
    hint: 'Pra família que não conhece',
    body:
      'Aqui é o {nome}! Tudo bem? 😊\n\n' +
      'Eu criei meu perfil esportivo numa plataforma chamada Carreira ID — é tipo um LinkedIn pra quem joga bola.\n' +
      'Lá eu mostro meus jogos, gols, troféus e a evolução da minha carreira.\n\n' +
      'Queria muito te ter como torcedor(a) acompanhando essa jornada comigo. ' +
      'É só clicar no link, fazer um cadastro rapidinho e me seguir:\n\n{link}\n\n' +
      'Vai ser muito massa ter você junto! ⚽',
  },
];

export const TEMPLATES_ATLETA_CRIANCA: Template[] = [
  {
    id: 'gamer',
    label: 'Ranking',
    hint: 'Foco em gamificação',
    body:
      'Aqui é o {nome}! 🎮⚽\n' +
      'Cara, entra nesse app comigo — tem ranking, níveis, XP por jogo, troféu, tudo!\n' +
      'Bora ver quem sobe mais rápido?\n{link}',
  },
  {
    id: 'time',
    label: 'Pro time',
    hint: 'Convite pra colegas de time',
    body:
      'Aqui é o {nome} 👊\n' +
      'Tô usando uma plataforma pra registrar tudo da nossa carreira (gol, jogo, premiação).\n' +
      'Cria o seu também, aí a gente acompanha um ao outro:\n{link}',
  },
  {
    id: 'curto',
    label: 'Curto',
    hint: 'Direto ao ponto',
    body: 'Aqui é o {nome}, cola nesse app comigo, é massa demais: {link}',
  },
];

export const TEMPLATES_ATLETA_PAI: Template[] = [
  {
    id: 'apresentacao',
    label: 'Apresentação',
    hint: 'Pra outros pais',
    body:
      'Oi! Tudo bem?\n\n' +
      'Estou usando uma plataforma chamada Carreira ID pra registrar a trajetória esportiva do meu filho — jogos, gols, troféus, evolução.\n' +
      'É bem útil pra acompanhar a carreira da molecada e mostrar pra olheiros e clubes.\n\n' +
      'Cadastra o seu também, fica fácil de a gente trocar ideia sobre a evolução deles:\n{link}',
  },
  {
    id: 'curto-pai',
    label: 'Curto',
    hint: 'Mensagem rápida',
    body:
      'Oi! Tô usando esse app pra acompanhar o esporte do meu filho — vale dar uma olhada e cadastrar o seu:\n{link}',
  },
];

export const TEMPLATES_REDE: Template[] = [
  {
    id: 'profissional',
    label: 'Profissional',
    hint: 'Formal — pra quem ainda não conhece',
    body:
      'Olá! Tudo bem?\n\n' +
      'Aqui é o(a) responsável pelo atleta {nome}. Estamos usando o Carreira ID, ' +
      'uma plataforma feita pra reunir profissionais do esporte (técnicos, professores, scouts, preparadores) ' +
      'e acompanhar a trajetória de jovens atletas.\n\n' +
      'Adoraríamos ter você na nossa rede. É só fazer um cadastro rápido escolhendo seu perfil profissional:\n\n{link}',
  },
  {
    id: 'tecnico-conhecido',
    label: 'Técnico conhecido',
    hint: 'Mais informal',
    body:
      'Fala, professor(a)! 👊\n' +
      'Aqui é o pai/mãe do {nome}. A gente tá registrando a carreira dele(a) numa plataforma nova ' +
      'e queria muito te ter conectado lá pra acompanhar a evolução de perto.\n\n' +
      'Cadastro rapidinho, escolhe seu perfil (técnico/professor/scout) e a gente já fica conectado:\n{link}',
  },
];

/** Mensagens de quem é PROFISSIONAL (professor, técnico, preparador, escola, scout...) convidando outras pessoas.
 * {eu} = "Nome, função" (a função some se não houver). */
export const TEMPLATES_PROFISSIONAL_COLEGAS: Template[] = [
  {
    id: 'direto',
    label: 'Direto',
    hint: 'Pra colegas de profissão',
    body:
      'Oi! Aqui é {eu}. 👋\n' +
      'Estou no Carreira ID, a rede do esporte de base: perfil profissional, histórico e conexão com atletas e outros profissionais.\n' +
      'Cria o seu perfil por esse link e já ficamos conectados:\n{link}',
  },
  {
    id: 'curto',
    label: 'Curto',
    hint: 'Pra mandar rápido',
    body: 'Aqui é {eu}. Entra no Carreira ID e já ficamos conectados: {link}',
  },
  {
    id: 'formal',
    label: 'Formal',
    hint: 'Pra quem ainda não conhece',
    body:
      'Olá! Tudo bem?\n\n' +
      'Sou {eu}. Estou usando o Carreira ID, uma plataforma que reúne profissionais do esporte de base ' +
      '(professores, técnicos, preparadores, scouts, escolas) e acompanha a trajetória de jovens atletas.\n\n' +
      'Seria um prazer ter você na rede. O cadastro é rápido e, ao criar seu perfil por este link, já ficamos conectados:\n\n{link}',
  },
];

export const TEMPLATES_PROFISSIONAL_ATLETAS: Template[] = [
  {
    id: 'pais',
    label: 'Pais e responsáveis',
    hint: 'Pra famílias dos meus atletas',
    body:
      'Olá! Aqui é {eu}.\n\n' +
      'No Carreira ID cada atleta tem um perfil com jogos, evolução e conquistas, e eu acompanho de perto por lá.\n' +
      'Crie o perfil do(a) seu(sua) filho(a) por este link e fique conectado(a) comigo:\n\n{link}',
  },
  {
    id: 'atleta',
    label: 'Atleta',
    hint: 'Direto pro atleta',
    body:
      'Fala! Aqui é {eu}. 👊\n' +
      'Cria seu perfil de atleta no Carreira ID por esse link, registra seus jogos e sua evolução, e já ficamos conectados:\n{link}',
  },
  {
    id: 'curto',
    label: 'Curto',
    hint: 'Mensagem rápida',
    body: 'Aqui é {eu}. Cria o perfil do atleta no Carreira ID e já fica conectado comigo: {link}',
  },
];

export function aplicarTemplate(template: string, nome: string, link: string, funcao?: string): string {
  const eu = funcao ? `${nome}, ${funcao}` : nome;
  return template.replace(/\{eu\}/g, eu).replace(/\{nome\}/g, nome).replace(/\{link\}/g, link);
}
