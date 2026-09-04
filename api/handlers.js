// Handlers de la API (funciones puras, reutilizables en Express y serverless).
import { tmdb } from './tmdb.js'
import { resolveSources } from './sources.js'

// Home: varias filas de contenido
export async function handleTrending(req, res) {
  try {
    const [trendingMovies, trendingTv] = await Promise.all([
      tmdb.trendingMovies(),
      tmdb.trendingTv(),
    ])
    const trendingAll = [
      ...trendingMovies.map((m) => ({ ...m, media_type: 'movie' })),
      ...trendingTv.map((s) => ({ ...s, media_type: 'tv' })),
    ]
    res.json({
      sections: [
        { title: 'Películas populares', items: trendingMovies },
        { title: 'Series populares', items: trendingTv },
        { title: 'Destacados', items: trendingAll },
      ],
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

// Home completo (estilo cinehax): hero + top hoy + filas por red + géneros
export async function handleHome(req, res) {
  try {
    const [
      heroMovies,
      topMovies,
      topTv,
      netflix,
      prime,
      hbo,
      actionTv,
      comedyTv,
      scifiTv,
      mysteryTv,
    ] = await Promise.allSettled([
      tmdb.topMoviesToday(),                  // para el hero slider
      tmdb.topMoviesToday(),                  // top películas hoy
      tmdb.topTvToday(),                      // top series hoy
      tmdb.discoverByNetwork(213),            // Netflix
      tmdb.discoverByNetwork(1024),           // Prime Video
      tmdb.discoverByNetwork(49),             // HBO
      tmdb.discoverByGenre(10759, 'tv'),      // acción y aventura
      tmdb.discoverByGenre(35, 'tv'),         // comedia
      tmdb.discoverByGenre(10765, 'tv'),      // ciencia ficción y fantasía
      tmdb.discoverByGenre(9648, 'tv'),       // misterio
    ])

    const val = (r) => (r.status === 'fulfilled' ? r.value : [])
    const hero = val(heroMovies).slice(0, 10)

    res.json({
      hero,
      sections: [
        { title: 'Top películas hoy', items: val(topMovies), top: true, type: 'movie' },
        { title: 'Top series hoy', items: val(topTv), top: true, type: 'tv' },
        { title: 'Series de Netflix', items: val(netflix) },
        { title: 'Series de Prime Video', items: val(prime) },
        { title: 'Series de HBO', items: val(hbo) },
        { title: 'Acción y Aventura', items: val(actionTv) },
        { title: 'Comedia', items: val(comedyTv) },
        { title: 'Ciencia Ficción y Fantasía', items: val(scifiTv) },
        { title: 'Misterio', items: val(mysteryTv) },
      ],
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

// Búsqueda multi (películas + series)
export async function handleSearch(req, res) {
  try {
    const data = await tmdb.searchMulti(req.query.q || '')
    res.json(data)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

// Detalle de película
export async function handleMovie(req, res) {
  try {
    const data = await tmdb.movie(req.params.id)
    res.json(data)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

// Detalle de serie (incluye temporadas)
export async function handleTv(req, res) {
  try {
    const data = await tmdb.tv(req.params.id)
    res.json(data)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

// Episodios de una temporada
export async function handleTvSeason(req, res) {
  try {
    const data = await tmdb.tvSeason(req.params.id, req.params.season)
    res.json(data)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

// Fuente para reproducir una película
export async function handleWatchMovie(req, res) {
  try {
    const tmdbId = req.params.id
    const sources = await resolveSources({ type: 'movie', tmdbId })
    if (sources.length === 0) {
      return res
        .status(404)
        .json({ sources: [], message: 'No hay fuentes disponibles para esta película.' })
    }
    res.json({ sources })
  } catch (e) {
    res.status(500).json({ sources: [], error: e.message })
  }
}

// Fuente para reproducir un episodio
export async function handleWatchEpisode(req, res) {
  try {
    const { id, season, episode } = req.params
    const sources = await resolveSources({
      type: 'tv',
      tmdbId: id,
      season,
      episode,
    })
    if (sources.length === 0) {
      return res
        .status(404)
        .json({ sources: [], message: 'No hay fuentes disponibles para este episodio.' })
    }
    res.json({ sources })
  } catch (e) {
    res.status(500).json({ sources: [], error: e.message })
  }
}
