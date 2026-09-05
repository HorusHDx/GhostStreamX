// Sección Anime (aislada) — scraping server-side de AnimeAV1 (https://animeav1.com)
// Solo fetch + regex, SIN navegador: compatible con Vercel serverless.
// No toca el flujo existente (TMDB/S1/S2). Todo vive bajo /anime/*.
//
// Origen de datos (verificado contra el HTML real del sitio):
//   - Catálogo/búsqueda: /catalogo?page=N | /catalogo?search=q | /catalogo?genre=g
//     tarjetas <article class="group/item"> con cover cdn.animeav1.com/covers/*.jpg
//   - Ficha: /media/{slug} -> título, sinopsis ES, géneros, año, tipo, estado,
//     poster/backdrop, episodios (/media/{slug}/{n} + screenshots/{id}/{n}.jpg)
//   - Episodio: /media/{slug}/{n} -> payload SvelteKit con
//     embeds:{SUB:[{server,url}...]} listo para <iframe> (HLS, Voe, MP4Upload...)

const AV1 = 'https://animeav1.com'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'

const TTL_CATALOG = 30 * 60 * 1000 // 30min: el catálogo cambia poco
const TTL_INFO = 60 * 60 * 1000 // 1h: la ficha es estable (episodios nuevos tardan en notarse)
const TTL_EPISODE = 10 * 60 * 1000 // 10min: absorbe re-clics sin recargar al origen

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

async function fetchAv1(path) {
  const res = await fetch(`${AV1}${path}`, {
    headers: { 'User-Agent': UA, Accept: 'text/html' },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`AnimeAV1 respondió ${res.status}`)
  return res.text()
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

// ---------- Catálogo / búsqueda ----------

function parseCatalog(html) {
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
  // Deduplica por slug (la tarjeta trae link duplicado en el hover).
  const seen = new Set()
  return items.filter((it) => (seen.has(it.slug) ? false : (seen.add(it.slug), true)))
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
  const html = await fetchAv1(`/catalogo${qs ? `?${qs}` : ''}`)
  const items = parseCatalog(html)
  // Hay "siguiente" si el HTML enlaza a page+1 (vale para catálogo y géneros).
  const hasMore = search ? false : html.includes(`page=${p + 1}`)
  const data = { items, page: p, hasMore }
  setMemo(key, data)
  return data
}

// ---------- Ficha ----------

export async function animeInfo(slug) {
  if (!validSlug(slug)) throw new Error('Slug inválido')
  const key = `anime:info:${slug}`
  const hit = getMemo(key, TTL_INFO)
  if (hit) return hit
  const html = await fetchAv1(`/media/${slug}`)

  const titleM = html.match(/<h1[^>]*>([^<]+)<\/h1>/)
  if (!titleM) throw new Error('Anime no encontrado')
  const title = decodeHtml(titleM[1].trim())

  // Línea "TV Anime • 1999 • Temporada Otoño • En emisión" justo tras el h1.
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

  // Episodios: links /media/{slug}/{n} + captura screenshots/{id}/{n}.jpg
  const shots = new Map() // n -> screenshot url
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

  const data = {
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
    genres,
    episodes,
    // Ojo: la ficha SSR trae como máximo los primeros 50 (el resto carga por
    // dropdown JS). Si hay exactamente 50, el total real puede ser mayor.
    totalEpisodes: episodes.length ? episodes[episodes.length - 1].number : 0,
    episodeListTruncated: episodes.length === 50,
  }
  setMemo(key, data)
  return data
}

// ---------- Episodio (servidores embed) ----------

export async function animeEpisode(slug, n) {
  if (!validSlug(slug)) throw new Error('Slug inválido')
  const num = parseInt(n, 10)
  if (!num || num < 1 || num > 5000) throw new Error('Episodio inválido')
  const key = `anime:ep:${slug}:${num}`
  const hit = getMemo(key, TTL_EPISODE)
  if (hit) return hit
  const html = await fetchAv1(`/media/${slug}/${num}`)

  // Payload SvelteKit: embeds:{SUB:[{server:"HLS",url:"..."}...],DUB:[...]}
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
      if (servers.length) variants[vM[1]] = servers
    }
  }
  if (!Object.keys(variants).length) throw new Error('Episodio sin servidores')

  // Título del anime: primer anchor a /media/{slug} con texto.
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

  // Anterior / Siguiente (el label va dentro de un <span>; si está
  // deshabilitado viene como <button>, no como <a>).
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

  const data = { slug, animeTitle, episode: num, variants, prev, next }
  setMemo(key, data)
  return data
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
