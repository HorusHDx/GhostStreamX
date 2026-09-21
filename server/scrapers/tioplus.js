// Api/scrapers/tioplus.js
// Scraper propio de TioPlus (tioplus.app) para películas y series.
//
// Flujo (verificado — sin captcha, sin PoW, sin Cloudflare challenge):
//   1) Buscar en https://tioplus.app/api/search/{título} (HTML con tarjetas
//      <a href=".../pelicula|serie/{slug}"> + <h2>Título (año)</h2>) y
//      quedarnos con la coincidencia mejor puntuada (título + año).
//   2) Película -> la URL del detalle tal cual.
//      Serie    -> {detalle}/season/{n}/episode/{m}
//   3) Extraer los tokens `data-server="..."` de la página (solo están en la
//      página del episodio para series; 4-5 por página).
//   4) Cada token se resuelve pidiendo
//        https://tioplus.app/player/{btoa(token)}   (con referer = página)
//      que devuelve una página con:
//        window.location.href = 'https://hostreal/...'
//      (VidHide, Waaw, VuDeo, EmTurboVid, PelisPlus/upns...)
//
// Devuelve un array de sources { name, label, provider, language, kind, url }
// filtrando con la lista blanca de hosts. Vacío si no encontró el título.

import { cached } from '../cache.js'
import { isAllowed, hostName } from '../hosts.js'
import { scrapeFetch } from '../scrapeFetch.js'
import { normalize } from './pelisplus.js'

const BASE = 'https://tioplus.app'
const TIMEOUT = 16000

async function fetchText(url, referer = `${BASE}/`) {
  return scrapeFetch(url, referer, TIMEOUT)
}

// Busca la URL de detalle (pelicula|serie) en /api/search/{q}.
// Devuelve la URL absoluta o null.
async function findDetailUrl(title, year, type) {
  if (!title) return null
  const html = await fetchText(`${BASE}/api/search/${encodeURIComponent(title)}`, `${BASE}/`)
  if (!html) return null

  const want = type === 'movie' ? 'pelicula' : 'serie'
  const tNorm = normalize(title)
  const y = year ? String(year) : ''

  const candidates = []
  for (const m of html.matchAll(
    /<a[^>]+href="(https?:\/\/tioplus\.app\/(?:pelicula|serie)\/[^"]+)"[\s\S]*?<\/a>/g
  )) {
    const href = m[1]
    if (!href.includes(`/${want}/`)) continue
    const h2 = m[0].match(/<h2>(.*?)<\/h2>/)
    const raw = h2 ? h2[1].replace(/<[^>]+>/g, '').trim() : ''
    const ySite = (raw.match(/\((\d{4})\)/) || [])[1] || ''
    const tSite = raw.replace(/\s*\(\d{4}\)\s*$/, '').trim()

    let score = 0
    const cNorm = normalize(tSite)
    if (cNorm && cNorm === tNorm) score += 100
    else if (cNorm && (cNorm.includes(tNorm) || tNorm.includes(cNorm))) score += 60
    else score -= 20
    if (y && ySite === y) score += 30
    else if (y && ySite && ySite !== y) score -= 15
    if (score > 0) candidates.push({ url: href, score })
  }
  candidates.sort((a, b) => b.score - a.score)
  return candidates[0]?.url || null
}

// Resuelve un token `data-server` -> URL final del hoster.
async function resolvePlayer(token, pageUrl) {
  const b64 = Buffer.from(token, 'utf8').toString('base64')
  const html = await fetchText(`${BASE}/player/${encodeURIComponent(b64)}`, pageUrl)
  if (!html) return null
  const m = html.match(/window\.location\.href\s*=\s*['"]([^'"]+)['"]/)
  return m ? m[1] : null
}

// Punto de entrada principal.
export async function resolveTioPlus({ type, tmdbId, title, originalTitle, year, season = 1, episode = 1 }) {
  const cacheKey = `tp:${type}:${String(tmdbId)}:${type === 'tv' ? `${season}/${episode}` : ''}`
  return cached(cacheKey, 15 * 60 * 1000, async () => {
    // Prueba el título en español primero y el original después.
    for (const candidate of [title, originalTitle]) {
      if (!candidate) continue
      const detailUrl = await findDetailUrl(candidate, year, type)
      if (!detailUrl) continue
      const pageUrl =
        type === 'movie' ? detailUrl : `${detailUrl}/season/${season}/episode/${episode}`
      const html = await fetchText(pageUrl, detailUrl)
      if (!html) continue

      const tokens = [
        ...new Set([...html.matchAll(/data-server="([^"]+)"/g)].map((m) => m[1])),
      ]
      if (tokens.length === 0) continue

      const resolved = await Promise.allSettled(
        tokens.map(async (tok) => {
          const u = await resolvePlayer(tok, pageUrl)
          return u && isAllowed(u) ? u : null
        })
      )
      const urls = [
        ...new Set(
          resolved
            .filter((r) => r.status === 'fulfilled' && r.value)
            .map((r) => r.value)
        ),
      ]
      if (urls.length === 0) continue

      // Nombres únicos por host: VidHide, VidHide 2, ...
      const count = {}
      return urls.map((u) => {
        const h = hostName(u)
        count[h] = (count[h] || 0) + 1
        const name = count[h] > 1 ? `${h} ${count[h]}` : h
        return {
          name,
          label: `TioPlus · ${name}`,
          provider: 'TioPlus',
          language: null,
          kind: u.includes('.m3u8') ? 'direct' : 'embed',
          url: u,
        }
      })
    }
    return []
  })
}