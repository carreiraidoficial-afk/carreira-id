import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function xmlEscape(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function urlEntry(loc: string, changefreq: string, priority: string, lastmod?: string) {
  return `  <url>\n    <loc>${xmlEscape(loc)}</loc>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''}\n  </url>`;
}

// Artigos estaticos do blog (public/blog/*) -- nao existem em banco, entao
// precisam ser adicionados aqui manualmente sempre que um artigo novo for
// publicado ou tiver o conteudo atualizado.
const BLOG_POSTS: { slug: string; lastmod: string }[] = [
  { slug: 'o-que-e-futebol-de-base', lastmod: '2026-07-17' },
  { slug: 'escolinha-de-futebol-ou-clube-qual-a-diferenca', lastmod: '2026-07-17' },
  { slug: 'categorias-de-base-do-futebol-sub-7-ao-sub-20', lastmod: '2026-07-17' },
  { slug: 'o-que-faz-um-olheiro-de-futebol', lastmod: '2026-07-17' },
  { slug: 'o-que-e-peneira-de-futebol-como-se-preparar', lastmod: '2026-07-17' },
  { slug: 'quantos-atletas-de-base-chegam-ao-profissional', lastmod: '2026-07-17' },
  { slug: 'como-montar-curriculo-esportivo-do-atleta', lastmod: '2026-07-17' },
  { slug: 'como-lidar-com-pressao-psicologica-no-futebol-de-base', lastmod: '2026-07-17' },
  { slug: 'como-escolher-uma-escolinha-de-futebol', lastmod: '2026-07-17' },
  { slug: 'beneficios-do-futebol-para-criancas', lastmod: '2026-07-17' },
  { slug: 'futebol-de-base-feminino-como-funciona', lastmod: '2026-07-17' },
  { slug: 'o-que-e-copa-do-brasil-sub-15-como-funciona', lastmod: '2026-07-18' },
  { slug: 'o-caderno-de-zico-curriculo-esportivo-do-atleta', lastmod: '2026-07-22' },
  { slug: 'licao-de-lamine-yamal-para-o-futebol-de-base', lastmod: '2026-07-21' },
  { slug: 'licao-de-cubarsi-para-o-futebol-de-base', lastmod: '2026-07-19' },
  { slug: '10-habitos-que-pais-de-atletas-devem-incentivar', lastmod: '2026-07-20' },
  { slug: 'pedri-penalti-pai-conexao-pai-filho-no-esporte', lastmod: '2026-07-21' },
  { slug: 'saber-perder-licao-final-copa-do-mundo-2026-para-filhos', lastmod: '2026-07-22' },
  { slug: 'lideranca-o-que-faltou-argentina-final-copa-2026', lastmod: '2026-07-22' },
  { slug: 'mecanismo-de-solidariedade-no-futebol-de-base', lastmod: '2026-07-22' },
  { slug: 'bolsa-atleta-categoria-base-como-funciona', lastmod: '2026-07-24' },
  { slug: 'golpes-falsos-empresarios-futebol-de-base', lastmod: '2026-07-24' },
  { slug: 'crescimento-futebol-estados-unidos', lastmod: '2026-08-08' },
  { slug: 'derrota-preparo-tecnico-pais-futebol-de-base', lastmod: '2026-07-28' },
  { slug: 'eca-digital-alvara-judicial-contas-de-menores-redes-sociais', lastmod: '2026-07-29' },
  { slug: 'nutricao-no-futebol-de-base-o-que-todo-pai-precisa-saber', lastmod: '2026-07-30' },
  { slug: 'como-conseguir-patrocinio-para-atleta-de-base', lastmod: '2026-08-04' },
  { slug: 'como-promover-atleta-redes-sociais-com-seguranca', lastmod: '2026-08-04' },
  { slug: 'educacao-fisica-brasil-x-esporte-escolar-eua', lastmod: '2026-08-05' },
  { slug: 'meu-filho-quer-ser-jogador-de-futebol-por-onde-comecar', lastmod: '2026-08-05' },
  { slug: 'estudos-e-futebol-como-conciliar-os-dois', lastmod: '2026-08-05' },
  { slug: 'analise-swot-para-atletas-de-base-guia-para-pais', lastmod: '2026-08-08' },
  { slug: 'atleta-x-tecnico-voces-enxergam-o-mesmo-jogador', lastmod: '2026-08-11' },
  { slug: 'como-fazer-analise-swot-antes-da-peneira', lastmod: '2026-08-17' },
  { slug: 'efeito-da-idade-relativa-no-futebol-de-base', lastmod: '2026-08-22' },
  { slug: 'tecnicos-que-gritam-e-xingam-nao-e-motivacao-e-medo', lastmod: '2026-08-23' },
  { slug: 'mae-eu-sou-ruim-impacto-emocional-falas-de-tecnicos', lastmod: '2026-08-23' },
  { slug: 'tipos-de-pais-no-futebol-de-base', lastmod: '2026-08-27' },
  { slug: 'pais-presentes-x-pais-ausentes-no-esporte-de-base', lastmod: '2026-08-27' },
  { slug: 'bruxismo-em-vigilia-no-esporte-de-base', lastmod: '2026-08-30' },
  { slug: 'o-que-e-volei-de-base', lastmod: '2026-09-23' },
];

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const hostHeader = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
    const hostParam = url.searchParams.get('host') || '';
    const effectiveHost = hostParam || hostHeader;
    const isAtletaId = effectiveHost.includes('atletaid.com.br');
    const domain = isAtletaId ? 'https://atletaid.com.br' : 'https://carreiraid.com.br';

    const entries: string[] = [];

    if (isAtletaId) {
      entries.push(urlEntry(`${domain}/`, 'weekly', '1.0'));
      entries.push(urlEntry(`${domain}/auth`, 'monthly', '0.5'));
      entries.push(urlEntry(`${domain}/install`, 'monthly', '0.4'));
    } else {
      entries.push(urlEntry(`${domain}/`, 'weekly', '1.0'));
      entries.push(urlEntry(`${domain}/cadastro`, 'monthly', '0.8'));
      entries.push(urlEntry(`${domain}/explorar`, 'daily', '0.9'));
      entries.push(urlEntry(`${domain}/termos-de-uso`, 'yearly', '0.3'));
      entries.push(urlEntry(`${domain}/politica-de-privacidade`, 'yearly', '0.3'));
      entries.push(urlEntry(`${domain}/contato`, 'monthly', '0.5'));

      entries.push(urlEntry(`${domain}/blog/`, 'weekly', '0.8'));
      for (const post of BLOG_POSTS) {
        entries.push(urlEntry(`${domain}/blog/${post.slug}/`, 'monthly', '0.7', post.lastmod));
      }

      const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
      const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

      const { data: atletas } = await supabase
        .from('perfil_atleta')
        .select('slug, updated_at')
        .eq('is_teste', false)
        .neq('is_public', false)
        .not('slug', 'is', null);

      for (const a of atletas || []) {
        const lastmod = a.updated_at ? new Date(a.updated_at).toISOString().split('T')[0] : undefined;
        entries.push(urlEntry(`${domain}/${a.slug}`, 'weekly', '0.7', lastmod));
      }

      const { data: redes } = await supabase
        .from('perfis_rede')
        .select('slug, updated_at')
        .neq('tipo', 'pai_responsavel')
        .not('slug', 'is', null);

      for (const r of redes || []) {
        const lastmod = r.updated_at ? new Date(r.updated_at).toISOString().split('T')[0] : undefined;
        entries.push(urlEntry(`${domain}/${r.slug}`, 'monthly', '0.6', lastmod));
      }
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`;

    return new Response(xml, {
      status: 200,
      headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
    });
  } catch (error) {
    return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`, {
      status: 200,
      headers: { 'Content-Type': 'application/xml; charset=utf-8' },
    });
  }
});
