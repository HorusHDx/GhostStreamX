const BASE = '/api'

async function get(path) {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText}`)
  }
  return res.json()
}

export const api = {
  // Filas para el home
  trending: () => get('/trending'),

  // Búsqueda (películas + series)
  search: (q) => get(`/search?q=${encodeURIComponent(q)}`),

  // Detalles
  movie: (id) => get(`/movie/${id}`),
  tv: (id) => get(`/tv/${id}`),
  tvSeason: (id, season) => get(`/tv/${id}/season/${season}`),

  // Fuentes de reproducción (embed / m3u8)
  watchMovie: (id) => get(`/watch/movie/${id}`),
  watchEpisode: (id, season, episode) =>
    get(`/watch/tv/${id}/${season}/${episode}`),
}
