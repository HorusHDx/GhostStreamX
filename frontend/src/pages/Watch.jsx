import { useEffect, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { api } from '../api.js'
import Player from '../components/Player.jsx'

const HISTORY_KEY = 'ghoststreamx_history'

function saveProgress(key, seconds) {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    const map = raw ? JSON.parse(raw) : {}
    map[key] = {
      t: Date.now(),
      position: Math.round(seconds),
    }
    localStorage.setItem(HISTORY_KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}

export default function Watch({ type }) {
  const { id } = useParams()
  const [params] = useSearchParams()
  const season = params.get('season') || ''
  const episode = params.get('episode') || ''

  const [source, setSource] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    setSource(null)
    setError('')
    const p =
      type === 'movie'
        ? api.watchMovie(id)
        : season && episode
          ? api.watchEpisode(id, season, episode)
          : Promise.resolve({ sources: [], message: 'Faltan temporada/episodio' })

    p.then((data) => {
      const s = pickSource(data)
      setSource(s ? { kind: s.kind, src: s.url || s.embed } : null)
      if (!s) setError(data.message || 'No se encontró una fuente disponible.')
    })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [type, id, season, episode])

  return (
    <div className="pt-20 px-6">
      <Link
        to={type === 'movie' ? `/movie/${id}` : `/tv/${id}`}
        className="mb-4 text-sm text-gray-400 hover:text-white"
      >
        ← Volver al detalle
      </Link>

      {/* Guardar un "continuar viendo" aproximado (al entrar) */}
      <ProgressTracker
        enabled={!!source}
        getPosition={() => 0}
      />

      {loading && (
        <div className="flex aspect-video w-full items-center justify-center bg-black text-gray-500">
          Resolviendo fuente…
        </div>
      )}

      {!loading && error && (
        <div className="rounded border border-red-900 bg-red-950/40 p-4 text-red-300">
          {error}
        </div>
      )}

      {!loading && !error && source && (
        <div className="mx-auto max-w-5xl">
          <h1 className="mb-4 text-xl font-semibold">
            Reproduciendo
            {type === 'tv' && season && episode
              ? ` · Temporada ${season} - Episodio ${episode}`
              : ''}
          </h1>
          <Player source={source} />
        </div>
      )}
    </div>
  )
}

// Elige la primera fuente disponible del backend (ya ordenada por prioridad).
function pickSource(data) {
  if (!data || !data.sources || data.sources.length === 0) return null
  return data.sources[0]
}

// Registra en historial cuando el usuario mira algo.
function ProgressTracker({ enabled, getPosition }) {
  const { id } = useParams()
  const [params] = useSearchParams()
  const season = params.get('season') || ''
  const episode = params.get('episode') || ''
  const mediaType = window.location.pathname.includes('/movie/') ? 'movie' : 'tv'

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return
    const key = `${mediaType}:${id}:${season}:${episode}`
    saveProgress(key, getPosition())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  return null
}
