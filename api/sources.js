// Resolvedores de fuentes de reproducción.
// Reciben un { type, tmdbId, season, episode } y devuelven un array de
// `sources`. Cada source es un embed de iframe.
//
// UnlimPlay incrusta varios servidores por título, agrupados por idioma.
// Extraemos esa lista del HTML del embed (viene en un JSON `finalizePlayer({...})`),
// y la devolvemos agrupada para que el front pueda ofrecer un selector.

// Nota para Windows/Node: fetch nativo disponible en Node >= 18.
const fetch = globalThis.fetch

import { resolveNsrSources } from './nsrplay.js'

// --- UnlimPlay: URL del embed (según tipo) ---
function unlimplayEmbedUrl({ type, tmdbId, season, episode }) {
  if (type === 'movie') {
    return `https://unlimplay.com/f/embed/movie/${tmdbId}`
  }
  return `https://unlimplay.com/f/embed/tv/${tmdbId}/${season}/${episode}`
}

// --- Extrae el JSON de servidores del HTML del embed ---
// UnlimPlay inserta algo como:
//   finalizePlayer({"latino":{...},"subtitulado":{...},"searched_names":[...]})
// Devolvemos el objeto de datos { idioma: { servidor: url } } o null.
async function fetchServersJson(embedUrl) {
  try {
    const res = await fetch(embedUrl, {
      headers: {
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        referer: 'https://google.com/',
      },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    const html = await res.text()

    // Busca: finalizePlayer(<objeto json>);  —— puede tener espacios antes del `{`
    const m = html.match(/finalizePlayer\(\s*(\{[\s\S]*?\})\s*\)\s*;?/)
    if (!m) return null

    const data = JSON.parse(m[1])
    // data = { latino: {...}, subtitulado: {...}, searched_names: [...] }
    // Descartamos claves que no sean objetos de servidores (searched_names, etc.)
    const groups = {}
    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const servers = {}
        for (const [srv, url] of Object.entries(value)) {
          // Descartar placeholders propios/vacíos y no-URLs
          if (typeof url === 'string' && /^https?:\/\//.test(url)) {
            servers[srv] = url
          }
        }
        if (Object.keys(servers).length > 0) groups[key] = servers
      }
    }
    return groups
  } catch {
    return null
  }
}

// --- Resolución S1: extrae servidores de UnlimPlay ---
// Devuelve fuentes planas, una por servidor, cada una con su idioma y grupo.
// Si no logramos extraer, devuelve el embed por defecto (modo automático de UnlimPlay).
async function resolveUnlim({ type, tmdbId, season = 1, episode = 1 }) {
  const embedUrl = unlimplayEmbedUrl({ type, tmdbId, season, episode })
  const sources = []

  const groups = await fetchServersJson(embedUrl)
  if (groups && Object.keys(groups).length > 0) {
    for (const [lang, servers] of Object.entries(groups)) {
      for (const [serverName, url] of Object.entries(servers)) {
        sources.push({
          name: serverName,            // streamwish, doodstream, streamtape...
          label: `${lang} · ${serverName}`, // etiqueta para el selector
          language: lang,              // latino, subtitulado, castellano, english
          kind: url.includes('.m3u8') ? 'direct' : 'embed',
          url,
        })
      }
    }
  } else {
    // Fallback: embed oficial (UnlimPlay elige el mejor servidor automáticamente)
    sources.push({
      name: 'UnlimPlay',
      label: 'Automático (UnlimPlay)',
      language: null,
      kind: 'embed',
      url: embedUrl,
    })
  }

  return sources
}

// --- Resolución combinada S1 (UnlimPlay) + S2 (NasriPlay) ---
// Ambos corren en paralelo e independientes: si uno falla o no tiene el
// título, el otro sigue devolviendo sus fuentes con su `group`.
export async function resolveSources({ type, tmdbId, season = 1, episode = 1 }) {
  const [s1, s2] = await Promise.allSettled([
    resolveUnlim({ type, tmdbId, season, episode }),
    resolveNsrSources({ type, tmdbId, season, episode }),
  ])
  const unlim = s1.status === 'fulfilled' ? s1.value : []
  const nsr = s2.status === 'fulfilled' ? s2.value : []
  return [
    ...unlim.map((s) => ({ ...s, group: s.group || 'S1' })),
    ...nsr.map((s) => ({ ...s, group: 'S2' })),
  ]
}
