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

// Rutas de la API
app.get('/api/trending', handleTrending)
app.get('/api/search', handleSearch)
app.get('/api/movie/:id', handleMovie)
app.get('/api/tv/:id', handleTv)
app.get('/api/tv/:id/season/:season', handleTvSeason)
app.get('/api/watch/movie/:id', handleWatchMovie)
app.get('/api/watch/tv/:id/:season/:episode', handleWatchEpisode)

app.get('/api/health', (_req, res) => res.json({ ok: true }))

const PORT = process.env.PORT || 3001

// Si lo importa Vercel (serverless), exportamos el app express.
export default app

// Si se ejecuta directamente, arranca el servidor local.
if (!process.env.VERCEL) {
  app.listen(PORT, () =>
    console.log(`API GhostStreamX escuchando en http://localhost:${PORT}`)
  )
}
