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
    const sk = `nsr:srv:${type}:${pick.slug}:${season}:${episode}`
    let payload = getMemo(sk, TTL_SERVERS)
    if (payload === undefined) {
      payload =
        type === 'movie'
          ? await call(`/content/info/${pick.slug}`, { type: 'movie' })
          : await call('/content/servers', {
              slug: pick.slug,
              season,
              episode,
            })
      setMemo(sk, payload)
    }
    return toSources(asList(payload))
  } catch {
    return []
  }
}
