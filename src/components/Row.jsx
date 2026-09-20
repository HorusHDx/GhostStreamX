import { useRef } from 'react'
import PosterCard from './PosterCard.jsx'

// Fila horizontal de tarjetas con cabecera (rail-head) y flechas (rail-nav).
export default function Row({ title, items }) {
  const ref = useRef(null)
  if (!items || items.length === 0) return null

  const scroll = (dir) =>
    ref.current?.scrollBy({ left: dir * 380, behavior: 'smooth' })

  return (
    <section className="relative z-10 mb-12">
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
        className="flex gap-4 overflow-x-auto px-5 pb-4 no-scrollbar md:px-12"
      >
        {items.map((item) => (
          <div
            key={`${item.media_type}-${item.id}`}
            className="w-[150px] shrink-0 md:w-[170px]"
          >
            <PosterCard item={item} />
          </div>
        ))}
      </div>
    </section>
  )
}
