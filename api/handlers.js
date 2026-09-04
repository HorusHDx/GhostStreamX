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
