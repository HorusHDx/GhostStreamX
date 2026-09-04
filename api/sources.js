// Resolvedores de fuentes de reproducción.
// Reciben un { type, tmdbId, season, episode } y devuelven un array de
// `sources` ordenados por prioridad. Cada source es:
//   { kind: 'embed', url }   -> iframe (UnlimPlay, nsrplay player)
//   { kind: 'direct', url }  -> .m3u8 / .mp4 directo
//
// El front elige sources[0] y el Player decide cómo reproducirlo.
// Se recorre varias fuentes en cascada (fallback).

import fetch from 'node-fetch'

// --- UnlimPlay (agregador de embeds; acepta tmdb id o imdb tt) ---
function unlimplaySource({ type, tmdbId, season, episode }) {
  if (type === 'movie') {
    return {
      name: 'UnlimPlay',
      kind: 'embed',
      url: `https://unlimplay.com/f/embed/movie/${tmdbId}`,
    }
  }
  return {
    name: 'UnlimPlay',
    kind: 'embed',
    url: `https://unlimplay.com/f/embed/tv/${tmdbId}/${season}/${episode}`,
  }
}

// --- nsrplay.space (API REST multi-fuente) ---
// Intenta obtener fuentes resueltas reales vía su endpoint /api/v1/embed/sources/...
// Si no responde o no hay formato JSON, devuelve un embed HTML básico.
async function nsrplaySource({ type, tmdbId, season, episode }) {
  const BASE = process.env.NSRPLAY_BASE || 'https://nsrplay.space'
  const path =
    type === 'movie'
      ? `/api/v1/embed/sources/movie/${tmdbId}`
      : `/api/v1/embed/sources/tv/${tmdbId}/${season}/${episode}`

  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    })
    if (res.ok) {
      const data = await res.json()
      // Esperamos: { sources: [ { server, url/embed, ... } ] } o { embed }
      const list = data.sources || data.embeds || (data.embed ? [data] : [])
      if (Array.isArray(list) && list.length > 0) {
        return list.map((s) => ({
          name: `nsrplay · ${s.server || s.name || 'fuente'}`,
          kind: 'embed',
          url: s.embed || s.url,
        }))
      }
    }
  } catch {
    /* cae al fallback de embed */
  }

  // Fallback: player embebible
  return [
    {
      name: 'nsrplay',
      kind: 'embed',
      url:
        type === 'movie'
          ? `${BASE}/embed/movie/${tmdbId}`
          : `${BASE}/embed/tv/${tmdbId}/${season}/${episode}`,
    },
  ]
}

// --- Resolución en cascada: devuelve fuentes ordenadas por prioridad.
export async function resolveSources({ type, tmdbId, season = 1, episode = 1 }) {
  const sources = []

  // 1) nsrplay (API real con varias fuentes)
  try {
    const ns = await nsrplaySource({ type, tmdbId, season, episode })
    sources.push(...ns)
  } catch {
    /* sin fuentes */
  }

  // 2) UnlimPlay (embed directo)
  sources.push(unlimplaySource({ type, tmdbId, season, episode }))

  // Quitar duplicados por url
  const seen = new Set()
  const uniq = sources.filter((s) => {
    if (!s.url || seen.has(s.url)) return false
    seen.add(s.url)
    return true
  })

  return uniq
}
