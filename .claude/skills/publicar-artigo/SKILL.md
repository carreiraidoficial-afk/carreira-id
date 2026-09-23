---
name: publicar-artigo
description: Publica um artigo novo no blog estático do Carreira ID (public/blog/{slug}/index.html). Use sempre que o usuário colar o texto de um artigo (título, meta description, slug, palavras-chave, corpo, FAQ) pedindo pra publicar no blog, mencionar "mais um artigo", "a capa está na pasta habitual", ou invocar via /publicar-artigo. Cobre localizar a capa em Downloads, escrever o HTML seguindo o padrão do artigo mais recente, registrar no índice do blog, e atualizar o sitemap. Evita o erro de tentar validar via `npm run dev` (esse blog é HTML estático fora do roteador do app React).
---

# Publicar artigo no blog do Carreira ID

O blog não é parte do app React/SPA — é HTML estático hospedado em
`public/blog/{slug}/`. Cada artigo é um `index.html` autocontido, sem build
step, sem markdown. Esse é o fato mais importante a lembrar: nada aqui passa
pelo Vite/React, então as ferramentas de dev do app principal não servem pra
validar isso (ver Etapa 8).

O usuário geralmente entrega o artigo como texto colado, às vezes com um
comentário HTML no topo contendo instruções especiais (que dados verificar,
quais links externos adicionar, sugestões de v2 pra ignorar por ora). Leia
esse comentário com atenção antes de escrever qualquer coisa — ele costuma
conter a fonte dos números que aparecem no corpo do artigo.

## Etapa 1 — Extrair o conteúdo do texto colado

Do texto do usuário, identifique: meta title, meta description, slug,
palavra-chave principal, palavras-chave secundárias, título H1 (pode ser
diferente do meta title — ver Etapa 5), corpo do artigo, e as perguntas
frequentes (pergunta + resposta). Separe também qualquer instrução especial
do comentário HTML de topo, se houver.

## Etapa 2 — Achar a capa em Downloads (não no repositório)

A imagem de capa não fica em nenhuma pasta do projeto — o usuário salva no
Downloads do Windows (`C:\Users\Home\Downloads\`). Procure pelo arquivo mais
recente cujo nome ou data combine com o tema do artigo.

Cuidado: costuma haver **dois arquivos parecidos** — um "cru"/maior gerado
por IA e outro já recortado (geralmente nomeado tipo `Untitled design
(N).png`, padrão Canva). O certo é sempre o que já está na proporção **3:2
exata** (ex.: 1536×1024), nunca o maior — a página usa `aspect-ratio: 3/2`
tanto no card quanto no topo do artigo, e a proporção errada faz o navegador
cortar a imagem de um jeito que pode remover texto perto das bordas.
Confirme as dimensões de verdade antes de escolher — não confie só no nome
do arquivo. No Windows isso é rápido via PowerShell:

```powershell
Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile("C:\Users\Home\Downloads\NOME.png")
"$($img.Width) x $($img.Height)"
$img.Dispose()
```

## Etapa 3 — Ler o artigo publicado mais recente como referência

Antes de escrever qualquer HTML, olhe qual pasta em `public/blog/` foi
modificada por último (não confie numa lista fixa de exemplo — o padrão
evolui). Leia o `index.html` inteiro dela. É a partir desse arquivo real,
não de um exemplo congelado, que você copia a estrutura exata: alguma
convenção pode ter mudado desde a última vez (por exemplo, o `<title>` já
foi encurtado numa sessão anterior pra caber no limite do Google, ficando
mais curto que o H1 — reproduza o padrão atual, não um "modelo ideal"
antigo).

## Etapa 4 — Criar a pasta e a capa

```bash
mkdir -p "public/blog/{slug}"
```

Copie a imagem escolhida na Etapa 2 pra dentro como `capa.jpg` — mas
**converta de verdade pra JPEG**, não apenas renomeie a extensão (isso deixa
o arquivo maior que precisa e alguns navegadores/crawlers reclamam do
mimetype divergindo da extensão). No Windows, com qualidade ~85:

```powershell
Add-Type -AssemblyName System.Drawing
$src = "C:\Users\Home\Downloads\ARQUIVO.png"
$dst = "public\blog\{slug}\capa.jpg"
$img = [System.Drawing.Image]::FromFile($src)
$encoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$encParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
$encParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [int64]85)
$img.Save($dst, $encoder, $encParams)
$img.Dispose()
```

Antes de escrever o `alt` da imagem no HTML, **leia a imagem de verdade**
(a ferramenta Read consegue abrir imagens) pra descrever o que realmente
aparece nela — não invente a partir só do título do artigo.

## Etapa 5 — Escrever o index.html

Copie a estrutura do artigo de referência (Etapa 3) e preencha com o
conteúdo novo. As partes que quase nunca mudam entre artigos (copie
literalmente, não reescreva):

- Bloco de GTM/GA4/Meta Pixel no `<head>` — os IDs são fixos do site inteiro.
- Header do blog, footer, os dois `share-bar` (topo e rodapé), o bloco
  `article-author` (assinatura do autor).

As partes que mudam por artigo:

- `<title>` — mantenha curto (o limite prático do Google já forçou a
  encurtar títulos longos antes); se o "meta title" que o usuário deu for
  longo, use uma versão reduzida aqui e guarde a versão completa pro H1.
- Meta description, keywords, canonical, Open Graph, Twitter Card — todos
  apontando pra `https://carreiraid.com.br/blog/{slug}/`.
