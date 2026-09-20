// GhostStreamX — scrape proxy Worker
// =====================================================================
// Desplegar en Cloudflare Workers (plan Free alcanza).
//
// Uso (lo llama SOLO nuestro backend de Vercel):
//   GET https://TU-WORKER.workers.dev/fetch?url=<url-encoded>&token=<secreto>[&ref=<referer-encoded>]
//
// Qué hace:
//   1) Valida el token (las llamadas sin token se rechazan).
//   2) Trae la página destino usando la red de Cloudflare (IPs difíciles
//      de bloquear: pelisplushd.bz / embed69.org / poseidonhd2.co).
//   3) Cachea la respuesta 15 min en el edge (Cache API de Cloudflare).
//
// Para cambiar el token: seteá la variable SCRAPE_TOKEN en el dashboard
// de tu Worker (Settings > Variables), o editá TOKEN_FALLBACK abajo.
// El MISMO valor debe ir en Vercel como SCRAPER_PROXY_TOKEN.
// =====================================================================

const TOKEN_FALLBACK = 'ghoststreamx-scrape-2026' // ← cambiá esto o usá SCRAPE_TOKEN
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
const CACHE_TTL = 900 // 15 minutos

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const path = url.pathname

    // Landing simple en la raíz (opcional)
    if (path === '/' || path === '') {
      return new Response('GhostStreamX scrape proxy — solo uso interno', {
        status: 200,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      })
    }

    if (path !== '/fetch') {
      return new Response('Not found', { status: 404 })
    }
    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405 })
    }

    const target = url.searchParams.get('url')
    const token = url.searchParams.get('token')
    const referer = url.searchParams.get('ref') || target

    if (!target) return new Response('Missing "url" param', { status: 400 })

    const expected = env.SCRAPE_TOKEN || TOKEN_FALLBACK
    if (!token || token !== expected) {
      return new Response('Unauthorized', { status: 401 })
    }

    let targetUrl
    try {
      targetUrl = new URL(target)
      if (!['http:', 'https:'].includes(targetUrl.protocol)) throw new Error('bad proto')
    } catch {
      return new Response('Invalid "url"', { status: 400 })
    }

    // ---- Cache edge: clave = URL de DESTINO (no el wrapper) ----
    const cacheKey = new Request(targetUrl.toString(), { method: 'GET' })
    try {
      const cache = caches.default
      const hit = await cache.match(cacheKey)
      if (hit) return hit
    } catch { /* cache no disponible: seguimos sin cachear */ }

    // ---- Fetch origen por la red de Cloudflare ----
    let upstream
    try {
      upstream = await fetch(targetUrl.toString(), {
        headers: {
          'user-agent': UA,
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'accept-language': 'es-AR,es;q=0.9,en;q=0.8',
          referer,
        },
        redirect: 'follow',
      })
    } catch {
      return new Response('Upstream fetch failed', { status: 502 })
    }

    const text = await upstream.text()
    const contentType =
      upstream.headers.get('content-type') || 'text/html; charset=utf-8'

    const response = new Response(text, {
      status: 200,
      headers: {
        'content-type': contentType,
        'cache-control': `public, max-age=${CACHE_TTL}`,
      },
    })

    try {
      ctx.waitUntil(caches.default.put(cacheKey, response.clone()))
    } catch { /* ignore */ }

    return response
  },
}