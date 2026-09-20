// Api/scrapers/poseidon.js
// Scraper propio de PoseidonHD (poseidonhd2.co) para películas y series.
//
// La gran ventaja: sus URLs usan el TMDB ID directo, no hace falta buscar:
//   Película -> https://www.poseidonhd2.co/pelicula/{tmdbId}/{slug}
//   Serie    -> https://www.poseidonhd2.co/serie/{tmdbId}/{slug}/temporada/{n}/episodio/{m}
// (el slug es decorativo: probado con un slug inventado y devuelve el mismo
// contenido; el ID es lo que enruta la página).
//
// Los servidores NO vienen en el HTML del detalle: vienen como tokens
//   https://player.poseidonhd2.co/player.php?h={token}
// que al pedirlos devuelven una página con la URL final del hoster:
//   var url = 'https://streamwish.to/e/xxxx';
// Así que resolvemos cada token -> URL final -> filtramos por lista blanca.

import { cached } from '../cache.js'
import { isAllowed, hostName } from '../hosts.js'
import { scrapeFetch } from '../scrapeFetch.js'

const BASE = 'https://www.poseidonhd2.co'
const PLAYER = 'https://player.poseidonhd2.co'
const TIMEOUT = 18000
// Máximo de players a resolver por petición (balance entre velocidad y
// cobertura; los primeros suelen bastar).
const MAX_PLAYERS = 12

async function fetchText(url, referer = `${BASE}/`) {
  return scrapeFetch(url, referer, TIMEOUT)
}

function slugify(s) {
  return (
    (s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'ver'
  )
}

export async function resolvePoseidon({ type, tmdbId, title, season = 1, episode = 1 }) {
  if (!tmdbId) return []
  const cacheKey = `psd:${type}:${String(tmdbId)}:${type === 'tv' ? `${season}/${episode}` : ''}`
  return cached(cacheKey, 30 * 60 * 1000, async () => {
    const slug = slugify(title)
    const pageUrl =
      type === 'movie'
        ? `${BASE}/pelicula/${tmdbId}/${slug}`
        : `${BASE}/serie/${tmdbId}/${slug}/temporada/${season}/episodio/${episode}`

    const html = await fetchText(pageUrl)
    if (!html) return []

    // Tokens de player en el HTML del detalle.
    const tokens = [
      ...new Set([
        ...html.matchAll(/https:\/\/player\.poseidonhd2\.co\/player\.php\?h=([^"'\s<>\\]+)/g),
      ].map((m) => m[1])),
    ]
    if (tokens.length === 0) return []

    // Resolvemos cada token -> URL final del hoster.
    const resolved = await Promise.allSettled(
      tokens.slice(0, MAX_PLAYERS).map(async (tok) => {
        const php = await fetchText(`${PLAYER}/player.php?h=${encodeURIComponent(tok)}`, pageUrl)
        const m = php.match(/var url\s*=\s*'([^']+)'/)
        return m ? m[1] : null
      })
    )

    const urls = [
      ...new Set(
        resolved
          .filter((r) => r.status === 'fulfilled' && r.value)
          .map((r) => r.value)
          .filter((u) => isAllowed(u))
      ),
    ]

    // Nombres únicos por host: Streamwish, Streamwish 2, ...
    const count = {}
    return urls.map((u) => {
      const h = hostName(u)
      count[h] = (count[h] || 0) + 1
      const name = count[h] > 1 ? `${h} ${count[h]}` : h
      return {
        name,
        label: `Poseidon · ${name}`,
        provider: 'Poseidon',
        language: null,
        kind: u.includes('.m3u8') ? 'direct' : 'embed',
        url: u,
      }
    })
  })
}