import PosterCard from './PosterCard.jsx'
import { useRef } from 'react'

// Fila horizontal de tarjetas con scroll suave (estilo cinehax).
export default function Row({ title, items }) {
  const ref = useRef(null)
  if (!items || items.length === 0) return null

  const scroll = (dir) => {
    ref.current?.scrollBy({ left: dir * 260, behavior: 'smooth' })
  }

  return (
    <section className="mb-10 group/row">
      <div className="mb-3 flex items-center gap-3 px-6 md:px-14">
        <h2 className="text-2xl font-black">{title}</h2>
        {/* acento rojo */}
        <span className="h-1.5 w-1.5 rounded-full bg-red-600" />
      </div>

      <div className="relative">
        <div
          ref={ref}
          className="flex gap-3 overflow-x-auto px-6 pb-2 no-scrollbar md:px-14"
        >
          {items.map((item) => (
            <PosterCard key={`${item.media_type}-${item.id}`} item={item} />
          ))}
        </div>

        {/* Flechas */}
        <button
          onClick={() => scroll(-1)}
          aria-label="Anterior"
          className="absolute left-1 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-black/50 p-2 text-white opacity-0 transition group-hover/row:opacity-100 hover:bg-red-600 md:block"
        >
          ‹
        </button>
        <button
          onClick={() => scroll(1)}
          aria-label="Siguiente"
          className="absolute right-1 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-black/50 p-2 text-white opacity-0 transition group-hover/row:opacity-100 hover:bg-red-600 md:block"
        >
          ›
        </button>
      </div>
    </section>
  )
}
