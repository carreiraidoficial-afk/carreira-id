(function () {
  // Lista de artigos em ordem cronologica (mais recente primeiro) -- mesma
  // ordem dos cards em /blog/index.html. Ao publicar um artigo novo,
  // adicione ele aqui tambem (no topo), alem do card na listagem.
  var ARTICLES = [
    { slug: 'tipos-de-pais-no-futebol-de-base', title: 'Os Tipos de Pais e Mães Que Todo Mundo Encontra no Futebol de Base' },
    { slug: 'mae-eu-sou-ruim-impacto-emocional-falas-de-tecnicos', title: '"Mãe, Eu Sou Ruim?": O Que Uma Fala Pode Fazer com uma Criança' },
    { slug: 'tecnicos-que-gritam-e-xingam-nao-e-motivacao-e-medo', title: 'Técnicos Que Gritam e Xingam: Isso Não É Motivação, É Medo' },
    { slug: 'efeito-da-idade-relativa-no-futebol-de-base', title: 'Efeito da Idade Relativa: Por Que o Mês de Nascimento Pode Afetar Seu Filho no Futebol' },
    { slug: 'como-fazer-analise-swot-antes-da-peneira', title: 'Como Fazer uma Análise SWOT Antes da Peneira do Seu Filho' },
    { slug: 'atleta-x-tecnico-voces-enxergam-o-mesmo-jogador', title: 'Atleta x Técnico: Vocês Enxergam o Mesmo Jogador?' },
    { slug: 'analise-swot-para-atletas-de-base-guia-para-pais', title: 'Análise SWOT para Atletas de Base: Um Guia Simples Pra Pais Aplicarem' },
    { slug: 'estudos-e-futebol-como-conciliar-os-dois', title: 'Estudos e Futebol: Como Ajudar Seu Filho a Conciliar os Dois' },
    { slug: 'meu-filho-quer-ser-jogador-de-futebol-por-onde-comecar', title: 'Meu Filho Quer Ser Jogador de Futebol: Por Onde Começar' },
    { slug: 'educacao-fisica-brasil-x-esporte-escolar-eua', title: 'Educação Física no Brasil x Esporte Escolar nos EUA: Por Que Essa Diferença Importa' },
    { slug: 'como-promover-atleta-redes-sociais-com-seguranca', title: 'Como Promover Seu Atleta nas Redes Sociais Sem Cometer Erros Comuns' },
    { slug: 'como-conseguir-patrocinio-para-atleta-de-base', title: 'Como Conseguir Patrocínio Para o Seu Filho Atleta (Com ou Sem Clube)' },
    { slug: 'nutricao-no-futebol-de-base-o-que-todo-pai-precisa-saber', title: 'Nutrição no Futebol de Base: O Que Todo Pai Precisa Saber' },
    { slug: 'eca-digital-alvara-judicial-contas-de-menores-redes-sociais', title: 'Seu Filho Tem Conta nas Redes? O Que Todo Pai de Atleta Precisa Saber Agora' },
    { slug: 'derrota-preparo-tecnico-pais-futebol-de-base', title: 'Quando o Placar Apaga o Esforço: A Derrota e o Preparo de Quem Está Ao Lado da Criança' },
    { slug: 'crescimento-futebol-estados-unidos', title: 'O Crescimento do Futebol nos Estados Unidos e as Oportunidades pro Seu Filho' },
    { slug: 'golpes-falsos-empresarios-futebol-de-base', title: 'Cuidado com os Falsos Empresários: Como Proteger Seu Filho de Golpes no Futebol' },
    { slug: 'bolsa-atleta-categoria-base-como-funciona', title: 'Bolsa Atleta: Como Funciona o Apoio Financeiro do Governo pra Jovens Atletas' },
    { slug: 'mecanismo-de-solidariedade-no-futebol-de-base', title: 'Seu Filho Pode Valer Dinheiro Pro Clube — E Você, o Que Ganha Nisso?' },
    { slug: 'lideranca-o-que-faltou-argentina-final-copa-2026', title: 'Liderança: O Que Faltou ao Time da Argentina na Final da Copa 2026' },
    { slug: 'saber-perder-licao-final-copa-do-mundo-2026-para-filhos', title: 'Saber Perder: A Lição da Final da Copa do Mundo 2026 Para Nossos Filhos' },
    { slug: 'pedri-penalti-pai-conexao-pai-filho-no-esporte', title: 'Pedri, o Pai e o Pênalti: Uma Lição Sobre Nunca Desistir do Seu Filho' },
    { slug: '10-habitos-que-pais-de-atletas-devem-incentivar', title: '10 Hábitos Que Todo Pai de Atleta Deve Incentivar em Casa' },
    { slug: 'licao-de-cubarsi-para-o-futebol-de-base', title: 'A Lição de Cubarsí Para Quem Sonha com o Futebol de Base' },
    { slug: 'licao-de-lamine-yamal-para-o-futebol-de-base', title: 'A Lição de Lamine Yamal Para Quem Sonha com o Futebol de Base' },
    { slug: 'o-caderno-de-zico-curriculo-esportivo-do-atleta', title: 'O Caderno do Zico: A Lição de Currículo Esportivo que Todo Pai Deveria Aprender' },
    { slug: 'o-que-e-copa-do-brasil-sub-15-como-funciona', title: 'O Que É a Copa do Brasil Sub-15 e Como Funciona' },
    { slug: 'futebol-de-base-feminino-como-funciona', title: 'Futebol de Base Feminino: Como Funciona no Brasil' },
    { slug: 'beneficios-do-futebol-para-criancas', title: 'Benefícios do Futebol Para Crianças e Por Que Vale a Pena' },
    { slug: 'como-escolher-uma-escolinha-de-futebol', title: 'Como Escolher uma Escolinha de Futebol: 7 Pontos Para Avaliar' },
    { slug: 'como-lidar-com-pressao-psicologica-no-futebol-de-base', title: 'Como Lidar com a Pressão Psicológica no Futebol de Base' },
    { slug: 'como-montar-curriculo-esportivo-do-atleta', title: 'Como Montar um Currículo Esportivo para o Seu Filho Atleta' },
    { slug: 'quantos-atletas-de-base-chegam-ao-profissional', title: 'Quantos Atletas de Base Chegam ao Profissional?' },
    { slug: 'o-que-e-peneira-de-futebol-como-se-preparar', title: 'Peneira de Futebol: O Que É e Como se Preparar' },
    { slug: 'o-que-faz-um-olheiro-de-futebol', title: 'O Que Faz um Olheiro de Futebol? Entenda a Profissão' },
    { slug: 'categorias-de-base-do-futebol-sub-7-ao-sub-20', title: 'Categorias de Base do Futebol: O Que Muda do Sub-7 ao Sub-20' },
    { slug: 'escolinha-de-futebol-ou-clube-qual-a-diferenca', title: 'Escolinha de Futebol ou Clube: Qual a Diferença e Onde Matricular Meu Filho?' },
    { slug: 'o-que-e-futebol-de-base', title: 'O que é Futebol de Base? Guia Completo Sobre Categorias, Formação e Histórico do Atleta' }
  ];

  function currentSlug() {
    var match = location.pathname.match(/\/blog\/([^\/]+)\/?/);
    return match ? match[1] : null;
  }

  function cardHtml(article, direction) {
    var label = direction === 'prev' ? '&larr; Artigo anterior' : 'Próximo artigo &rarr;';
    return (
      '<a class="article-nav__item article-nav__item--' + direction + '" href="/blog/' + article.slug + '/">' +
        '<img class="article-nav__image" src="/blog/' + article.slug + '/capa.jpg" alt="Capa: ' + article.title + '" loading="lazy" />' +
        '<div class="article-nav__body">' +
          '<span class="article-nav__label">' + label + '</span>' +
          '<span class="article-nav__title">' + article.title + '</span>' +
        '</div>' +
      '</a>'
    );
  }

  function render() {
    var container = document.getElementById('article-nav');
    if (!container) return;

    var slug = currentSlug();
    var idx = ARTICLES.findIndex(function (a) { return a.slug === slug; });
    if (idx === -1) return;

    // Array em ordem "mais novo primeiro": o vizinho mais novo (posterior)
    // fica no indice anterior, o mais antigo (anterior) no indice seguinte.
    var next = idx > 0 ? ARTICLES[idx - 1] : null;
    var prev = idx < ARTICLES.length - 1 ? ARTICLES[idx + 1] : null;

    var html = '';
    if (prev) html += cardHtml(prev, 'prev');
    if (next) html += cardHtml(next, 'next');
    container.innerHTML = html;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})();
