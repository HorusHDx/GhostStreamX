import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api.js'
import PosterCard from '../components/PosterCard.jsx'

const IMG_BASE = 'https://image.tmdb.org/t/p/w780'

export default function Detail({ type }) {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [season, setSeason] = useState(1)
  const [episodes, setEpisodes] = useState([])
  const [recs, setRecs] = useState([])
  const [error, setError] = useState('')
  const recTrackRef = useRef(null)

  useEffect(() => {
    setData(null)
    setError('')
    setRecs([])
    const p = type === 'movie' ? api.movie(id) : api.tv(id)
    p.then((d) => setData(d))
      .catch((e) => setError(e.message))
    // Recomendados reales: secuelas, misma saga y similares.
    const r = type === 'movie' ? api.movieRecs(id) : api.tvRecs(id)
    r.then((d) =>
      setRecs(
        (d.items || []).filter((t) => String(t.id) !== String(id)).slice(0, 12)
      )
    ).catch(() => {})
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
  if (!data) return <div className="pt-20 px-6 text-dimtext">Cargando…</div>

  const title = data.title || data.name
  const year = (data.release_date || data.first_air_date || '').slice(0, 4)
  const backdrop = data.backdrop_path
    ? `${IMG_BASE}${data.backdrop_path}`
    : null

  // En series, "Reproducir" arranca en el primer episodio (S1E1).
  const firstSeason =
    type === 'tv'
      ? data.seasons?.filter((s) => s.season_number > 0)?.[0]?.season_number ?? 1
      : null
  const playTo =
    type === 'movie'
      ? `/watch/movie/${id}`
      : `/watch/tv/${id}?season=${firstSeason}&episode=1`

  return (
    <div className="pt-16">
      {/* Banner de fondo */}
      {backdrop && (
        <div
          className="relative h-[55vh] w-full bg-cover bg-center"
          style={{ backgroundImage: `url(${backdrop})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/60 to-transparent" />
          <div className="absolute bottom-8 px-6">
            <h1 className="mb-2 font-display text-4xl font-extrabold tracking-tight">{title}</h1>
            <p className="mb-4 text-sm text-dimtext">
              {year}
              {data.vote_average ? ` · ★ ${data.vote_average.toFixed(1)}` : ''}
            </p>
            <Link
              to={playTo}
              className="rounded-full bg-spectral px-8 py-2.5 font-semibold text-bg transition hover:brightness-110"
            >
              ▶ Reproducir
            </Link>
          </div>
        </div>
      )}

      <div className="px-6 py-6">
        <p className="max-w-2xl text-[#C7CBD4]">{data.overview}</p>
        {data.genres?.length > 0 && (
          <p className="mt-4 text-sm text-dimtext">
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
                    className={`rounded-full border px-4 py-1.5 text-sm transition ${
                      season === s.season_number
                        ? 'border-spectral-dim bg-spectral-dim font-semibold text-spectral'
                        : 'border-white/10 bg-white/5 text-dimtext hover:text-white'
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
                  className="flex items-center gap-3 rounded-[10px] border border-transparent bg-surface p-3 transition hover:border-white/10 hover:bg-surface-2"
                >
                  {ep.still_path ? (
                    <img
                      src={`https://image.tmdb.org/t/p/w300${ep.still_path}`}
                      className="h-16 w-28 rounded object-cover"
                      alt=""
                    />
                  ) : (
                    <div className="flex h-16 w-28 items-center justify-center rounded bg-surface-2 text-2xl">
                      ▶
                    </div>
                  )}
                  <div>
                    <p className="font-semibold">
                      {ep.episode_number}. {ep.name}
                    </p>
                    <p className="line-clamp-2 text-xs text-dimtext">
                      {ep.overview}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Recomendados: secuelas, saga y similares */}
        {recs.length > 0 && (
          <div className="mt-10">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="font-display text-[1.25rem] font-bold tracking-tight">
                También te puede interesar
              </h2>
              <div className="hidden gap-2 md:flex">
                <button
                  onClick={() => recTrackRef.current?.scrollBy({ left: -420, behavior: 'smooth' })}
                  aria-label="Anterior"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-dimtext transition hover:bg-white/10 hover:text-white"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m15 18-6-6 6-6" />
                  </svg>
                </button>
                <button
                  onClick={() => recTrackRef.current?.scrollBy({ left: 420, behavior: 'smooth' })}
                  aria-label="Siguiente"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-dimtext transition hover:bg-white/10 hover:text-white"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </button>
              </div>
            </div>
            <div ref={recTrackRef} className="flex gap-4 overflow-x-auto pb-1 no-scrollbar">
              {recs.map((item) => (
                <PosterCard key={`${item.media_type}-${item.id}`} item={item} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
