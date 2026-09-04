import { useRef } from 'react'
import { Link } from 'react-router-dom'

const IMG = 'https://image.tmdb.org/t/p/w500'

// Fila "Top N" con numerales outline (estilo del amigo).
export default function TopRow({ title, items, type, id }) {
  const ref = useRef(null)
  if (!items || items.length === 0) return null
  const list = items.slice(0, 10)

  const scroll = (dir) =>
    ref.current?.scrollBy({ left: dir * 420, behavior: 'smooth' })

  return (
    <section id={id} className="relative z-10 mb-12 scroll-mt-24">
      <div className="mb-4 flex items-baseline justify-between px-5 md:px-12">
        <h2 className="font-display text-2xl font-bold tracking-tight md:text-[1.4rem]">
          {title}
        </h2>
        <div className="hidden gap-2 md:flex">
          <button
            onClick={() => scroll(-1)}
            aria-label="Anterior"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-dimtext transition hover:bg-white/10 hover:text-white"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <button
            onClick={() => scroll(1)}
            aria-label="Siguiente"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-dimtext transition hover:bg-white/10 hover:text-white"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>

      <div
        ref={ref}
        className="flex gap-4 overflow-x-auto px-5 py-1.5 pb-4 no-scrollbar md:gap-2 md:px-12"
      >
        {list.map((item, i) => {
          const mediaType = type || item.media_type || (item.title ? 'movie' : 'tv')
          const poster = item.poster_path ? `${IMG}${item.poster_path}` : null
          return (
            <Link
              key={`${mediaType}-${item.id}`}
              to={`/${mediaType}/${item.id}`}
              className="group flex shrink-0 items-end"
            >
              <span
                className="z-[1] -mr-[18px] select-none font-display text-[6.5rem] font-extrabold leading-[0.8] tracking-[-0.04em] text-transparent transition-all duration-200 md:text-[7.5rem]"
                style={{
                  WebkitTextStroke: '2px rgba(255,255,255,0.18)',
                }}
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
                  <span className="rounded-full border border-rating/25 bg-rating/8 px-2 py-0.5 text-[0.72rem] text-rating">
                    ★ {item.vote_average?.toFixed(1)}
                  </span>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
