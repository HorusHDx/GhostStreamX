import { useRef } from 'react'
import { Link } from 'react-router-dom'

// Riel horizontal con flechas (diseño adaptado de anime.html).
// props: title, sub?, moreTo? (link "Ver todos"), children (tarjetas).

export default function AnimeRail({ title, sub, moreTo, children }) {
  const track = useRef(null)

  function scroll(dir) {
    track.current?.scrollBy({ left: dir * 420, behavior: 'smooth' })
  }

  const arrow =
    'flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-dimtext transition hover:bg-white/10 hover:text-white'

  return (
    <div className="mb-[52px]">
      <div className="mb-[18px] flex items-baseline justify-between px-6 md:px-12">
        <div className="flex items-baseline gap-3">
          <h2 className="font-display text-[1.4rem] font-bold tracking-tight">{title}</h2>
          {sub && <span className="text-[0.85rem] text-dimtext">{sub}</span>}
        </div>
        <div className="flex items-center gap-2">
          {moreTo && (
            <Link
              to={moreTo}
              className="mr-1 flex items-center gap-1.5 text-[0.87rem] text-dimtext transition hover:text-spectral"
            >
              Ver todos
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </Link>
          )}
          <button aria-label="Anterior" onClick={() => scroll(-1)} className={arrow}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <button aria-label="Siguiente" onClick={() => scroll(1)} className={arrow}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>
      <div
        ref={track}
        className="flex gap-4 overflow-x-auto px-6 pb-4 pt-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
    </div>
  )
}
