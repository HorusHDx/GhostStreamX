// Handlers de la API (funciones puras, reutilizables en Express y serverless).
import { tmdb } from './tmdb.js'
import { resolveSources } from './sources.js'
import { PLATAFORMAS } from './plataformas.js'

// Home: varias filas de contenido

// Home completo (estilo cinehax): hero + top hoy + géneros.
// Las filas por red las cubre /platforms, así que /home solo trae 7 llamadas.
export async function handleHome(req, res) {
  try {
    const [
      heroMovies,
      topMovies,
      topTv,
      actionTv,
      comedyTv,
      scifiTv,
      mysteryTv,
    ] = await Promise.allSettled([
      tmdb.topMoviesToday(),                  // para el hero slider
      tmdb.topMoviesToday(),                  // top películas hoy
      tmdb.topTvToday(),                      // top series hoy
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

// Top por plataforma (para la fila interactiva del home).
// Solo series: los IDs de plataforma son IDs de red de TV (`with_networks`),
// que TMDB no acepta en /discover/movie. Devuelve 6 llamadas en vez de 12.
export async function handlePlatforms(req, res) {
  const entry = (networkId, name, color) =>
    tmdb
      .discoverByNetwork(networkId)
      .then((items) => ({ name, color, items, movies: [] }))
      .catch(() => ({ name, color, items: [], movies: [] }))

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

// Página de una plataforma: solo series de esa red, paginado.
// (TMDB no acepta `with_networks` en /discover/movie, así que las películas
// por red no son fiables; la fila "Top por plataforma" también es series.)
export async function handlePlataforma(req, res) {
  const { id } = req.params
  const plat = PLATAFORMAS[id]
  if (!plat) {
    return res.status(404).json({ error: 'Plataforma desconocida' })
  }

  const page = Math.max(1, parseInt(req.query.page, 10) || 1)

  try {
    const data = await tmdb.contenidoDeRed(plat.id, page, 'tv')

    res.json({
      key: id,
      ...plat,
      page,
      items: data.items.map((i) => ({ ...i, media_type: 'tv' })),
      total_pages: data.total_pages,
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

// Recomendados de una película (secuelas, saga, similares)
export async function handleMovieRecs(req, res) {
  try {
    const items = await tmdb.recommendations('movie', req.params.id)
    res.json({ items: items.map((i) => ({ ...i, media_type: 'movie' })) })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

// Recomendados de una serie (temporadas, spin-offs, similares)
export async function handleTvRecs(req, res) {
  try {
    const items = await tmdb.recommendations('tv', req.params.id)
    res.json({ items: items.map((i) => ({ ...i, media_type: 'tv' })) })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

// Resuelve un servidor S2 (name+token) a su URL reproducible.
// Lo llama el front al elegir el servidor (bajo demanda, cacheado).
export async function handleNsrResolve(req, res) {
  try {
    const { server, token } = req.query
    if (!server || !token) {
      return res.status(400).json({ error: 'Faltan server y token' })
    }
    const { resolveNsrToken } = await import('./nsrplay.js')
    const r = await resolveNsrToken(server, token)
    if (!r || !r.url) {
      return res.status(404).json({ error: 'No se pudo resolver el servidor' })
    }
    res.json(r)
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
