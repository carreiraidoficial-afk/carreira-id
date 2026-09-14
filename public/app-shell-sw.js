// Service worker minimo, so pra deixar o app ABRIR quando nao ha rede
// nenhuma (ex: PWA instalado, aberto sem sinal). NAO cacheia dados da API
// (Supabase) -- isso ja e resolvido pelo React Query persistido em
// localStorage, em App.tsx. Aqui so cuida do shell estatico: HTML, JS, CSS,
// fontes.
//
// Estrategia deliberadamente simples (sem Workbox) pra evitar o tipo de
// cache "preso" que quebrou o site antes (ver public/service-worker.js):
// - Navegacao (HTML): network-first. Sempre busca a versao mais nova
//   quando ha rede; so cai pro cache se a rede falhar de verdade. Assim o
//   app nunca fica travado numa versao antiga depois de um deploy novo.
// - Assets com hash no nome (JS/CSS/fontes do build): cache-first. Seguro
//   porque o hash muda a cada build -- um arquivo com esse nome nunca
//   muda de conteudo.
// - Bump CACHE_NAME so quando mudar a logica deste arquivo; o activate
//   apaga qualquer cache de uma versao anterior.

const CACHE_NAME = 'carreira-shell-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  if (/\.(js|css|woff2?)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
  }
});

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (e) {
    const cached = await caches.match(request);
    return cached || caches.match('/');
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }
  return response;
}
