import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { api } from '../api.js'
import Player from '../components/Player.jsx'

const HISTORY_KEY = 'ghoststreamx_history'

function saveProgress(key, seconds, meta = {}) {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    const map = raw ? JSON.parse(raw) : {}
    map[key] = {
      t: Date.now(),
      position: Math.round(seconds),
      ...meta,
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

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sources, setSources] = useState([])
  const [selected, setSelected] = useState(null)
  const [meta, setMeta] = useState({})

  useEffect(() => {
    setLoading(true)
    setError('')
    setSources([])
    setSelected(null)
    setMeta({})

    const p =
      type === 'movie'
        ? api.watchMovie(id)
        : season && episode
          ? api.watchEpisode(id, season, episode)
          : Promise.resolve({ sources: [], message: 'Faltan temporada/episodio' })

    p.then((data) => {
      const list = data.sources || []
      if (list.length === 0) {
        setError(data.message || 'No se encontró una fuente disponible.')
        return
      }
      setSources(list)
      setSelected(list[0])
    })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))

    // Obtiene metadata (título/poster) para "Continuar viendo"
    const metaP =
      type === 'movie'
        ? api.movie(id)
        : api.tv(id)
    metaP
      .then((d) =>
        setMeta({
          title: d.title || d.name,
          poster: d.poster_path,
        })
      )
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, id, season, episode])

  // Agrupa las fuentes por idioma para armar los selects.
  const byLanguage = useMemo(() => {
    const map = new Map()
    for (const s of sources) {
      const key = s.language || 'server'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(s)
    }
    return map
  }, [sources])

  return (
    <div className="pt-20 px-6">
      <Link
        to={type === 'movie' ? `/movie/${id}` : `/tv/${id}`}
        className="mb-4 text-sm text-gray-400 hover:text-white"
      >
        ← Volver al detalle
      </Link>

      <ProgressTracker enabled={!!selected} getPosition={() => 0} meta={meta} />

      {loading && (
        <div className="flex aspect-video w-full items-center justify-center bg-black text-gray-500">
          Resolviendo fuentes…
        </div>
      )}

      {!loading && error && (
        <div className="rounded border border-red-900 bg-red-950/40 p-4 text-red-300">
          {error}
        </div>
      )}

      {!loading && !error && selected && (
        <div className="mx-auto max-w-5xl">
          <h1 className="mb-4 text-xl font-semibold">
            Reproduciendo
            {type === 'tv' && season && episode
              ? ` · Temporada ${season} - Episodio ${episode}`
              : ''}
          </h1>

          {/* Selector de servidor */}
          <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
            <select
              value={selected?.language || ''}
              onChange={(e) => {
                const group = byLanguage.get(e.target.value)
                if (group && group.length > 0) setSelected(group[0])
              }}
              className="rounded border border-gray-700 bg-gray-900 px-3 py-1.5 text-gray-200 outline-none focus:border-red-600"
            >
              {[...byLanguage.keys()].map((lang) => (
                <option key={lang} value={lang}>
                  {lang === 'server' ? 'Servidores' : lang}
                </option>
              ))}
            </select>

            <select
              value={selected?.url || ''}
              onChange={(e) => {
                const s = sources.find((x) => x.url === e.target.value)
                if (s) setSelected(s)
              }}
              className="rounded border border-gray-700 bg-gray-900 px-3 py-1.5 text-gray-200 outline-none focus:border-red-600"
            >
              {(byLanguage.get(selected?.language) || []).map((s) => (
                <option key={s.url} value={s.url}>
                  {s.name}
                </option>
              ))}
            </select>
            <span className="text-xs text-gray-500">
              {selected.label || selected.name}
            </span>
          </div>

          <Player source={selected} />
        </div>
      )}
    </div>
  )
}

function ProgressTracker({ enabled, getPosition, meta }) {
  const { id } = useParams()
  const [params] = useSearchParams()
  const season = params.get('season') || ''
  const episode = params.get('episode') || ''
  const mediaType = window.location.pathname.includes('/movie/') ? 'movie' : 'tv'

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return
    const key = `${mediaType}:${id}:${season}:${episode}`
    saveProgress(key, getPosition(), {
      mediaType,
      id,
      season,
      episode,
      title: meta.title,
      poster: meta.poster,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, meta.title, meta.poster])

  return null
}
