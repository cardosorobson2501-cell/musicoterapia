/**
 * Service worker do app.
 *
 * Objetivo único: garantir que o app ABRA sem internet. Os dados clínicos não
 * passam por aqui — eles vivem no IndexedDB e sincronizam pelo motor em
 * lib/sync. Por isso nenhuma resposta da API do Supabase é cacheada: cache de
 * dado de paciente no disco do navegador seria risco sem ganho.
 */

const CACHE = 'musicoterapia-shell-v1'

// Mínimo para a primeira abertura offline funcionar.
const PRECACHE = ['/hoje', '/manifest.webmanifest', '/icons/icon-192.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .catch(() => {
        // Sem rede na instalação: segue em frente, o cache se enche no uso.
      })
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Nunca tocar em requisições para o Supabase nem para outros domínios.
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return

  // Navegação: tenta a rede (para pegar versão nova do app) e cai no cache.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(request, copy))
          return res
        })
        .catch(() =>
          caches
            .match(request)
            .then((hit) => hit || caches.match('/hoje'))
            .then(
              (hit) =>
                hit ||
                new Response(
                  '<!doctype html><meta charset="utf-8"><p style="font:16px system-ui;padding:2rem">Sem conexão e o app ainda não foi guardado neste aparelho. Abra uma vez com internet.</p>',
                  { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
                ),
            ),
        ),
    )
    return
  }

  // Assets do build (têm hash no nome, então nunca ficam obsoletos no cache).
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.webmanifest'
  ) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(request, copy))
            return res
          }),
      ),
    )
  }
})
