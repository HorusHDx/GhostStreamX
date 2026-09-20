// Api/scrapers/pelisplus.js
// Scraper propio de PelisPlusHD (pelisplushd.bz) para películas y series.
//
// Flujo:
//   1) Buscar en https://pelisplushd.bz/search?s={título} y quedarnos con el
//      slug de la tarjeta "Posters-link" correcta (movies|series) y cuyo
//      título/año matchean con TMDB.
//   2) Película -> https://pelisplushd.bz/pelicula/{slug}
//      Serie    -> https://pelisplushd.bz/serie/{slug}/temporada/{n}/capitulo/{m}
//   3) Extraer los servidores del script:
//        var video = []; video[1] = 'https://...'; video[2] = 'https://...'
//      (y como respaldo, cualquier <iframe src="..."> de la página).
//
// Devuelve un array de sources { name, label, provider, language, kind, url }
// filtrando con la lista blanca de hosts. Vacío si no encontró el título.

import { cached } from '../cache.js'
import { isAllowed } from '../hosts.js'

const BASE = 'https://pelisplushd.bz'
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
const TIMEOUT = 16000

async function fetchText(url, referer = `${BASE}/`) {
  try {
    const res = await fetch(url, {
      headers: {
        'user-agent': UA,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        referer,
      },
      signal: AbortSignal.timeout(TIMEOUT),
    })
    if (!res.ok) return ''
    return await res.text()
  } catch {
    return ''
  }
}

export function normalize(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

// Busca el mejor slug en /search?s= para el tipo pedido.
// Devuelve la URL absoluta del detalle o null.
async function findSlug(title, year, type) {
  if (!title) return null
  const route = type === 'movie' ? 'pelicula' : 'serie'
  const cls = type === 'movie' ? 'movies' : 'series'
  const html = await fetchText(`${BASE}/search?s=${encodeURIComponent(title)}`)
  if (!html) return null

  // Tarjetas: <a href=".../pelicula|serie/{slug}" class="Posters-link movies|series" data-title="VER ... (año) Online Gratis HD">
  const re = new RegExp(
    `<a[^>]+href="([^"]*\\/${route}\\/[^"]+)"[^>]*class="[^"]*Posters-link[^"]*\\b${cls}\\b[^"]*"[^>]*data-title="([^"]*)"`,
    'g'
  )
  const candidates = []
  let m
  while ((m = re.exec(html))) {
    const raw = m[2]
    const parsed = raw.match(/^VER\s*(.+?)\s*\((\d{4})\)\s*Online\s*Gratis\s*HD\s*$/i)
    candidates.push({
      url: m[1],
      title: parsed ? parsed[1].trim() : raw.replace(/^VER\s+/i, '').replace(/\s*Online\s*Gratis\s*HD\s*$/i, '').trim(),
      year: parsed ? parsed[2] : '',
    })
  }
  if (candidates.length === 0) return null

  const tNorm = normalize(title)
  const y = year ? String(year) : ''
  const best = candidates
    .map((c) => {
      let score = 0
      const cNorm = normalize(c.title)
      if (cNorm === tNorm) score += 100
      else if (cNorm && (cNorm.includes(tNorm) || tNorm.includes(cNorm))) score += 60
      else score -= 20
      if (y && c.year === y) score += 30
      else if (y && c.year && c.year !== y) score -= 15
      return { ...c, score }
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)

  const url = best[0]?.url
  if (!url) return null
  return url.startsWith('http') ? url : `${BASE}${url}`
}

// Extrae URLs de servidores de la página de detalle.
// 1) video[N] = '...' en el script
// 2) iframes de la página
// 3) atributos data-video/data-src/data-url
function extractUrls(html) {
  const urls = []
  for (const m of html.matchAll(/video\s*\[\s*\d+\s*\]\s*=\s*['"]([^'"]+)['"]/g)) urls.push(m[1])
  for (const m of html.matchAll(/<(?:iframe|embed)\b[^>]*src=["']([^"']+)["']/gi)) urls.push(m[1])
  for (const m of html.matchAll(/\bdata-(?:video|src|url|link)=["'](https?:\/\/[^"']+)["']/gi)) urls.push(m[1])

  const seen = new Set()
  const out = []
  for (const u of urls) {
    if (!u || seen.has(u)) continue
    seen.add(u)
    out.push(u)
  }
  return out
}

// Punto de entrada principal.
export async function resolvePelisPlus({ type, tmdbId, title, originalTitle, year, season = 1, episode = 1 }) {
  const cacheKey = `pp:${type}:${String(tmdbId)}:${normalize(title || '')}:${year || ''}:${type === 'tv' ? `${season}/${episode}` : ''}`
  return cached(cacheKey, 15 * 60 * 1000, async () => {
    // Prueba el título en español primero y el original después (las series
    // de pelisplus suelen estar con el título en español).
    for (const candidate of [title, originalTitle]) {
      if (!candidate) continue
      const detailUrl = await findSlug(candidate, year, type)
      if (!detailUrl) continue
      const pageUrl =
        type === 'movie' ? detailUrl : `${detailUrl}/temporada/${season}/capitulo/${episode}`
      const html = await fetchText(pageUrl, detailUrl)
      if (!html) continue
      const urls = extractUrls(html).filter((u) => isAllowed(u))
      if (urls.length === 0) continue
      return urls.map((u, i) => ({
        name: `Servidor ${i + 1}`,
        label: `PelisPlus HD · Servidor ${i + 1}`,
        provider: 'PelisPlus HD',
        language: null,
        kind: u.includes('.m3u8') ? 'direct' : 'embed',
        url: u,
      }))
    }
    return []
  })
}