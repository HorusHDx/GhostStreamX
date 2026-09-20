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

import { createHash, createDecipheriv } from 'node:crypto'
import { cached } from '../cache.js'
import { isAllowed } from '../hosts.js'
import { scrapeFetch } from '../scrapeFetch.js'

const BASE = 'https://pelisplushd.bz'
const TIMEOUT = 16000

async function fetchText(url, referer = `${BASE}/`) {
  return scrapeFetch(url, referer, TIMEOUT)
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

// ---------------------------------------------------------------------------
// Resolución de servidores internos de embed69.org
//
// embed69 es un "agregador" que agrupa varios hosters en una sola página.
// Cada página tiene un JSON `dataLink` con los hosters encriptados y un
// desafío PoW (Proof of Work) que debemos resolver para obtener las URLs
// reales de cada hoster (vidhide, streamwish, voe, etc.).
// ---------------------------------------------------------------------------

function sha256hex(str) {
  return createHash('sha256').update(str).digest('hex')
}

// Resuelve el desafío PoW: encontrar un nonce tal que
// SHA-256(challenge + nonce) empiece con `difficulty` ceros.
function solvePoW(challenge, difficulty, salt) {
  const prefix = '0'.repeat(difficulty)
  for (let nonce = 0; nonce < 2_000_000; nonce++) {
    if (sha256hex(challenge + String(nonce)).startsWith(prefix)) {
      return createHash('sha256').update(challenge + String(nonce) + salt).digest()
    }
  }
  return null
}

// Descifra un link AES-CBC encriptado por embed69.
// Formato: primeros 16 bytes = IV, resto = ciphertext.
function decryptLink(encryptedBase64, key) {
  try {
    const raw = Buffer.from(encryptedBase64, 'base64')
    const iv = raw.slice(0, 16)
    const ciphertext = raw.slice(16)
    const decipher = createDecipheriv('aes-256-cbc', key, iv)
    return decipher.update(ciphertext, undefined, 'utf8') + decipher.final('utf8')
  } catch {
    return null
  }
}

// Nombres amigables para los hosters de embed69.
const EMBED69_HOSTER_NAMES = {
  vidhide: 'VidHide',
  streamwish: 'Streamwish',
  voe: 'VOE',
  doodstream: 'Doodstream',
  filemoon: 'Filemoon',
  streamtape: 'Streamtape',
}

// Abre la página de embed69, extrae `dataLink`, resuelve el PoW y descifra
// los links de cada hoster. Devuelve [{ name, url, language }] o null.
async function resolveEmbed69(embed69Url) {
  const html = await fetchText(embed69Url, embed69Url)
  if (!html) return null

  const dlMatch = html.match(/(?:let|const|var)\s+dataLink\s*=\s*(\[[\s\S]*?\]);/)
  if (!dlMatch) return null

  let dataLink
  try {
    dataLink = JSON.parse(dlMatch[1])
  } catch {
    return null
  }
  if (!Array.isArray(dataLink) || dataLink.length === 0) return null

  const challenge = html.match(/POW_CHALLENGE\s*=\s*['"]([^'"]+)['"]/)?.[1]
  const difficulty = parseInt(html.match(/POW_DIFFICULTY\s*=\s*(\d+)/)?.[1] || '3', 10)
  const salt = html.match(/POW_SALT\s*=\s*['"]([^'"]+)['"]/)?.[1]

  // Prefetch PoW key (solo una vez para todos los embeds)
  let powKey = null
  if (challenge && salt) powKey = solvePoW(challenge, difficulty, salt)

  const results = []

  for (const entry of dataLink) {
    const lang = entry.video_language || null
    for (const embed of entry.sortedEmbeds || []) {
      let url = null
      const serverName = embed.servername || 'Unknown'

      // Formato dot-separated (raro pero posible)
      if (embed.link && embed.link.includes('.') && !embed.link.startsWith('http')) {
        try {
          const decoded = JSON.parse(Buffer.from(embed.link.split('.')[1], 'base64').toString())
          url = decoded?.link || null
        } catch { /* ignore */ }
      }

      // Descifrado AES-CBC con PoW
      if (!url && powKey) {
        url = decryptLink(embed.link, powKey)
      }

      if (url && url.startsWith('http')) {
        results.push({
          name: EMBED69_HOSTER_NAMES[serverName.toLowerCase()] || serverName,
          url,
          language: lang,
        })
      }
    }
  }

  return results.length > 0 ? results : null
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

      // Resolver cada URL — los embed69 se abren para extraer hosters internos
      const sources = []
      for (const u of urls) {
        if (u.includes('embed69.org')) {
          const resolved = await resolveEmbed69(u)
          if (resolved) {
            for (const r of resolved) {
              if (isAllowed(r.url)) {
                sources.push({
                  name: r.name,
                  label: `PelisPlus HD · ${r.name}`,
                  provider: 'PelisPlus HD',
                  language: r.language,
                  kind: 'embed',
                  url: r.url,
                })
              }
            }
          }
          // Si no se resolvió, no devolvemos la URL de embed69 directamente
          // porque el reproductor no puede cargarla (necesita los hosters).
        } else {
          // URL directa de otro host — devolver tal cual
          sources.push({
            name: `Servidor ${sources.length + 1}`,
            label: `PelisPlus HD · Servidor ${sources.length + 1}`,
            provider: 'PelisPlus HD',
            language: null,
            kind: u.includes('.m3u8') ? 'direct' : 'embed',
            url: u,
          })
        }
      }
      if (sources.length > 0) return sources
    }
    return []
  })
}