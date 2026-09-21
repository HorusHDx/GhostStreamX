// server/scrapers/cuevana3.js
// Scraper propio de Cuevana3 (cuevana3.gs) para películas y series.
//
// Fuente de PRIMERA MANO (WordPress + API JSON + player propio), verificada
// end-to-end con fetch puro (sin captcha, sin headless):
//   1) Buscar   GET /wp-api/v1/search?postType=any&q={título}&postsPerPage=8
//                 -> { data: { posts: [{ _id, title, slug, type, release_date }] } }
//   2) Película: _id va directo a /player.
//      Serie:    GET /wp-api/v1/single/episodes/list?_id={serieId}&season={n}
//                 -> { data: { posts: [{ _id, season_number, episode_number }] } }
//                 -> tomar el _id del episodio pedido -> /player.
//   3) Player    GET /wp-api/v1/player?postId={id}&demo=0
//                 -> { data: { embeds: [{ url, server, lang, quality }] } }
//                 (4-6 servers por título; url = cuevana3.gs/player.php?t=...&server=...)
//   4) Resolver  GET {embed.url} con referer -> <iframe src="host-final/...">
//                 (vimeos.net, goodstream.one, hlswish.com, voe.sx, filemoon.sx,
//                  videoapp.zip, doodstream.com...) -> filtro isAllowed.
//
// El tráfico sale por el Worker dedicado work-cuevana (env CUEVANA_PROXY_URL),
// o por el proxy genérico / directo como fallback (más abajo).
//
// Devuelve un array de sources { name, label, provider, language, kind, url }.

import { cached } from '../cache.js'
import { isAllowed, hostName } from '../hosts.js'
import { normalize } from './pelisplus.js'

const BASE = 'https://cuevana3.gs'
const TIMEOUT = 16000

// Proxy dedicado para esta fuente (anti-ban: cuevana solo ve IPs de Cloudflare).
// Configuración de Vercel:
//   CUEVANA_PROXY_URL   = https://work-cuevana.TU.workers.dev
//   CUEVANA_PROXY_TOKEN = el secreto del Worker (SCRAPE_TOKEN)
// Si no están, cae al proxy genérico (SCRAPER_PROXY_URL) y luego directo.
const PROXY_URL = (
  process.env.CUEVANA_PROXY_URL || process.env.SCRAPER_PROXY_URL || ''
).replace(/\/+$/, '')
const PROXY_TOKEN = process.env.CUEVANA_PROXY_TOKEN || process.env.SCRAPER_PROXY_TOKEN || ''

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

