import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { loadHistory, watchPathFor } from '../history.js'

const IMG = 'https://image.tmdb.org/t/p/w500'

// Fila "Continuar viendo" usando el historial local con metadata.
// Se refresca al volver al inicio (por si se borró algo en /historial).
export default function ContinuarViendo() {
  const [items, setItems] = useState([])
  const location = useLocation()

  useEffect(() => {
    setItems(loadHistory().slice(0, 10))
  }, [location.pathname])

  if (items.length === 0) return null

  return (
    <section className="relative z-10 mb-12">
      <div className="mb-4 flex items-baseline justify-between px-5 md:px-12">
        <h2 className="font-display text-2xl font-bold">Continuar viendo</h2>
        <Link
          to="/historial"
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[0.85rem] text-dimtext transition hover:text-white"
        >
          Historial
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </Link>
      </div>

      <div className="flex gap-4 overflow-x-auto px-5 pb-4 no-scrollbar md:px-12">
        {items.map((it) => {
          const poster = it.poster ? `${IMG}${it.poster}` : null
          const epLabel =
            it.mediaType === 'tv' && it.season
              ? ` · T${it.season}:E${it.episode || 1}`
              : ''
          return (
            <Link
              key={it.key}
              to={watchPathFor(it)}
              className="group flex w-[280px] shrink-0 flex-col"
            >
              <div
                className="relative aspect-video w-full overflow-hidden rounded-[10px] bg-cover bg-center transition-transform duration-200 group-hover:scale-[1.035]"
                style={{
                  backgroundImage: poster ? `url(${poster})` : undefined,
                  backgroundColor: poster ? undefined : '#101319',
                  backgroundSize: 'cover',
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/30 bg-black/55 backdrop-blur">
                    <svg viewBox="0 0 24 24" fill="#fff" className="ml-0.5 h-5 w-5">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </span>
                </div>
              </div>
              <div className="mt-2.5 flex items-center justify-between text-[0.85rem]">
                <span className="truncate pr-2 font-semibold">
                  {it.title}
                  {epLabel}
                </span>
                <span className="shrink-0 text-dimtext">Continuar</span>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
