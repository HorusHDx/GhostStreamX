const BASE = '/api'

async function get(path) {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText}`)
  }
  return res.json()
}

export const api = {
  // Home completo (hero + top + géneros)
  home: () => get('/home'),

  // Top por plataforma (fila interactiva)
  platforms: () => get('/platforms'),

  // Contenido completo de una plataforma (página dedicada)
  plataforma: (key, page = 1) => get(`/plataforma/${key}?page=${page}`),

  // Búsqueda (películas + series)
  search: (q) => get(`/search?q=${encodeURIComponent(q)}`),

  // Detalles
  movie: (id) => get(`/movie/${id}`),
  tv: (id) => get(`/tv/${id}`),
  tvSeason: (id, season) => get(`/tv/${id}/season/${season}`),

  // Recomendados reales (secuelas, saga, similares)
  movieRecs: (id) => get(`/movie/${id}/recommendations`),
  tvRecs: (id) => get(`/tv/${id}/recommendations`),

  // Fuentes de reproducción (embed / m3u8)
  watchMovie: (id) => get(`/watch/movie/${id}`),
  watchEpisode: (id, season, episode) =>
    get(`/watch/tv/${id}/${season}/${episode}`),

  // Resuelve un servidor S2 (bajo demanda al elegirlo)
  nsrResolve: (server, token) =>
    get(`/watch/nsr/resolve?server=${encodeURIComponent(server)}&token=${encodeURIComponent(token)}`),

  // Sección Anime (aislada, fuente AnimeAV1)
  anime: {
    catalog: (page = 1, genre = '') =>
      get(`/anime/catalog?page=${page}${genre ? `&genre=${encodeURIComponent(genre)}` : ''}`),
    search: (q) => get(`/anime/search?q=${encodeURIComponent(q)}`),
    info: (slug) => get(`/anime/info/${encodeURIComponent(slug)}`),
    episode: (slug, n) => get(`/anime/episode/${encodeURIComponent(slug)}/${n}`),
  },
}