async function fetchText(url, referer = `${BASE}/`) {
  // 1) Worker dedicado (si está configurado) — sin fallback a otros hosts.
  if (PROXY_URL && PROXY_TOKEN) {
    try {
      const proxyUrl = new URL(`${PROXY_URL}/fetch`)
      proxyUrl.searchParams.set('url', url)
      proxyUrl.searchParams.set('token', PROXY_TOKEN)
      if (referer) proxyUrl.searchParams.set('ref', referer)
      const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(TIMEOUT + 8000) })
      if (res.ok) return await res.text()
    } catch {
      // caemos al fallback
    }
  }
  // 2) Fallback: proxy genérico de scrapers (work-pelisplus) o directo.
  try {
    const res = await fetch(url, {
      headers: {
        'user-agent': UA,
        accept: url.includes('/wp-api/')
          ? 'application/json, text/plain, */*'
          : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
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

async function fetchJson(url, referer = `${BASE}/`) {
  const text = await fetchText(url, referer)
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

// 1) Busca el post (película/serie) que mejor matchea título + año.
function bestPost(posts, title, year, wantType) {
  const tNorm = normalize(title)
  const y = year ? String(year) : ''
  const candidates = []
  for (const p of posts || []) {
    if (!p || p.type !== wantType) continue
    const raw = p.title || ''
    const cNorm = normalize(raw)
    const ySite = (raw.match(/\((\d{4})\)/) || [])[1] || ''
    let score = 0
    if (cNorm && cNorm === tNorm) score += 100
    else if (cNorm && (cNorm.includes(tNorm) || tNorm.includes(cNorm))) score += 60
    else score -= 20
    if (y && ySite === y) score += 30
    else if (y && ySite && ySite !== y && Math.abs(parseInt(ySite) - parseInt(y)) > 2) score -= 15
    if (score > 0) candidates.push({ post: p, score })
  }
  candidates.sort((a, b) => b.score - a.score)
  return candidates[0]?.post || null
}

// 2a) Encuentra el _id del episodio pedido dentro de la temporada.
async function findEpisodeId(serieId, season, episode) {
  const json = await fetchJson(
    `${BASE}/wp-api/v1/single/episodes/list?_id=${encodeURIComponent(serieId)}&season=${encodeURIComponent(season)}&page=1&postsPerPage=60`
  )
  if (!json || json.error || !Array.isArray(json.data?.posts)) return null
  const ep = json.data.posts.find(
    (p) =>
      Number(p.season_number) === Number(season) &&
      Number(p.episode_number) === Number(episode)
  )
  return ep?._id ? String(ep._id) : null
}

// 3) Pide los embeds del player para un post (película o episodio).
async function getPlayerEmbeds(postId) {
  const json = await fetchJson(
    `${BASE}/wp-api/v1/player?postId=${encodeURIComponent(postId)}&demo=0`
  )
  if (!json || json.error || !Array.isArray(json.data?.embeds)) return []
  return json.data.embeds
}

// 4) Resuelve player.php -> iframe final del hoster.
async function resolveEmbed(embedUrl) {
  const html = await fetchText(embedUrl, `${BASE}/`)
  if (!html) return null
  const m = html.match(/<iframe[^>]+src=["']([^"']+)["']/i)
  return m ? m[1] : null
}

// Punto de entrada principal.
export async function resolveCuevana3({ type, tmdbId, title, originalTitle, year, season = 1, episode = 1 }) {
  const cacheKey = `cv:${type}:${String(tmdbId)}:${type === 'tv' ? `${season}/${episode}` : ''}`
  return cached(cacheKey, 15 * 60 * 1000, async () => {
    const wantType = type === 'movie' ? 'movies' : 'tvshows'

    for (const candidate of [title, originalTitle]) {
      if (!candidate) continue
      const searchJson = await fetchJson(
        `${BASE}/wp-api/v1/search?postType=any&q=${encodeURIComponent(candidate)}&postsPerPage=8`
      )
      if (!searchJson || searchJson.error || !Array.isArray(searchJson.data?.posts)) continue

      const post = bestPost(searchJson.data.posts, candidate, year, wantType)
      if (!post || !post._id) continue

      // Película: el post ES el player. Serie: primero el episodio.
      let postId = String(post._id)
      if (type === 'tv') {
        const epId = await findEpisodeId(postId, season, episode)
        if (!epId) continue
        postId = epId
      }

      const embeds = await getPlayerEmbeds(postId)
      if (embeds.length === 0) continue

      const resolved = await Promise.allSettled(
        embeds.map(async (embed) => {
          const server = embed.server || ''
          if (!server) return null
          const finalUrl = await resolveEmbed(embed.url)
          if (!finalUrl || !isAllowed(finalUrl)) return null
          return { server, finalUrl, lang: embed.lang || null, quality: embed.quality || null }
        })
      )

      const urls = []
      const seen = new Set()
      for (const r of resolved) {
        if (r.status !== 'fulfilled' || !r.value) continue
        const v = r.value
        if (seen.has(v.finalUrl)) continue
        seen.add(v.finalUrl)
        urls.push(v)
      }
      if (urls.length === 0) continue

      // Nombres únicos: prefiero el nombre del server que da la API; si es
      // genérico ("Online"), uso el nombre del hoster real (Vimeos, Voe...).
      const GENERIC = new Set(['online', 'opcion 1', 'servidor', ''])
      const count = {}
      return urls.map((v) => {
        const raw = (v.server || '').trim()
        const base = GENERIC.has(raw.toLowerCase())
          ? hostName(v.finalUrl)
          : raw.charAt(0).toUpperCase() + raw.slice(1)
        count[base] = (count[base] || 0) + 1
        const name = count[base] > 1 ? `${base} ${count[base]}` : base
        const extra = [v.lang, v.quality].filter(Boolean).join(' · ')
        return {
          name,
          label: extra ? `Cuevana3 · ${name} · ${extra}` : `Cuevana3 · ${name}`,
          provider: 'Cuevana3',
          language: v.lang,
          kind: v.finalUrl.endsWith('.m3u8') ? 'direct' : 'embed',
          url: v.finalUrl,
        }
      })
    }
    return []
  })
}