- Três blocos `application/ld+json`: `Article`, `FAQPage` (espelhando
  exatamente as perguntas/respostas visíveis no corpo) e `BreadcrumbList`
  (o terceiro item leva um rótulo curto, não o H1 inteiro).
- Breadcrumb visível (`<nav class="breadcrumb">`) com o mesmo rótulo curto.
- `article-header`: categoria (hoje só existe "Futebol de Base"/`futebol`,
  ver Etapa 6), H1, data de publicação e uma estimativa de minutos de
  leitura.
- Corpo em `article-prose`: `h2`/`p`/`ul`/`ol`. Links internos usam URL
  absoluta (`https://carreiraid.com.br/blog/outro-slug/`) — **confira que
  cada slug citado existe de verdade** listando as pastas em `public/blog/`,
  não confie cegamente nos links que vieram no rascunho do usuário, porque
  slugs reais às vezes diferem do que a IA que escreveu o rascunho assumiu.
  Links externos citados nas instruções especiais (Etapa 1) levam
  `target="_blank" rel="noopener"`.
- Dois blocos `article-cta` (mesmo botão/copy em ambos, ou levemente
  variados): um no meio do artigo, logo antes de "Perguntas frequentes", e
  outro no fim, depois da assinatura do autor.
- Seção "Perguntas frequentes" com `h3` (pergunta) + `p` (resposta) pra cada
  item do FAQ, na mesma ordem do schema `FAQPage`.
- Parágrafo de fechamento antes do último CTA.

## Etapa 6 — Registrar no índice do blog (`public/blog/index.html`)

Insira um novo `.blog-card` **no topo** da grade (artigos mais recentes
aparecem primeiro) com a mesma categoria dos demais. Hoje só existe uma
categoria em uso (`data-cat="futebol"`, rótulo visível "Futebol de Base") —
se o artigo for de outro tema, isso exigiria criar um novo botão de filtro
também, o que é uma mudança maior; não faça isso sem confirmar com o
usuário primeiro.

Depois de inserir o card, conte quantos `.blog-card` existem de verdade e
atualize os dois badges `blog-filter-count` pro número certo. Um grep
ingênuo por `blog-card` conta demais (pega `blog-card__image`,
`blog-card__title` etc. também) — conte pelo container:

```bash
grep -cE '<div class="blog-card( blog-card--has-podcast)?"' public/blog/index.html
```

## Etapa 7 — Atualizar o sitemap

O sitemap não é estático — é gerado pela Supabase Edge Function
`generate-sitemap` (projeto `fppsotlycinwqsjpoybg`), que mantém um array
`BLOG_POSTS` hardcoded com todos os slugs do blog (os artigos são estáticos,
não existem em banco, então isso não é automático). Busque o código atual
da function (`get_edge_function`), adicione `{ slug: '{slug}', lastmod:
'AAAA-MM-DD' }` (data de hoje) no array, e faça o deploy imediatamente
(`deploy_edge_function`, mantendo `verify_jwt: false` como já está
configurado). Isso já fica no ar na hora — não depende do deploy do site.

## Etapa 7.5 — Avisar o Bing via IndexNow

