// Service worker mínimo. O único objetivo dele é satisfazer o
// requisito técnico do Chrome/Android pra considerar o site um
// "app instalável de verdade" (com botão de instalar automático,
// não só o "adicionar à tela inicial" manual do menu).
//
// Não faz cache agressivo de nada -- sempre busca a versão mais
// nova da rede primeiro, e só usa o cache se a rede falhar (modo
// offline). Isso evita o problema clássico de PWA "preso" numa
// versão antiga depois de eu publicar uma atualização.

const CACHE = 'mercado-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((resposta) => {
        const copia = resposta.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copia));
        return resposta;
      })
      .catch(() => caches.match(event.request))
  );
});
