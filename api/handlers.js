// Handlers de la API (funciones puras, reutilizables en Express y serverless).
import { tmdb } from './tmdb.js'
import { resolveSources } from './sources.js'
import { PLATAFORMAS } from './plataformas.js'

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
      disney,
      apple,
      paramount,
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
      tmdb.discoverByNetwork(49),             // HBO / Max
      tmdb.discoverByNetwork(2739),           // Disney+
      tmdb.discoverByNetwork(2552),           // Apple TV+
      tmdb.discoverByNetwork(158),            // Paramount+
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
        { title: 'Series de HBO y Max', items: val(hbo) },
        { title: 'Series de Disney+', items: val(disney) },
        { title: 'Series de Apple TV+', items: val(apple) },
        { title: 'Series de Paramount+', items: val(paramount) },
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

// Top por plataforma (para la fila interactiva del home)
// Devuelve, por cada red, sus series (items) y películas (movies).
export async function handlePlatforms(req, res) {
  const entry = (networkId, name, color) =>
    Promise.allSettled([
      tmdb.discoverByNetwork(networkId),                 // series
      tmdb.contenidoDeRed(networkId, 1, 'movie').then((r) => r.items), // películas
    ]).then(([tv, movies]) => ({
      name,
      color,
      items: tv.status === 'fulfilled' ? tv.value : [],          // series
      movies:
        movies.status === 'fulfilled'
          ? movies.value.map((m) => ({ ...m, media_type: 'movie' }))
          : [],                                                  // películas
    }))

  const results = await Promise.allSettled(
    Object.values(PLATAFORMAS).map((p) => entry(p.id, p.name, p.color))
  )

  const platforms = {}
  Object.keys(PLATAFORMAS).forEach((id, i) => {
    if (results[i].status === 'fulfilled') {
      platforms[id] = { ...results[i].value, networkId: PLATAFORMAS[id].id }
    }
  })

  res.json({ platforms })
}

// Página de una plataforma: películas + series de esa red, paginado.
export async function handlePlataforma(req, res) {
  const { id } = req.params
  const plat = PLATAFORMAS[id]
  if (!plat) {
    return res.status(404).json({ error: 'Plataforma desconocida' })
  }

  const page = Math.max(1, parseInt(req.query.page, 10) || 1)

  try {
    const [tv, movies] = await Promise.allSettled([
      tmdb.contenidoDeRed(plat.id, page, 'tv'),
      tmdb.contenidoDeRed(plat.id, page, 'movie'),
    ])

    const ok = (r) => (r.status === 'fulfilled' ? r.value : { items: [], total_pages: 0 })

    const tvData = ok(tv)
    const movieData = ok(movies)

    // Intercalar ambos con su media_type
    const items = [
      ...movieData.items.map((i) => ({ ...i, media_type: 'movie' })),
      ...tvData.items.map((i) => ({ ...i, media_type: 'tv' })),
    ]

    res.json({
      key: id,
      ...plat,
      page,
      items,
      total_pages: Math.max(tvData.total_pages, movieData.total_pages),
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
