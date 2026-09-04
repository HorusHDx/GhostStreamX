import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'

const IMG = 'https://image.tmdb.org/t/p/w500'
const ORDER = ['netflix', 'prime', 'hbo', 'disney', 'apple', 'paramount']

// Fila interactiva "Top por plataforma" con tabs de red, toggle Serie/Película,
// modo "Más vistas"/"Mejor calificadas" y botón "Ver más".
export default function TopPorPlataforma() {
  const trackRef = useRef(null)
  const [platforms, setPlatforms] = useState(null)
  const [active, setActive] = useState('netflix')
  const [tipo, setTipo] = useState('series') // 'series' | 'peliculas'
  const [mode, setMode] = useState('vistas')

  const scrollTrack = (dir) =>
    trackRef.current?.scrollBy({ left: dir * 420, behavior: 'smooth' })

  useEffect(() => {
    api
      .platforms()
      .then((d) => {
        const first = ORDER.find((k) => d.platforms[k])
        if (first) setActive(first)
        setPlatforms(d.platforms)
      })
      .catch(() => setPlatforms({}))
  }, [])

  if (!platforms) {
    return (
      <div className="mb-12 px-5 md:px-12">
        <h2 className="mb-4 font-display text-2xl font-bold">Top por plataforma</h2>
        <div className="h-48 animate-pulse rounded-xl bg-surface/60" />
      </div>
    )
  }

  const current = platforms[active]
  const pool = tipo === 'series' ? current?.items || [] : current?.movies || []
  const items = pool
    .slice()
    .sort((a, b) =>
      mode === 'calificacion'
        ? (b.vote_average || 0) - (a.vote_average || 0)
        : (b.popularity || 0) - (a.popularity || 0)
    )
    .slice(0, 10)

  const verMasTipo =
    tipo === 'peliculas'
      ? '?tipo=movie'
      : tipo === 'series'
        ? '?tipo=tv'
        : ''

  return (
    <section className="relative z-10 mb-12">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-4 px-5 md:px-12">
        <h2 className="font-display text-2xl font-bold">Top por plataforma</h2>

        <div className="flex flex-wrap items-center gap-3">
          {/* Toggle Serie/Película */}
          <div className="flex gap-1 rounded-[20px] border border-white/10 bg-white/5 p-1">
            {[
              { id: 'series', label: 'Series' },
              { id: 'peliculas', label: 'Películas' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTipo(t.id)}
                className={`rounded-[16px] px-4 py-1.5 text-[0.85rem] transition ${
                  tipo === t.id
                    ? 'bg-spectral-dim text-spectral'
                    : 'text-dimtext hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Toggle modo */}
          <div className="flex gap-1 rounded-[20px] border border-white/10 bg-white/5 p-1">
            {[
              { id: 'vistas', label: 'Más vistas' },
              { id: 'calificacion', label: 'Mejor calificadas' },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`rounded-[16px] px-4 py-1.5 text-[0.85rem] transition ${
                  mode === m.id
                    ? 'bg-spectral-dim text-spectral'
                    : 'text-dimtext hover:text-white'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Ver más */}
          {current && (
            <Link
              to={`/plataforma/${active}${verMasTipo}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-spectral-dim px-4 py-2 text-[0.85rem] font-semibold text-spectral transition hover:bg-spectral-dim"
            >
              Ver más
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M7 17 17 7M9 7h8v8" />
              </svg>
            </Link>
          )}

          {/* Flechas de desplazamiento */}
          <div className="hidden gap-2 md:flex">
            <button
              onClick={() => scrollTrack(-1)}
              aria-label="Anterior"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-dimtext transition hover:bg-white/10 hover:text-white"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
            <button
              onClick={() => scrollTrack(1)}
              aria-label="Siguiente"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-dimtext transition hover:bg-white/10 hover:text-white"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs de plataforma */}
      <div className="mb-6 flex gap-7 overflow-x-auto px-5 no-scrollbar md:px-12">
        {ORDER.filter((k) => platforms[k]).map((k) => (
          <button
            key={k}
            onClick={() => setActive(k)}
            className={`relative flex shrink-0 items-center gap-2.5 whitespace-nowrap px-0.5 py-2.5 text-[0.94rem] transition ${
              active === k ? 'font-semibold text-white' : 'text-dimtext hover:text-white'
            }`}
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: platforms[k].color }}
            />
            {platforms[k].name}
            {active === k && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-spectral shadow-[0_0_8px_rgba(127,231,212,0.35)]" />
            )}
          </button>
        ))}
      </div>

      {/* Track */}
      <div
        ref={trackRef}
        className="flex gap-4 overflow-x-auto px-5 py-1.5 pb-4 no-scrollbar md:gap-2 md:px-12"
      >
        {items.map((item, i) => {
          const mediaType = item.media_type || (item.title ? 'movie' : 'tv')
          const poster = item.poster_path ? `${IMG}${item.poster_path}` : null
          return (
            <Link
              key={`${active}-${mediaType}-${item.id}`}
              to={`/${mediaType}/${item.id}`}
              className="group flex shrink-0 items-end"
            >
              <span
                className="z-[1] -mr-[18px] select-none font-display text-[6.5rem] font-extrabold leading-[0.8] tracking-[-0.04em] text-transparent transition-all duration-200 md:text-[7.5rem]"
                style={{ WebkitTextStroke: '2px rgba(255,255,255,0.18)' }}
              >
                {i + 1}
              </span>
              <div className="z-[2] flex flex-col gap-2.5">
                <div
                  className="h-[225px] w-[150px] overflow-hidden rounded-[10px] bg-cover bg-center shadow-[0_10px_24px_rgba(0,0,0,0.4)] transition-transform duration-200 group-hover:-translate-y-1.5 group-hover:shadow-[0_16px_34px_rgba(0,0,0,0.55),0_0_0_1px_rgba(127,231,212,0.35)]"
                  style={{
                    backgroundImage: poster ? `url(${poster})` : undefined,
                    backgroundColor: poster ? undefined : '#101319',
                  }}
                />
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[0.72rem] text-dimtext">
                    {mediaType === 'movie' ? 'Película' : 'Serie'}
                  </span>
                  {mode === 'calificacion' ? (
                    <span className="rounded-full border border-rating/25 bg-rating/8 px-2 py-0.5 text-[0.72rem] text-rating">
                      ★ {(item.vote_average || 0).toFixed(1)}
                    </span>
                  ) : (
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[0.72rem] text-dimtext">
                      Pop {item.popularity?.toFixed(0)}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
