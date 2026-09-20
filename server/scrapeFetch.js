// server/scrapeFetch.js
// Fetch compartido para los scrapers (pelisplus, poseidon).
//
// Si SCRAPER_PROXY_URL está configurado (env de Vercel), las peticiones
// pasan por nuestro Cloudflare Worker proxy:
//   Vercel -> Worker (Cloudflare) -> pelisplushd.bz / embed69 / poseidon
// Esto evita bloqueos de IP contra Vercel y suma caché edge.
//
// Si el Worker falla o no está configurado, cae al fetch directo actual.
//
// Env:
//   SCRAPER_PROXY_URL   = https://tu-worker.workers.dev  (vacío = directo)
//   SCRAPER_PROXY_TOKEN = el MISMO secreto del Worker (SCRAPE_TOKEN)

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

const PROXY_URL = (process.env.SCRAPER_PROXY_URL || '').replace(/\/+$/, '')
const PROXY_TOKEN = process.env.SCRAPER_PROXY_TOKEN || ''

/**
 * Trae el texto de una página de scraping.
 * @param {string} url URL destino (pelisplushd, index de peli, player.php...)
 * @param {string} referer Referer esperado por el sitio.
 * @param {number} timeoutMs Timeout de la petición directa.
 * @returns {Promise<string>} HTML o '' si falló.
 */
export async function scrapeFetch(url, referer = '', timeoutMs = 16000) {
  // 1) Intento por el Worker proxy si está configurado.
  if (PROXY_URL && PROXY_TOKEN) {
    try {
      const proxyUrl = new URL(`${PROXY_URL}/fetch`)
      proxyUrl.searchParams.set('url', url)
      proxyUrl.searchParams.set('token', PROXY_TOKEN)
      if (referer) proxyUrl.searchParams.set('ref', referer)

      const res = await fetch(proxyUrl, {
        signal: AbortSignal.timeout(timeoutMs + 8000),
      })
      if (res.ok) return await res.text()
    } catch {
      // Caemos al fetch directo
    }
  }

  // 2) Fallback: fetch directo (comportamiento original).
  try {
    const res = await fetch(url, {
      headers: {
        'user-agent': UA,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        referer: referer || url,
      },
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) return ''
    return await res.text()
  } catch {
    return ''
  }
}