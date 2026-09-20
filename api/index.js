// Backend / proxy para GhostStreamX
// - Funciona como servidor Express local (npm run dev:api)
// - Y como función serverless en Vercel (a través de vercel.json + este archivo)
// Estructura:
//   handlers/  -> funciones puras (Node-fetch) usables tanto en Express como en serverless
//   index.js   -> monta Express localmente
// Para Vercel usamos vercel.json con `"builds": [{ "src": "api/index.js", ... }]`
// y este archivo exporta un handler compat con Express.

import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import {
  handleHome,
  handlePlatforms,
  handlePlataforma,
  handleSearch,
  handleMovie,
  handleTv,
  handleTvSeason,
  handleMovieRecs,
  handleTvRecs,
  handleWatchMovie,
  handleWatchEpisode,
} from './handlers.js'

import {
  handleAnimeCatalog,
  handleAnimeSearch,
  handleAnimeGenres,
  handleAnimeLatest,
  handleAnimeTop,
  handleAnimeInfo,
  handleAnimeEpisode,
} from './anime.js'

const app = express()
app.use(cors())
app.use(express.json())

// Caché en el edge de Vercel: las respuestas exitosas estables se sirven
// desde el CDN (s-maxage) y se revalidan en segundo plano. En local no
// tiene efecto. Los errores (4xx/5xx) nunca se cachean.
const EDGE_TTL = [
  ['/anime/info/', 3600],
  ['/anime/catalog', 1800],
  ['/anime/search', 600],
  ['/anime/genres', 86400],
  ['/anime/latest', 900],
  ['/anime/top', 21600],
  ['/anime/episode/', 600],
  ['/home', 3600],
  ['/platforms', 3600],
  ['/plataforma/', 3600],
  ['/search', 600],
  ['/movie/', 86400],
  ['/tv/', 86400],
  ['/watch/', 600],
]
function edgeCache(req, res, next) {
  const origJson = res.json.bind(res)
  res.json = (body) => {
    if (res.statusCode < 400) {
      // Normaliza por si la ruta llega con el prefijo /api incluido.
      const p = (req.path || '').replace(/^\/api/, '') || '/'
      const hit = EDGE_TTL.find(([prefix]) => p.startsWith(prefix))
      if (hit) {
        res.set(
          'Cache-Control',
          `public, s-maxage=${hit[1]}, stale-while-revalidate=${Math.min(hit[1], 600)}`
        )
      }
    }
    return origJson(body)
  }
  next()
}

// Router con las rutas de la API (SIN prefijo /api).
// Se monta bajo `/api` tanto local como en Vercel, para evitar ambigüedades
// en cómo Vercel pasa la ruta a la función Express.
const api = express.Router()

api.get('/home', handleHome)
api.get('/platforms', handlePlatforms)
api.get('/plataforma/:id', handlePlataforma)
api.get('/search', handleSearch)
api.get('/movie/:id', handleMovie)
api.get('/tv/:id', handleTv)
api.get('/tv/:id/season/:season', handleTvSeason)
api.get('/movie/:id/recommendations', handleMovieRecs)
api.get('/tv/:id/recommendations', handleTvRecs)
api.get('/watch/movie/:id', handleWatchMovie)
api.get('/watch/tv/:id/:season/:episode', handleWatchEpisode)
// Sección Anime (aislada): scraping server-side de AnimeAV1.
// Ojo: /genres y /latest van ANTES de /info/:slug para que Express no los
// capture como slug.
api.get('/anime/catalog', handleAnimeCatalog)
api.get('/anime/search', handleAnimeSearch)
api.get('/anime/genres', handleAnimeGenres)
api.get('/anime/latest', handleAnimeLatest)
api.get('/anime/top', handleAnimeTop)
api.get('/anime/info/:slug', handleAnimeInfo)
api.get('/anime/episode/:slug/:n', handleAnimeEpisode)
api.get('/health', (_req, res) => res.json({ ok: true }))

// Montamos bajo `/api`. Si Vercel le pasa la ruta ya sin el prefijo
// (porque la función cuelga de /api), también respondemos en la raíz.
app.use('/api', edgeCache, api)
app.use(edgeCache, api)

const PORT = process.env.PORT || 3001

// Si lo importa Vercel (serverless), exportamos el app express.
export default app

// Si se ejecuta directamente, arranca el servidor local.
if (!process.env.VERCEL) {
  app.listen(PORT, () =>
    console.log(`API GhostStreamX escuchando en http://localhost:${PORT}`)
  )
}