O Bing (e o Yandex) aceitam um "ping" direto quando uma URL nova ou
atualizada entra no ar, em vez de esperar o crawler passar sozinho —
costuma reduzir o tempo de indexação de dias/semanas pra minutos/horas. A
chave de verificação já está publicada em
`public/b950db12958e960754ebbd16a53ae60e.txt` (arquivo com a própria chave
como conteúdo, acessível em `https://carreiraid.com.br/b950db1...e60e.txt`
— funciona também em `atletaid.com.br` porque é o mesmo deploy).

Depois que o deploy do artigo estiver no ar (não antes — o IndexNow espera
a URL já responder 200), envie um GET simples:

```bash
curl "https://api.indexnow.org/indexnow?url=https://carreiraid.com.br/blog/{slug}/&key=b950db12958e960754ebbd16a53ae60e&keyLocation=https://carreiraid.com.br/b950db12958e960754ebbd16a53ae60e.txt"
```

Resposta esperada: `200` ou `202` sem corpo. Não é bloqueante — se falhar,
o Bing ainda vai descobrir a página pelo sitemap/crawl normal, só mais
devagar; avise o usuário e siga em frente.

## Etapa 7.6 — Avisar o Make (publicação automática no Facebook)

Existe uma automação no Make que publica o artigo na Página do Facebook.
Ela é disparada pela edge function `notify-blog-post-published`, que repassa
os dados pro webhook do Make autenticado por API key (cabeçalho
`x-make-apikey`) -- endereço e chave ficam só nos secrets
`MAKE_FACEBOOK_WEBHOOK_URL` e `MAKE_FACEBOOK_WEBHOOK_APIKEY` do Supabase,
nunca no código, porque este repositório é público. Depois do deploy do
artigo estar no ar:

**Importante (Windows/Git Bash): nunca use `curl -d '{...}'` com o JSON
inline quando title/excerpt tiverem acento.** O Windows retranscreve
argumentos de linha de comando pra uma code page antiga antes do curl.exe
receber, corrompendo qualquer acento (silenciosamente -- sem erro, só o
texto errado do outro lado). Escreva o JSON num arquivo primeiro (via Write)
e use `-d @arquivo`, que lê os bytes direto do disco sem passar pelo argv:

```bash
curl -s -X POST "https://fppsotlycinwqsjpoybg.supabase.co/functions/v1/notify-blog-post-published" \
  -H "Content-Type: application/json" \
  -d @/caminho/do/scratchpad/notify-payload.json
```

onde `notify-payload.json` tem exatamente:
```json
{
  "title": "TÍTULO DO ARTIGO",
  "url": "https://carreiraid.com.br/blog/{slug}/",
  "image": "https://carreiraid.com.br/blog/{slug}/capa.jpg",
  "excerpt": "A meta description do artigo, curta"
}
```

Resposta esperada: `{"success":true}`. Se vier
`{"success":false,"error":"MAKE_FACEBOOK_WEBHOOK_URL ou MAKE_FACEBOOK_WEBHOOK_APIKEY não configurada"}`,
é porque os secrets ainda não foram configurados -- não é erro seu, apenas
avise e siga em frente (não bloqueia a publicação). Se vier qualquer outro
erro, também não é bloqueante: avise o usuário e continue.

## Etapa 8 — Verificar (sem `npm run dev`)

**Não tente abrir o artigo pelo servidor de dev do Vite** (`npm run dev` /
preview do app). Esse blog é servido fora do roteador do React, e o
servidor de dev reescreve qualquer rota desconhecida de volta pro SPA — uma
página em branco ou com o título errado ali **não significa que o artigo
está quebrado**, só significa que essa ferramenta não serve pra esse tipo
de arquivo. (Isso já causou um desvio de tempo real numa sessão anterior.)

Pra verificar, prefira:

- Checagem estrutural leve: confirme que existe exatamente 1 `<h1>`, 2
  ocorrências de `article-cta`, 3 blocos `application/ld+json`, e que
  `capa.jpg` existe na pasta.
- Se quiser ver visualmente, abra o arquivo direto pelo protocolo `file://`
  no navegador (não precisa de nenhum servidor rodando).

Não é necessário rodar `tsc`/`npm run build` pra esse fluxo — nada em
TypeScript foi tocado, é tudo HTML estático.

## Etapa 9 — Commit

Pergunte ao usuário antes de commitar/subir. Quando ele confirmar, dê stage
exatamente nos caminhos certos — a pasta nova do artigo e o
`public/blog/index.html` — nunca `git add -A` (o repositório pode ter outras
mudanças não relacionadas em andamento).
