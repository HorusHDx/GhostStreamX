// Cliente de TMDB para metadata.
// Usa el fetch global (Node 18+), también disponible en el runtime serverless de Vercel.
const API_KEY = process.env.TMDB_API_KEY
const BASE = 'https://api.themoviedb.org/3'
const IMG = 'https://image.tmdb.org/t/p'

let memo = {}

async function call(path, params = {}) {
  if (!API_KEY) throw new Error('Falta TMDB_API_KEY en las variables de entorno')

  const url = new URL(`${BASE}${path}`)
  url.searchParams.set('api_key', API_KEY)
  url.searchParams.set('language', 'es-ES')
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, v)
  }

  const key = url.toString()
  if (memo[key] && Date.now() - memo[key].t < 5 * 60 * 1000) {
    return memo[key].data
  }

  const res = await fetch(url, {
    headers: { accept: 'application/json' },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`TMDB ${res.status}: ${text.slice(0, 200)}`)
  }
  const data = await res.json()
  memo[key] = { t: Date.now(), data }
  return data
}

// Redondea resultado de listas para el front (poster pequeño + backdrop para hero)
function trimList(obj, itemsKey = 'results') {
  const list = obj[itemsKey] || []
  return list.map((it) => ({
    id: it.id,
    media_type: it.media_type || (it.title ? 'movie' : 'tv'),
    title: it.title || it.name,
    release_date: it.release_date || it.first_air_date,
    poster_path: it.poster_path ? `${IMG}/w500${it.poster_path}` : null,
    backdrop_path: it.backdrop_path ? `${IMG}/w1280${it.backdrop_path}` : null,
    vote_average: it.vote_average,
    popularity: it.popularity || 0,
    overview: it.overview || '',
  }))
}

export const tmdb = {
  fromId: (id) => id,

  movie: (id) => call(`/movie/${id}`),
  tv: (id) => call(`/tv/${id}`),
  tvSeason: (id, season) => call(`/tv/${id}/season/${season}`),
  searchMulti: (q) => call('/search/multi', { query: q }),

  trending: async () => {
    const [movies, tv] = await Promise.all([
      call('/movie/popular'),
      call('/tv/popular'),
    ])
    return trimList(movies)
      .map((m) => ({ ...m, media_type: 'movie' }))
      .concat(trimList(tv).map((s) => ({ ...s, media_type: 'tv' })))
  },

  trendingMovies: () => call('/movie/popular').then(trimList),
  trendingTv: () => call('/tv/popular').then(trimList),

  // --- Top del día (trending) ---
  topMoviesToday: () => call('/trending/movie/day').then(trimList),
  topTvToday: () => call('/trending/tv/day').then(trimList),

  // --- Discovering por proveedor / red ---
  discoverByNetwork: (networkId) =>
    call('/discover/tv', { with_networks: networkId }).then(trimList),

  // --- Contenido completo de una red (películas + series), paginado ---
  async contenidoDeRed(networkId, page = 1, type = 'tv') {
    const data = await call(`/discover/${type}`, {
      with_networks: networkId,
      page,
    })
    return {
      items: trimList(data),
      page: data.page,
      total_pages: data.total_pages,
    }
  },

  // --- Discovering por género ---
  discoverByGenre: (genreId, type = 'tv') =>
    call(`/discover/${type}`, { with_genres: genreId }).then(trimList),

  // --- Riqueza para detalles/slider (incluye backdrop) ---
  detailMovie: (id) => call(`/movie/${id}`),
  detailTv: (id) => call(`/tv/${id}`),

  // --- Recomendados reales ("También te puede interesar") ---
  // Primero /recommendations (secuelas, misma saga, gustos afines);
  // si viene vacío, completa con /similar. Todo en español.
  async recommendations(type, id) {
    const path = type === 'movie' ? `/movie/${id}` : `/tv/${id}`
    const [recs, sim] = await Promise.allSettled([
      call(`${path}/recommendations`).then(trimList),
      call(`${path}/similar`).then(trimList),
    ])
    const list = recs.status === 'fulfilled' ? recs.value : []
    if (list.length > 0) return list
    return sim.status === 'fulfilled' ? sim.value : []
  },
}
