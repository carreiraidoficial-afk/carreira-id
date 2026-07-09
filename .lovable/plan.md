## Diagnóstico — por que as fotos "carregam toda vez"

Investiguei `useJornada.ts`, `GaleriaJogo.tsx` e o upload no bucket `jornada-midias` e encontrei três causas somadas:

1. **Sem cache entre navegações.** `useJornada` é um `useState`+`useEffect` puro (não usa React Query como o resto do app). Cada vez que a aba Jornada é aberta, o hook desmonta/remonta e refaz TODOS os `SELECT` no Supabase, resetando `data` para vazio. Isso derruba as `<img>` e força o navegador a rebuscar as URLs.
2. **Sem dicas de cache no `<img>`.** As tags `<img>`/`<video>` em `GaleriaJogo.tsx` não têm `loading="lazy"`, `decoding="async"` nem dimensões (`width`/`height`), então o navegador re-decodifica a cada render.
3. **Upload sem compressão.** `uploadArquivo` envia o arquivo original (foto de celular pode ter 3–8 MB). O projeto já tem `src/lib/image-compressor.ts` usado em outros lugares (ex.: `AtividadeExternaPhotoUpload`), mas a Jornada não usa. Fotos grandes fazem cada primeiro carregamento demorar muito.

## O que vou implementar

### 1) Cache real das fotos e dados da Jornada
Migrar `useJornada` para React Query (padrão do app):
- `useQuery(['jornada', criancaId], fetchJornada, { staleTime: 5 min, gcTime: 30 min, refetchOnWindowFocus: false })`.
- Mutations (`criar/atualizar/excluir` campeonato, jogo, mídia) fazem `queryClient.setQueryData` ou `invalidateQueries(['jornada', criancaId])` em vez do `fetchData()` manual.
- Realtime continua, mas dispara `invalidateQueries` (com debounce leve para não invalidar 4x seguidas ao inserir várias mídias).
- Resultado: ao fechar/reabrir a aba, os dados vêm do cache instantaneamente e as `<img>` mantêm o mesmo `src`, então o navegador reutiliza a imagem já decodificada — sem "loading" reaparecendo.

### 2) Dicas de renderização nas mídias
Em `GaleriaJogo.tsx`:
- Adicionar `loading="lazy"` e `decoding="async"` nas `<img>` (thumbs e principal).
- Adicionar `preload="metadata"` nos `<video>`.
- Renderizar a mídia principal com `key={active.id}` estável (já é) e manter os thumbs montados para o browser aproveitar o cache HTTP.

### 3) Compressão no upload (evita o problema na origem)
Em `useJornada.uploadArquivo`:
- Se `file.type.startsWith('image/')`, passar por `compressImage` (já existente em `src/lib/image-compressor.ts`) antes do `supabase.storage.upload`, com limites tipo 1600px / 0.82 de qualidade.
- Vídeos permanecem intocados.

### 4) Tooltips nos botões da barra (Experiência, Estatísticas, Atividades Extras, Jornada Esportiva, Premiações)
Em `CarreiraTimeline.tsx`:
- Envolver cada `<button>` do map em `<Tooltip><TooltipTrigger asChild>…</TooltipTrigger><TooltipContent>{descrição}</TooltipContent></Tooltip>` do `@/components/ui/tooltip` (shadcn, já usado no projeto).
- Adicionar `TooltipProvider` no wrapper (delay ~200 ms).
- Textos curtos, por aba:
  - Experiência — "Clubes, escolinhas e passagens do atleta"
  - Estatísticas — "Números consolidados de jogos, gols e assistências"
  - Atividades Extras — "Treinos e atividades fora do clube"
  - Jornada Esportiva — "Campeonatos e jogos disputados"
  - Premiações — "Títulos e prêmios individuais"
- No mobile (touch, sem hover) os tooltips do shadcn abrem no toque longo; comportamento padrão, sem mudança extra.

## Arquivos que serão alterados
- `src/hooks/useJornada.ts` — migração para React Query + compressão no upload.
- `src/components/jornada/GaleriaJogo.tsx` — atributos de cache/lazy nas mídias.
- `src/components/carreira/CarreiraTimeline.tsx` — tooltips nos botões das abas.

## Fora de escopo
- Não vou criar variantes/thumbnails no servidor (exigiria edge function). A compressão no upload já reduz muito o peso.
- Não vou mexer na UI/estilo dos botões, só adicionar o tooltip.
