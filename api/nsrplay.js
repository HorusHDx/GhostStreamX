// Cliente NasriPlay (S2) — https://nsrplay.space
// - La API Key vive SOLO en el servidor (NSRPLAY_API_KEY). Nunca al front ni al repo.
// - Respeta los límites: cache largo para búsqueda→slug (1h) y corto para
//   servidores (10min). Un 429 o cualquier fallo deja S2 vacío sin romper S1.
// - El match TMDB→slug es por título+año. Sin match seguro, devuelve [].

import { tmdb } from './tmdb.js'

const BASE = process.env.NSRPLAY_BASE || 'https://nsrplay.space'

const TTL_SEARCH = 60 * 60 * 1000 // 1h: el slug de un título no cambia
const TTL_SERVERS = 10 * 60 * 1000 // 10min: absorbe doble-clics sin gastar cuota

const memo = new Map() // key -> { t, data }

function getMemo(k, ttl) {
  const e = memo.get(k)
  if (e && Date.now() - e.t < ttl) return e.data
  memo.delete(k)
  return undefined
}

function setMemo(k, data) {
  if (memo.size > 500) memo.clear()
  memo.set(k, { t: Date.now(), data })
}

async function call(path, params = {}) {
  const apiKey = process.env.NSRPLAY_API_KEY
  if (!apiKey) return null
  const url = new URL(`${BASE}/api/v1${path}`)
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v)
  }
  try {
    const res = await fetch(url, {
      headers: { 'X-API-Key': apiKey, accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return null // 429, 4xx, 5xx: S2 vacío, S1 sigue
    return await res.json().catch(() => null)
  } catch {
    return null
  }
}

// Acepta varias formas de lista: array directo o bajo results/data/items/...
function asList(payload) {
  if (!payload) return []
  if (Array.isArray(payload)) return payload
  for (const k of ['results', 'data', 'items', 'servers', 'sources', 'embeds', 'links']) {
    if (Array.isArray(payload[k])) return payload[k]
  }
  return []
}

const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const yearOf = (it) =>
  String(
    it.year ||
      it.release_date ||
      it.first_air_date ||
      it.releaseDate ||
      ''
  ).slice(0, 4)

// Elige el slug con mejor puntaje (título + año). Sin match razonable → null.
function pickSlug(candidates, { type, year, title }) {
  const want = norm(title)
  let best = null
  let bestScore = 0
  for (const c of candidates) {
    const slug = c.slug || c.id_slug || c.url_slug
    if (!slug) continue
    const name = norm(c.title || c.name || c.nombre)
    if (!name) continue
    let score = 0
    if (name === want) score += 3
    else if (name.includes(want) || want.includes(name)) score += 2
    const cy = yearOf(c)
    if (year && cy === String(year)) score += 2
    else if (year && cy && Math.abs(Number(cy) - Number(year)) === 1) score += 1
    const ctype = String(c.type || c.media_type || '').toLowerCase()
    if (ctype && type) {
      const wantType = type === 'movie' ? 'movie' : ['series', 'tv', 'anime']
      const ok = Array.isArray(wantType) ? wantType.includes(ctype) : ctype === wantType
      if (ok) score += 1
      else score -= 2
    }
    if (score > bestScore) {
      bestScore = score
      best = { slug, score }
    }
  }
  return bestScore > 0 ? best : null
}

// URL de la página del episodio dentro de info.data.seasons[].episodes[].
function findEpisodeUrl(data, season, episode) {
  if (!data) return null
  const seasons = Array.isArray(data.seasons) ? data.seasons : []
  const s = seasons.find(
    (x) => Number(x.number ?? x.season_number ?? x.season) === Number(season)
  )
  const eps = s && Array.isArray(s.episodes) ? s.episodes : []
  const ep = eps.find(
    (e) => Number(e.number ?? e.episode_number ?? e.episode) === Number(episode)
  )
  const url = ep && (ep.url || ep.link || ep.embed)
  return typeof url === 'string' && /^https?:\/\//.test(url) ? url : null
}

function normLang(raw) {
  const l = norm(raw)
  if (!l) return null
  if (/latin/.test(l)) return 'latino'
  if (/castellano|espanol|spanish/.test(l)) return 'castellano'
  if (/sub/.test(l)) return 'subtitulado'
  if (/\benglish\b|\bingles\b/.test(l) || l === 'en') return 'english'
  return raw
}

function toSources(list) {
  const out = []
  for (const it of list) {
    const url = it.url || it.embed || it.embedUrl || it.link || it.src || it.file
    if (typeof url !== 'string' || !/^https?:\/\//.test(url)) continue
    const name = it.server || it.name || it.provider || 'NasriPlay'
    const language = normLang(it.language || it.lang || it.audio)
    out.push({
      name,
      label: `${language || 'Servidor'} · ${name}`,
      language,
      kind: url.includes('.m3u8') ? 'direct' : 'embed',
      url,
      group: 'S2',
    })
  }
  return out
}

export async function resolveNsrSources({ type, tmdbId, season = 1, episode = 1 }) {
  try {
    if (!process.env.NSRPLAY_API_KEY) return []

    // Título/año desde TMDB (cacheado 5min en tmdb.js).
    const detail =
      type === 'movie'
        ? await tmdb.movie(tmdbId).catch(() => null)
        : await tmdb.tv(tmdbId).catch(() => null)
    const title = detail && (detail.title || detail.name)
    const year = detail && (detail.release_date || detail.first_air_date || '').slice(0, 4)
    if (!title) return []

    // 1) Buscar slug (cache 1h).
    const ck = `nsr:search:${type}:${norm(title)}:${year || ''}`
    let candidates = getMemo(ck, TTL_SEARCH)
    if (candidates === undefined) {
      candidates = asList(await call('/content/search', { s: title }))
      setMemo(ck, candidates)
    }
    const pick = pickSlug(candidates, { type, year, title })
    if (!pick) return []

    // 2) Servidores (cache 10min).
    // Pelis: /info trae embeds directos con idioma. Series: /info trae
    // temporadas con la URL de cada episodio, que se resuelve a playUrl
    // (proxy listo para <video>) vía /resolve. El slug va CRUDO en el path
    // (con su slash): encodearlo rompe el router de nsrplay.
    const sk = `nsr:srv:${type}:${pick.slug}:${season}:${episode}`
    const cached = getMemo(sk, TTL_SERVERS)
    if (cached !== undefined) return cached
    let out = []
    if (type === 'movie') {
      const payload = await call(`/content/info/${pick.slug}`, { type: 'movie' })
      const pdata = payload && payload.data ? payload.data : payload
      out = toSources(asList(pdata))
    } else {
      const info = await call(`/content/info/${pick.slug}`, { type: 'series' })
      const epUrl = findEpisodeUrl(info && info.data ? info.data : info, season, episode)
      if (epUrl) {
        const resolved = await call('/content/resolve', { url: epUrl })
        const rdata = resolved && (resolved.data || resolved)
        const playUrl = rdata && (rdata.playUrl || rdata.directUrl)
        if (typeof playUrl === 'string' && /^https?:\/\//.test(playUrl)) {
          out = [
            {
              name: 'NasriPlay',
              label: 'Directo · NasriPlay',
              language: null,
              kind: 'direct',
              url: playUrl,
              group: 'S2',
            },
          ]
        }
      }
    }
    setMemo(sk, out)
    return out
  } catch {
    return []
  }
}
