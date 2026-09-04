import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api.js'

const IMG_BASE = 'https://image.tmdb.org/t/p/w780'

export default function Detail({ type }) {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [season, setSeason] = useState(1)
  const [episodes, setEpisodes] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    setData(null)
    setError('')
    const p = type === 'movie' ? api.movie(id) : api.tv(id)
    p.then((d) => setData(d))
      .catch((e) => setError(e.message))
  }, [type, id])

  useEffect(() => {
    if (type !== 'tv' || !data || !data.seasons?.length) return
    // Cargar episodios de la temporada seleccionada
    api
      .tvSeason(id, season)
      .then((d) => setEpisodes(d.episodes || []))
      .catch(() => setEpisodes([]))
  }, [type, data, id, season])

  if (error) return <div className="pt-20 px-6 text-red-400">{error}</div>
  if (!data) return <div className="pt-20 px-6 text-gray-500">Cargando…</div>

  const title = data.title || data.name
  const year = (data.release_date || data.first_air_date || '').slice(0, 4)
  const backdrop = data.backdrop_path
    ? `${IMG_BASE}${data.backdrop_path}`
    : null

  return (
    <div className="pt-16">
      {/* Banner de fondo */}
      {backdrop && (
        <div
          className="relative h-[55vh] w-full bg-cover bg-center"
          style={{ backgroundImage: `url(${backdrop})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <div className="absolute bottom-8 px-6">
            <h1 className="mb-2 text-4xl font-black">{title}</h1>
            <p className="mb-3 text-sm text-gray-300">
              {year}
              {data.vote_average ? ` · ★ ${data.vote_average.toFixed(1)}` : ''}
            </p>
            <Link
              to={`/watch/${type}/${id}`}
              className="rounded bg-netflix px-8 py-2.5 font-semibold hover:bg-red-700"
            >
              ▶ Reproducir
            </Link>
          </div>
        </div>
      )}

      <div className="px-6 py-6">
        <p className="max-w-2xl text-gray-300">{data.overview}</p>
        {data.genres?.length > 0 && (
          <p className="mt-4 text-sm text-gray-400">
            Géneros: {data.genres.map((g) => g.name).join(', ')}
          </p>
        )}

        {/* Serie: selector de temporada + episodios */}
        {type === 'tv' && (
          <div className="mt-8">
            <div className="mb-4 flex flex-wrap gap-2">
              {data.seasons
                .filter((s) => s.season_number > 0)
                .map((s) => (
                  <button
                    key={s.season_number}
                    onClick={() => setSeason(s.season_number)}
                    className={`rounded px-4 py-1.5 text-sm ${
                      season === s.season_number
                        ? 'bg-netflix font-semibold'
                        : 'bg-surface hover:bg-gray-800'
                    }`}
                  >
                    Temporada {s.season_number}
                  </button>
                ))}
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {episodes.map((ep) => (
                <Link
                  key={ep.id}
                  to={`/watch/tv/${id}?season=${season}&episode=${ep.episode_number}`}
                  className="flex items-center gap-3 rounded bg-surface p-3 hover:bg-gray-800"
                >
                  {ep.still_path ? (
                    <img
                      src={`https://image.tmdb.org/t/p/w300${ep.still_path}`}
                      className="h-16 w-28 rounded object-cover"
                      alt=""
                    />
                  ) : (
                    <div className="flex h-16 w-28 items-center justify-center rounded bg-gray-800 text-2xl">
                      ▶
                    </div>
                  )}
                  <div>
                    <p className="font-semibold">
                      {ep.episode_number}. {ep.name}
                    </p>
                    <p className="line-clamp-2 text-xs text-gray-400">
                      {ep.overview}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
