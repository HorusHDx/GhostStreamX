// server/scrapers/nsrplay.js
// Fuente agregadora NasriPlay (nsrplay.space) resuelta por TMDB ID.
//
// ⚠️ EXCEPCIÓN ÚNICA a la regla del proyecto "solo scraping directo propio":
//    NasriPlay es una API de terceros que indexa proveedores públicos (no
//    aloja video). Fue aprobada explícitamente por el usuario como Servidor 5.
//
// Flujo (verificado en vivo, v1.3.5):
//   Película: GET /api/v1/embed/sources/movie/{tmdbId}?fast=true
//   Serie:    GET /api/v1/embed/sources/tv/{tmdbId}/{season}/{episode}?fast=true
//     -> { success, meta, servers: [{ name, server, playUrl, language, ... }] }
//   SOLO los servers que ya traen playUrl (stream-proxy de ellos, HLS m3u8,
//   CORS *). Los demás (streamtape/streamwish/voesx) solo traen un token y
//   exigen /embed/resolve por server: se dejan fuera a propósito. Cada
//   resolución extra = 1 request más, y sus changelogs banean IPs por
//   barridos; con playUrl directo respetamos "1 visita real = 1 pedido".
//   Se devuelve como fuente kind:'direct': Player.jsx la reproduce con hls.js
//   (el token del proxy no termina en .m3u8 => nativo falla => hls.js retoma).
//
// Seguridad / política:
//   - La API Key vive SOLO en Vercel como NSRPLAY_API_KEY. NUNCA en el repo
//     (repo público + las reglas de ellos prohíben publicar keys en front).
//   - Un request por reproducción, sin escaneo: respeta sus límites y el
//     baneo automático de IPs por barridos masivos.
//   - SIN caché: los tokens de playUrl son de un solo uso (~5 min).

const API = 'https://nsrplay.space'
const TIMEOUT = 20000

export async function resolveNsrPlay({ type, tmdbId, season = 1, episode = 1 }) {
  if (!tmdbId) return []
  const key = process.env.NSRPLAY_API_KEY || ''
  if (!key) return []

  const path =
    type === 'movie'
      ? `/api/v1/embed/sources/movie/${encodeURIComponent(tmdbId)}?fast=true`
      : `/api/v1/embed/sources/tv/${encodeURIComponent(tmdbId)}/${encodeURIComponent(
          season
        )}/${encodeURIComponent(episode)}?fast=true`

  let json = null
  try {
    const res = await fetch(`${API}${path}`, {
      headers: { 'x-api-key': key, accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT),
    })
    if (!res.ok) return []
    json = await res.json()
  } catch {
    return []
  }

  if (!json || json.success !== true || !Array.isArray(json.servers)) {
    return []
  }

  const seen = new Set()
  const count = {}
  const sources = []
  for (const s of json.servers) {
    // Con fast=true pueden venir servers sin datos o con proxy muerto: filtrar.
    if (!s || !s.playUrl || !s.server) continue
    if (seen.has(s.playUrl)) continue
    seen.add(s.playUrl)

    const host = String(s.server).trim()
    const base = host.charAt(0).toUpperCase() + host.slice(1)
    count[base] = (count[base] || 0) + 1
    const name = count[base] > 1 ? `${base} ${count[base]}` : base
    const lang = s.language || null

    sources.push({
      name,
      label: `NasriPlay · ${name}${lang ? ` · ${lang}` : ''}`,
      provider: 'NasriPlay',
      language: lang,
      kind: 'direct',
      url: s.playUrl,
    })
  }
  return sources
}