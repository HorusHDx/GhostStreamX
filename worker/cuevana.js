// GhostStreamX — Worker dedicado para franquear scraping de cuevana3.gs
// =====================================================================
// Por qué un worker APARTE (y no solo el genérico work-pelisplus):
//   1) Anti-ban: cuevana3.gs solo ve IPs de Cloudflare, nunca la de Vercel.
//   2) Allow-list estricta: SOLO proxea *.cuevana3.gs. Si el token se filtra,
//      no puede usarse como proxy abierto hacia cualquier web.
//   3) Caché edge por tipo de ruta (JSON de API 60 min, player.php 15 min)
//      => menos pedidos al origen, menos chance de rate-limit.
//
// Uso (lo llama SOLO nuestro backend de Vercel):
//   GET https://work-cuevana.TU.workers.dev/fetch?url=<url-encoded>&token=<secreto>[&ref=<referer-encoded>]
//
// Desplegar (desde la carpeta worker/):
//   npx wrangler login
//   npx wrangler deploy -c wrangler-cuevana.toml
//
// Token: está en [vars] de wrangler-cuevana.toml; el MISMO valor debe ir en
// Vercel como CUEVANA_PROXY_TOKEN (y la URL del worker como CUEVANA_PROXY_URL).

const TOKEN_FALLBACK = 'gsx-cuevana-2026-7h2p'
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

// Únicos destinos que este worker franquea (hostname exacto o subdominio).
const ALLOWED_HOSTS = ['cuevana3.gs']

// TTLs de caché edge por tipo de ruta (segundos).
const TTL = {
  json: 3600, // /wp-api/v1/* (search, player, episodes) — cambia poco
  player: 900, // player.php?t=... (token del embed) — 15 min
  default: 900,
}

function isAllowedTarget(target) {
  try {
    const u = new URL(target)
    if (!['http:', 'https:'].includes(u.protocol)) return false
    const host = u.hostname.toLowerCase()
    return ALLOWED_HOSTS.some((s) => host === s || host.endsWith(`.${s}`))
  } catch {
    return false
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)

    if (url.pathname === '/' || url.pathname === '') {
      return new Response('GhostStreamX cuevana proxy — solo uso interno', {
        status: 200,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      })
    }
    if (url.pathname !== '/fetch') return new Response('Not found', { status: 404 })
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 })

    const target = url.searchParams.get('url')
    const token = url.searchParams.get('token')
    const referer = url.searchParams.get('ref') || target
    if (!target) return new Response('Missing "url" param', { status: 400 })

    const expected = env.SCRAPE_TOKEN || TOKEN_FALLBACK
    if (!token || token !== expected) {
      return new Response('Unauthorized', { status: 401 })
    }
    if (!isAllowedTarget(target)) {
      return new Response('Target not allowed', { status: 403 })
    }

    const targetUrl = new URL(target)

    // ---- Caché edge: clave = URL de DESTINO (no el wrapper) ----
    const cacheKey = new Request(targetUrl.toString(), { method: 'GET' })
    try {
      const cache = caches.default
      const hit = await cache.match(cacheKey)
      if (hit) return hit
    } catch {
      // Sin caché disponible (local/edge): seguimos sin cachear.
    }

    // ---- Fetch origen por la red de Cloudflare ----
    let upstream
    try {
      const isApi = targetUrl.pathname.startsWith('/wp-api/')
      upstream = await fetch(targetUrl.toString(), {
        headers: {
          'user-agent': UA,
          accept: isApi
            ? 'application/json, text/plain, */*'
            : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'accept-language': 'es-AR,es;q=0.9,en;q=0.8',
          referer,
        },
        redirect: 'follow',
      })
    } catch {
      return new Response('Upstream fetch failed', { status: 502 })
    }

    const text = await upstream.text()
    const contentType = upstream.headers.get('content-type') || 'text/html; charset=utf-8'

    let ttl = TTL.default
    if (targetUrl.pathname.startsWith('/wp-api/')) ttl = TTL.json
    else if (targetUrl.pathname.startsWith('/player')) ttl = TTL.player

    const response = new Response(text, {
      status: 200,
      headers: {
        'content-type': contentType,
        'cache-control': `public, max-age=${ttl}`,
      },
    })

    try {
      ctx.waitUntil(caches.default.put(cacheKey, response.clone()))
    } catch {
      // ignore
    }

    return response
  },
}