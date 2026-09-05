// Cliente NasriPlay (S2) — https://nsrplay.space
// Estrategia híbrida:
//   1) Vía directa por TMDB ID (/embed/sources + /embed/resolve): SIN key,
//      SIN búsqueda. Es la vía primaria en pelis (verificado: 1-8 servers).
//      En series hoy devuelve 0 (se mantiene la llamada por si lo pueblan).
//   2) Vía búsqueda por título+año (/content/*, REQUIERE key): enriquece
//      pelis y es la única vía para series (info→episodio→resolve→playUrl).
// - La API Key vive SOLO en el servidor (NSRPLAY_API_KEY). Nunca al front.
// - Cache: búsqueda→slug 1h, servidores/resolves 10min. Un 429 o fallo deja
//   ese tramo vacío sin romper S1 ni el otro tramo.

import { tmdb } from './tmdb.js'

const BASE = process.env.NSRPLAY_BASE || 'https://nsrplay.space'

// Como el worker de referencia: UA móvil + referer propio.
const EMBED_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Linux; Android 12; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36',
  Referer: 'https://nsrplay.space/',
  Accept: 'application/json',
}

const TTL_SEARCH = 60 * 60 * 1000 // 1h: el slug de un título no cambia
const TTL_SERVERS = 10 * 60 * 1000 // 10min: absorbe doble-clics sin gastar cuota
const BRANCH_TIMEOUT = 9000 // tope por rama S2: /watch nunca se cuelga por S2
const RESOLVE_TIMEOUT = 45000 // el resolve scrapea en vivo y a veces tarda 20s+;
// corre bajo demanda (el front muestra "Resolviendo S2…"), no en /watch.

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
    if (!res.ok) return null // 429, 4xx, 5xx: ese tramo vacío, el resto sigue
    return await res.json().catch(() => null)
  } catch {
    return null
  }
}

// Llamada keyless a /embed/* (no consume cuota de la key).
async function embedCall(path) {
  try {
    const res = await fetch(`${BASE}/api/v1${path}`, {
      headers: EMBED_HEADERS,
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return null
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

// Vía 2 (key): búsqueda por título+año → info/servers.
async function resolveViaSearch({ type, tmdbId, season = 1, episode = 1 }) {
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

// Resuelve un servidor {name, token} a URLs reproducibles.
// Prefiere playUrl (proxy directo, menos anuncios); si además hay directUrl
// (embed del host), lo suma como opción aparte.
async function resolveEmbedServer(s) {
  try {
    const url =
      `${BASE}/api/v1/embed/resolve?server=${encodeURIComponent(s.name)}` +
      `&token=${encodeURIComponent(s.token)}`
    const res = await fetch(url, {
      headers: EMBED_HEADERS,
      signal: AbortSignal.timeout(RESOLVE_TIMEOUT),
    })
    if (!res.ok) return []
    const data = await res.json().catch(() => null)
    const info = data && (data.data || data)
    if (!info) return []
    const out = []
    const playUrl = info.playUrl
    const directUrl = info.directUrl
    if (typeof playUrl === 'string' && /^https?:\/\//.test(playUrl)) {
      out.push({
        name: `${s.name} · Directo`,
        label: `Directo · ${s.name}`,
        language: null,
        kind: 'direct',
        url: playUrl,
        group: 'S2',
      })
    }
    if (
      typeof directUrl === 'string' &&
      /^https?:\/\//.test(directUrl) &&
      directUrl !== playUrl
    ) {
      out.push({
        name: s.name,
        label: `Servidor · ${s.name}`,
        language: null,
        kind: directUrl.includes('.m3u8') ? 'direct' : 'embed',
        url: directUrl,
        group: 'S2',
      })
    }
    return out
  } catch {
    return []
  }
}

// Resolve bajo demanda (lo llama el front al elegir servidor S2).
// Solo se cachean los resolves exitosos: un fallo (token expirado, 429,
// timeout) NO se cachea para que reintentar pueda funcionar.
export async function resolveNsrToken(server, token) {
  if (!server || !token) return null
  const ck = `nsr:tok:${server}:${token}`
  const cached = getMemo(ck, TTL_SERVERS)
  if (cached !== undefined) return cached
  const out = await resolveEmbedServer({ name: server, token })
  const first = out[0] || null
  if (first) setMemo(ck, first)
  return first
}

// Vía 1 (keyless): servers directos por TMDB ID, SIN resolver.
// Se listan al instante; el front resuelve el elegido vía resolveNsrToken.
// Así /watch nunca se cuelga por un resolve lento y no se quema cuota.
async function resolveViaEmbed({ type, tmdbId, season = 1, episode = 1 }) {
  try {
    const ck = `nsr:embed:${type}:${tmdbId}:${season}:${episode}`
    const cached = getMemo(ck, TTL_SERVERS)
    if (cached !== undefined) return cached
    const path =
      type === 'movie'
        ? `/embed/sources/movie/${tmdbId}?fast=true`
        : `/embed/sources/tv/${tmdbId}/${season}/${episode}?fast=true`
    const data = await embedCall(path)
    const servers = data && Array.isArray(data.servers) ? data.servers : []
    const out = servers
      .filter((s) => s && s.name && s.token)
      .map((s) => ({
        name: s.name,
        label: `Servidor · ${s.name}`,
        language: null,
        kind: 'embed',
        url: null, // se completa al elegir (resolveNsrToken)
        needsResolve: true,
        server: s.name,
        token: s.token,
        group: 'S2',
      }))
    setMemo(ck, out)
    return out
  } catch {
    return []
  }
}

function withTimeout(p, ms) {
  const sentinel = { __timeout: true }
  return Promise.race([
    Promise.resolve(p),
    new Promise((resolve) => setTimeout(() => resolve(sentinel), ms)),
  ]).then((v) => (v && v.__timeout ? [] : v))
}

// Entrada principal S2: corre ambas vías en paralelo (con tope) y une.
export async function resolveNsrSources(args) {
  const [v1, v2] = await Promise.all([
    withTimeout(resolveViaEmbed(args), BRANCH_TIMEOUT),
    withTimeout(resolveViaSearch(args), BRANCH_TIMEOUT),
  ])
  const list = [...v1, ...v2]
  const seen = new Set()
  return list.filter((s) => {
    if (!s) return false
    // Los pendientes aún no tienen url: se distinguen por server+token.
    const k = s.url || `pending:${s.server}:${s.token}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}
