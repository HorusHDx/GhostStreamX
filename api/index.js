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
  handleTrending,
  handleHome,
  handlePlatforms,
  handlePlataforma,
  handleSearch,
  handleMovie,
  handleTv,
  handleTvSeason,
  handleWatchMovie,
  handleWatchEpisode,
} from './handlers.js'

const app = express()
app.use(cors())
app.use(express.json())

// Router con las rutas de la API (SIN prefijo /api).
// Se monta bajo `/api` tanto local como en Vercel, para evitar ambigüedades
// en cómo Vercel pasa la ruta a la función Express.
const api = express.Router()

api.get('/trending', handleTrending)
api.get('/home', handleHome)
api.get('/platforms', handlePlatforms)
api.get('/plataforma/:id', handlePlataforma)
api.get('/search', handleSearch)
api.get('/movie/:id', handleMovie)
api.get('/tv/:id', handleTv)
api.get('/tv/:id/season/:season', handleTvSeason)
api.get('/watch/movie/:id', handleWatchMovie)
api.get('/watch/tv/:id/:season/:episode', handleWatchEpisode)
api.get('/health', (_req, res) => res.json({ ok: true }))

// Montamos bajo `/api`. Si Vercel le pasa la ruta ya sin el prefijo
// (porque la función cuelga de /api), también respondemos en la raíz.
app.use('/api', api)
app.use(api)

const PORT = process.env.PORT || 3001

// Si lo importa Vercel (serverless), exportamos el app express.
export default app

// Si se ejecuta directamente, arranca el servidor local.
if (!process.env.VERCEL) {
  app.listen(PORT, () =>
    console.log(`API GhostStreamX escuchando en http://localhost:${PORT}`)
  )
}
