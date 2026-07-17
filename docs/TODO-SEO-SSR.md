# TODO: Renderização dinâmica para SEO (SSR/Prerendering)

**Status:** Pendente — decisão tomada em 2026-07-17 de adiar para depois de
validar o mercado brasileiro com o produto atual.

## O problema

O Carreira ID é uma SPA React sem SSR. O HTML bruto entregue pelo servidor
tem `<div id="root">` praticamente vazio — todo o conteúdo (H1, textos,
links internos) só existe depois que o JavaScript executa no navegador.

Confirmado em 2026-07-17 pelo Bing Webmaster Tools, que reportou "marca H1
ausente" na home. Verificação direta (`curl` com User-Agent do Bingbot, sem
executar JS) confirmou: body bruto = 29 caracteres, nenhum `<h1>`, e o
`<title>` bruto ("...Identidade Esportiva Digital para Atletas de Base")
difere do title real pós-JS ("...Rede Social do Futebol de Base | Perfil do
Atleta", setado pelo hook `useSEO`).

## O que já existe (mitigações parciais, não resolvem a causa raiz)

- `src/hooks/useSEO.ts`: ajusta title/description/canonical/OG via JS depois
  que a página carrega. Funciona para humanos e para o Google (que executa
  JS, embora de forma mais lenta/não garantida). Não resolve para quem lê o
  HTML puro.
- `supabase/functions/og-profile`: serve meta tags prontas (sem JS) só para
  bots que NÃO executam JS (Facebook, WhatsApp, Twitter, etc.), via rewrite
  no `vercel.json` baseado em User-Agent. Deliberadamente **não** inclui
  Googlebot/Bingbot nessa regra, porque essa função só devolve uma página
  bem mais enxuta (só meta tags) que a real — incluir bots de busca ali
  seria cloaking de verdade.
- `index.html` (commit `db9bdbe`, 2026-07-17): H1 estático da home, com o
  texto real da Hero section, dentro do `<div id="root">`. Como
  `src/main.tsx` usa `createRoot` (não `hydrateRoot`), o React substitui
  esse conteúdo normalmente ao montar — sem risco de mismatch, verificado
  sem erros no console e sem H1 duplicado. **Só cobre a home ("/")**, já
  que o `index.html` é compartilhado por todas as rotas da SPA (cadastro,
  explorar, perfis, etc. continuam com o mesmo problema).

## Solução completa (adiada por decisão do Bill em 2026-07-17)

**Renderização dinâmica (dynamic rendering):** um serviço de
pré-renderização (ex: Prerender.io, ou self-hosted com Puppeteer/
Rendertron) que gera o HTML completo e real da página (não só meta tags)
especificamente para bots de busca, mantendo humanos na experiência React
normal via client-side rendering. Diferente do `og-profile`, isso NÃO é
cloaking, porque o conteúdo servido ao bot é equivalente ao que o humano vê
— é a técnica que o próprio Google recomendou oficialmente por anos para
esse cenário exato de SPA sem SSR.

Alternativa mais radical (não recomendada como primeiro passo): migrar a
aplicação inteira para Next.js (SSR/SSG nativo). Reescrita completa,
semanas de trabalho, risco real de regressão num produto pago já no ar.

## Próximo passo, quando for retomado

1. Escolher entre Prerender.io (serviço pago, zero manutenção) ou
   self-hosted (Puppeteer/Rendertron rodando em algum lugar — talvez o
   mesmo VPS que está sendo preparado para outros projetos, ver
   `D:\Claude\Infraestrutura VPS\PLANO-MIGRACAO.md`).
2. Adicionar rewrite no `vercel.json` (mesmo padrão já usado para
   `og-profile`) detectando Googlebot/Bingbot/etc. via User-Agent e
   roteando para o serviço de prerendering em vez do `index.html` normal.
3. Validar que o conteúdo prerenderizado é de fato equivalente ao
   client-rendered (sem diferenças de texto/links) antes de ativar em
   produção, para não correr risco de penalização por cloaking.
