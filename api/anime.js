// Sección Anime (aislada) — scraping server-side de AnimeAV1 (https://animeav1.com)
// Solo fetch + regex/JSON, SIN navegador: compatible con Vercel serverless.
// No toca el flujo existente (TMDB/S1/S2). Todo vive bajo /anime/*.
//
// Fuente primaria: `__data.json` de cada ruta (payload SvelteKit estructurado:
// ficha completa con episodesCount y malId, embeds por episodio, catálogo con
// paginación exacta, últimos episodios del home). Si el JSON falla o cambia de
// formato, se usa el parseo del HTML como fallback (más frágil, mismas salidas).

const AV1 = 'https://animeav1.com'
const CDN = 'https://cdn.animeav1.com'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'

const TTL_CATALOG = 30 * 60 * 1000 // 30min: el catálogo cambia poco
const TTL_INFO = 60 * 60 * 1000 // 1h: la ficha es estable
const TTL_EPISODE = 10 * 60 * 1000 // 10min: absorbe re-clics sin recargar al origen
const TTL_GENRES = 24 * 60 * 60 * 1000 // 24h: el mapa de géneros casi no cambia
const TTL_LATEST = 15 * 60 * 1000 // 15min: novedades frescas sin acribillar al origen

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

async function fetchAv1(path, accept = 'text/html') {
  const res = await fetch(`${AV1}${path}`, {
    headers: { 'User-Agent': UA, Accept: accept },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`AnimeAV1 respondió ${res.status}`)
  return res
}

// Descarga el payload SvelteKit (`__data.json`) de una ruta y devuelve el
// array `data` del último nodo (el de la página; el primero es el layout).
async function fetchPageData(route, qs = '') {
  const res = await fetchAv1(
    `${route}/__data.json${qs ? `?${qs}` : ''}`,
    'application/json'
  )
  const raw = await res.json().catch(() => null)
  const nodes = (raw?.nodes || [])
    .filter((n) => n && n.type === 'data' && Array.isArray(n.data))
    .map((n) => n.data)
  if (!nodes.length) throw new Error('AnimeAV1 json vacío')
  return nodes[nodes.length - 1]
}

// Resuelve el formato devalue: dentro de objetos/arrays, cada entero es un
// índice al array `data` (los literales viven como elementos del array).
// Verificado empíricamente: título, episodios, embeds y conteos resuelven exacto.
function resolveDevalue(data) {
  const done = new Map()
  function walk(idx, stack) {
    if (typeof idx !== 'number' || !Number.isInteger(idx) || idx < 0 || idx >= data.length) {
      return idx
    }
    if (done.has(idx)) return done.get(idx)
    if (stack.includes(idx)) return undefined // ciclo: no debería pasar
    const v = data[idx]
    const ns = [...stack, idx]
    let out
    if (Array.isArray(v)) out = v.map((x) => walk(x, ns))
    else if (v && typeof v === 'object') {
      out = {}
      for (const [k, val] of Object.entries(v)) out[k] = walk(val, ns)
    } else {
      out = v
    }
    done.set(idx, out)
    return out
  }
  return walk(0, [])
}

// Decodifica entidades HTML numéricas y comunes (&amp; &quot; &#233; ...).
function decodeHtml(s) {
  if (!s) return ''
  return s
    .replace(/&#(\d+);/g, (_, n) => {
      try {
        return String.fromCodePoint(Number(n))
      } catch {
        return ''
      }
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => {
      try {
        return String.fromCodePoint(parseInt(n, 16))
      } catch {
        return ''
      }
    })
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
}

function stripTags(s) {
  return decodeHtml((s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim())
}

function validSlug(slug) {
  return typeof slug === 'string' && /^[a-z0-9-]{1,80}$/.test(slug)
}

function coverOf(id) {
  return id ? `${CDN}/covers/${id}.jpg` : null
}

function backdropOf(id) {
  return id ? `${CDN}/backdrops/${id}.jpg` : null
}

function shotOf(mediaId, n) {
  return mediaId && n ? `${CDN}/screenshots/${mediaId}/${n}.jpg` : null
}

// "1999-10-20" -> "Temporada Otoño" ( convención del sitio).
function seasonLabel(startDate) {
  const m = /^(\d{4})-(\d{2})/.exec(startDate || '')
  if (!m) return null
  const month = Number(m[2])
  const season =
    month >= 3 && month <= 5
      ? 'Primavera'
      : month >= 6 && month <= 8
        ? 'Verano'
        : month >= 9 && month <= 11
          ? 'Otoño'
          : 'Invierno'
  return `Temporada ${season}`
}

// Estado derivado de fechas: con endDate -> Finalizado; si aún no estrena ->
// Próximamente; si ya estrenó y sigue sin fin -> En emisión.
function statusFromDates(startDate, endDate) {
  if (endDate) return 'Finalizado'
  const today = new Date().toISOString().slice(0, 10)
  if (startDate && startDate.slice(0, 10) > today) return 'Próximamente'
  if (startDate) return 'En emisión'
  return null
}

function cleanServers(list) {
  if (!Array.isArray(list)) return []
  const out = []
  for (const s of list) {
    if (
      s &&
      typeof s.server === 'string' &&
      typeof s.url === 'string' &&
      /^https?:\/\//.test(s.url) &&
      !out.some((o) => o.url === s.url)
    ) {
      out.push({ server: s.server, url: s.url })
    }
  }
  return out
}

// Verifica si una URL de embed permite <iframe> desde NUESTRA web (HEAD +
// headers). Ojo: se hace SIN Referer de AnimeAV1 a propósito — algunos hosts
// (ej. Zilla/HLS) responden 200 solo con referer animeav1.com y 403 al resto,
// así que simular nuestro contexto real es lo que detecta el bloqueo.
// 'ok' = sin bloqueo detectable, 'blocked' = 403/X-Frame-Options DENY,
// SAMEORIGIN o frame-ancestors restrictivo, 'unknown' = no concluyente.
async function framingStatus(url) {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': UA, Accept: '*/*' },
      signal: AbortSignal.timeout(5000),
      redirect: 'follow',
    })
    if (res.status === 405 || res.status === 501) return 'unknown'
    if (res.status >= 400) return res.status === 403 ? 'blocked' : 'unknown'
    const xfo = (res.headers.get('x-frame-options') || '').toLowerCase()
    if (xfo.includes('deny') || xfo.includes('sameorigin')) return 'blocked'
    const csp = (res.headers.get('content-security-policy') || '').toLowerCase()
    for (const part of csp.split(';')) {
      const p = part.trim()
      if (p.startsWith('frame-ancestors')) {
        const v = p.slice('frame-ancestors'.length).trim()
        if (v && !v.includes('*') && !v.includes('http:') && !v.includes('https:')) {
          return 'blocked'
        }
      }
    }
    return 'ok'
  } catch {
    return 'unknown'
  }
}

const FRAME_RANK = { ok: 0, unknown: 1, blocked: 2 }

// Clasifica en paralelo y ordena: reproducibles primero, bloqueados al final.
// Todos quedan listados (el usuario puede forzar cualquiera o abrirlo externo).
async function rankServers(servers) {
  const flags = await Promise.all(servers.map((s) => framingStatus(s.url)))
  return servers
    .map((s, i) => ({ ...s, frame: flags[i] }))
    .sort((a, b) => FRAME_RANK[a.frame] - FRAME_RANK[b.frame])
}

// ---------- Catálogo / búsqueda ----------

function mapCatalogItem(r) {
  if (!r || !r.slug || !r.title) return null
  return {
    slug: r.slug,
    title: r.title,
    cover: coverOf(r.id),
    type: r.category?.name || null,
  }
}

async function catalogJson({ page, genre, search }) {
  const q = new URLSearchParams()
  if (page > 1) q.set('page', String(page))
  if (genre) q.set('genre', genre)
  if (search) q.set('search', search)
  const data = await fetchPageData('/catalogo', q.toString())
  const root = resolveDevalue(data)
  if (!root || !Array.isArray(root.results)) throw new Error('AnimeAV1 json sin resultados')
  const items = root.results.map(mapCatalogItem).filter(Boolean)
  const seen = new Set()
  const deduped = items.filter((it) =>
    seen.has(it.slug) ? false : (seen.add(it.slug), true)
  )
  const pg = root.pagination || {}
  const hasMore = search
    ? false
    : Number(pg.currentPage || page) < Number(pg.totalPages || page)
  return { items: deduped, page, hasMore }
}

function parseCatalogHtml(html) {
  const items = []
  const articles = html.split('<article')
  for (let i = 1; i < articles.length; i++) {
    const a = articles[i]
    const end = a.indexOf('</article>')
    const block = end === -1 ? a : a.slice(0, end)
    if (!block.includes('group/item')) continue
    const href = block.match(/href="\/media\/([a-z0-9-]+)"/)
    const titleM = block.match(/<span class="sr-only">Ver ([^<]+)<\/span>/)
    const coverM = block.match(/src="(https:\/\/cdn\.animeav1\.com\/covers\/[^"]+)"/)
    const typeM = block.match(/<div class="rounded bg-line[^"]*">([^<]+)<\/div>/)
    if (!href || !titleM) continue
    items.push({
      slug: href[1],
      title: decodeHtml(titleM[1].trim()),
      cover: coverM ? coverM[1] : null,
      type: typeM ? stripTags(typeM[1]) : null,
    })
  }
  const seen = new Set()
  return items.filter((it) => (seen.has(it.slug) ? false : (seen.add(it.slug), true)))
}

async function catalogHtml({ page, genre, search }, qs) {
  const res = await fetchAv1(`/catalogo${qs ? `?${qs}` : ''}`)
  const html = await res.text()
  const items = parseCatalogHtml(html)
  const hasMore = search ? false : html.includes(`page=${page + 1}`)
  return { items, page, hasMore }
}

export async function animeCatalog({ page = 1, genre = '', search = '' } = {}) {
  const p = Math.min(Math.max(parseInt(page, 10) || 1, 1), 50)
  const q = new URLSearchParams()
  if (p > 1) q.set('page', String(p))
  if (genre) q.set('genre', genre)
  if (search) q.set('search', search)
  const qs = q.toString()
  const key = `anime:catalog:${qs || 'p1'}`
  const hit = getMemo(key, TTL_CATALOG)
  if (hit) return hit
  let data
  try {
    data = await catalogJson({ page: p, genre, search })
  } catch {
    data = await catalogHtml({ page: p, genre, search }, qs) // fallback HTML
  }
  setMemo(key, data)
  return data
}

// ---------- Ficha ----------

function mapInfo(media, slug) {
  if (!media || !media.title) throw new Error('Anime no encontrado')
  const mid = media.id || null
  const episodes = (Array.isArray(media.episodes) ? media.episodes : [])
    .filter((e) => e && Number(e.number) >= 1)
    .sort((a, b) => a.number - b.number)
    .map((e) => ({ number: Number(e.number), screenshot: shotOf(mid, Number(e.number)) }))
  const total = Number(media.episodesCount) || (episodes.length ? episodes[episodes.length - 1].number : 0)
  const genres = (Array.isArray(media.genres) ? media.genres : [])
    .filter((g) => g && g.slug)
    .map((g) => ({ slug: g.slug, label: g.name || g.slug }))
  return {
    slug,
    title: media.title,
    type: media.category?.name || null,
    year: (media.startDate || '').slice(0, 4) || null,
    season: seasonLabel(media.startDate),
    status: statusFromDates(media.startDate, media.endDate),
    synopsis: media.synopsis || '',
    poster: coverOf(mid),
    backdrop: backdropOf(mid),
    rating: media.score != null ? String(media.score) : null,
    malId: media.malId ?? null,
    genres,
    episodes,
    totalEpisodes: total,
    episodeListTruncated: episodes.length < total,
  }
}

async function infoJson(slug) {
  let data
  try {
    data = await fetchPageData(`/media/${slug}`)
  } catch (e) {
    if (/404/.test(e.message)) throw new Error('Anime no encontrado')
    throw e
  }
  return mapInfo(resolveDevalue(data).media, slug)
}

async function infoHtml(slug) {
  const res = await fetchAv1(`/media/${slug}`)
  const html = await res.text()
  const titleM = html.match(/<h1[^>]*>([^<]+)<\/h1>/)
  if (!titleM) throw new Error('Anime no encontrado')
  const title = decodeHtml(titleM[1].trim())
  let type = null
  let year = null
  let season = null
  let status = null
  const metaM = html.slice(titleM.index + titleM[0].length).match(
    /<div class="flex flex-wrap items-center gap-2 text-sm">([\s\S]*?)<\/div>/
  )
  if (metaM) {
    const parts = stripTags(metaM[1])
      .split('•')
      .map((s) => s.trim())
      .filter(Boolean)
    ;[type = null, year = null, season = null, status = null] = [...parts]
  }
  const synM = html.match(/<div class="entry[^"]*">\s*<p>([\s\S]*?)<\/p>/)
  const posterM = html.match(/src="(https:\/\/cdn\.animeav1\.com\/covers\/\d+\.jpg)"/)
  const backdropM = html.match(/src="(https:\/\/cdn\.animeav1\.com\/backdrops\/\d+\.jpg)"/)
  const ratingM = html.match(/text-2xl font-bold">(\d\.\d+)</)
  const genres = []
  const gRe = /\/catalogo\?genre=([a-z-]+)">([^<]+)</g
  let gM
  while ((gM = gRe.exec(html)) !== null) {
    if (!genres.some((g) => g.slug === gM[1])) {
      genres.push({ slug: gM[1], label: decodeHtml(gM[2].trim()) })
    }
  }
  const shots = new Map()
  const shotRe = /https:\/\/cdn\.animeav1\.com\/screenshots\/\d+\/(\d+)\.jpg/g
  let sM
  while ((sM = shotRe.exec(html)) !== null) {
    const n = Number(sM[1])
    if (!shots.has(n)) shots.set(n, sM[0])
  }
  const epSet = new Set()
  const epRe = new RegExp(`href="/media/${slug}/(\\d+)"`, 'g')
  let eM
  while ((eM = epRe.exec(html)) !== null) epSet.add(Number(eM[1]))
  const episodes = [...epSet]
    .sort((a, b) => a - b)
    .map((n) => ({ number: n, screenshot: shots.get(n) || null }))
  return {
    slug,
    title,
    type,
    year,
    season,
    status,
    synopsis: synM ? stripTags(synM[1]) : '',
    poster: posterM ? posterM[1] : null,
    backdrop: backdropM ? backdropM[1] : null,
    rating: ratingM ? ratingM[1] : null,
    malId: null,
    genres,
    episodes,
    totalEpisodes: episodes.length ? episodes[episodes.length - 1].number : 0,
    episodeListTruncated: episodes.length === 50,
  }
}

export async function animeInfo(slug) {
  if (!validSlug(slug)) throw new Error('Slug inválido')
  const key = `anime:info:${slug}`
  const hit = getMemo(key, TTL_INFO)
  if (hit) return hit
  let data
  try {
    data = await infoJson(slug)
  } catch (e) {
    if (/no encontrado/i.test(e.message)) throw e
    data = await infoHtml(slug) // fallback HTML
  }
  setMemo(key, data)
  return data
}

// ---------- Episodio (servidores embed) ----------

async function mapEpisode(root, slug, num) {
  const media = root?.media || {}
  const variants = {}
  for (const v of ['SUB', 'DUB']) {
    const servers = await rankServers(cleanServers(root?.embeds?.[v]))
    if (servers.length) variants[v] = servers
  }
  if (!Object.keys(variants).length) throw new Error('Episodio sin servidores')
  const total = Number(media.episodesCount) || 0
  return {
    slug,
    animeTitle: media.title || slug,
    episode: num,
    variants,
    prev: num > 1 ? num - 1 : null,
    next: total && num < total ? num + 1 : null,
  }
}

async function episodeJson(slug, num) {
  let data
  try {
    data = await fetchPageData(`/media/${slug}/${num}`)
  } catch (e) {
    if (/404/.test(e.message)) throw new Error('Episodio sin servidores')
    throw e
  }
  return mapEpisode(resolveDevalue(data), slug, num)
}

async function episodeHtml(slug, num) {
  const res = await fetchAv1(`/media/${slug}/${num}`)
  const html = await res.text()
  const variants = {}
  const embedsM = html.match(/embeds:\{([\s\S]*?)\},downloads:/)
  if (embedsM) {
    const vRe = /(SUB|DUB):\[([\s\S]*?)\]/g
    let vM
    while ((vM = vRe.exec(embedsM[1])) !== null) {
      const servers = []
      const sRe = /\{server:"([^"]+)",url:"([^"]+)"\}/g
      let srvM
      while ((srvM = sRe.exec(vM[2])) !== null) {
        servers.push({ server: srvM[1], url: srvM[2] })
      }
      const ranked = await rankServers(cleanServers(servers))
      if (ranked.length) variants[vM[1]] = ranked
    }
  }
  if (!Object.keys(variants).length) throw new Error('Episodio sin servidores')
  let animeTitle = slug
  const tRe = new RegExp(`<a[^>]+href="/media/${slug}"[^>]*>([^<]{1,80})<\\/a>`, 'g')
  let tM
  while ((tM = tRe.exec(html)) !== null) {
    const t = decodeHtml(tM[1].trim())
    if (t && !t.includes('<')) {
      animeTitle = t
      break
    }
  }
  let prev = num > 1 ? num - 1 : null
  let next = null
  const navRe = new RegExp(
    `<a[^>]*href="/media/${slug}/(\\d+)"[^>]*>(?:[^<]|<[^>]+>)*?(Anterior|Siguiente)`,
    'g'
  )
  let nM
  while ((nM = navRe.exec(html)) !== null) {
    if (nM[2] === 'Anterior') prev = Number(nM[1])
    else next = Number(nM[1])
  }
  return { slug, animeTitle, episode: num, variants, prev, next }
}

export async function animeEpisode(slug, n) {
  if (!validSlug(slug)) throw new Error('Slug inválido')
  const num = parseInt(n, 10)
  if (!num || num < 1 || num > 5000) throw new Error('Episodio inválido')
  const key = `anime:ep:${slug}:${num}`
  const hit = getMemo(key, TTL_EPISODE)
  if (hit) return hit
  let data
  try {
    data = await episodeJson(slug, num)
  } catch (e) {
    if (/sin servidores/i.test(e.message)) throw e
    data = await episodeHtml(slug, num) // fallback HTML
  }
  setMemo(key, data)
  return data
}

// ---------- Géneros (mapa dinámico del sitio) ----------

export async function animeGenres() {
  const key = 'anime:genres'
  const hit = getMemo(key, TTL_GENRES)
  if (hit) return hit
  const data = await fetchPageData('/catalogo')
  const root = resolveDevalue(data)
  const map = root?.genresIdsMap || {}
  const genres = Object.values(map)
    .filter((g) => g && g.slug)
    .map((g) => ({ slug: g.slug, label: g.name || g.slug }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es'))
  if (!genres.length) throw new Error('AnimeAV1 sin géneros')
  const out = { genres }
  setMemo(key, out)
  return out
}

// ---------- Últimos episodios (home del sitio) ----------

export async function animeLatest(limit = 24) {
  const key = `anime:latest:${limit}`
  const hit = getMemo(key, TTL_LATEST)
  if (hit) return hit
  const data = await fetchPageData('/')
  const root = resolveDevalue(data)
  const list = Array.isArray(root?.latestEpisodes) ? root.latestEpisodes : []
  if (!list.length) throw new Error('AnimeAV1 sin novedades')
  const items = list
    .filter((e) => e?.media?.slug && Number(e.number) >= 1)
    .slice(0, Math.min(Math.max(limit, 1), 48))
    .map((e) => ({
      slug: e.media.slug,
      title: e.media.title || e.media.slug,
      episode: Number(e.number),
      screenshot: shotOf(e.media.id, Number(e.number)),
      publishedAt: e.publishedAt || null,
    }))
  const recent = (Array.isArray(root?.latestMedia) ? root.latestMedia : [])
    .filter((a) => a?.slug)
    .slice(0, 12)
    .map((a) => ({
      slug: a.slug,
      title: a.title || a.slug,
      cover: coverOf(a.id),
      type: a.category?.name || null,
    }))
  const out = { items, recent }
  setMemo(key, out)
  return out
}

// ---------- Handlers Express (montados bajo /anime en api/index.js) ----------

function sendError(res, e) {
  const notFound = /no encontrado/i.test(e.message)
  const bad = /inválido/i.test(e.message)
  res
    .status(notFound ? 404 : bad ? 400 : 502)
    .json({ error: bad || notFound ? e.message : 'AnimeAV1 no respondió' })
}

export async function handleAnimeCatalog(req, res) {
  try {
    const { page = '1', genre = '', search = '' } = req.query
    res.json(await animeCatalog({ page, genre, search }))
  } catch (e) {
    sendError(res, e)
  }
}

export async function handleAnimeSearch(req, res) {
  try {
    const q = (req.query.q || '').trim()
    if (!q) return res.json({ items: [] })
    const { items } = await animeCatalog({ search: q })
    res.json({ items })
  } catch (e) {
    sendError(res, e)
  }
}

export async function handleAnimeInfo(req, res) {
  try {
    res.json(await animeInfo(req.params.slug))
  } catch (e) {
    sendError(res, e)
  }
}

export async function handleAnimeEpisode(req, res) {
  try {
    res.json(await animeEpisode(req.params.slug, req.params.n))
  } catch (e) {
    sendError(res, e)
  }
}

export async function handleAnimeGenres(req, res) {
  try {
    res.json(await animeGenres())
  } catch (e) {
    sendError(res, e)
  }
}

export async function handleAnimeLatest(req, res) {
  try {
    const limit = parseInt(req.query.limit, 10) || 24
    res.json(await animeLatest(limit))
  } catch (e) {
    sendError(res, e)
  }
}
