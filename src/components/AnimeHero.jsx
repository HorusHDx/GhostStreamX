import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

// Hero carrusel de la sección Anime (diseño adaptado de anime.html).
// Rota cada 6s con cleanup al desmontar; dots para salto manual.

export default function AnimeHero({ items }) {
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    setCurrent(0)
  }, [items])

  useEffect(() => {
    if (!items?.length) return undefined
    const t = setInterval(() => {
      setCurrent((c) => (c + 1) % items.length)
    }, 6000)
    return () => clearInterval(t)
  }, [items, current])

  if (!items?.length) return null
  const item = items[current % items.length]
  const chips = [
    item.type && `${item.type}${item.totalEpisodes ? ` · ${item.totalEpisodes} eps` : ''}`,
    item.year,
    item.genres?.slice(0, 2).map((g) => g.label).join(' · '),
  ].filter(Boolean)

  return (
    <section className="relative h-[78vh] max-h-[720px] min-h-[480px] w-full overflow-hidden">
      {/* Fondo: gradiente + backdrop real (si falla, queda el gradiente) */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#1a2233] via-[#0c1420] to-bg" />
      {item.backdrop && (
        <img
          key={item.backdrop}
          src={item.backdrop}
          alt=""
          aria-hidden
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/55 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-bg/80 via-bg/20 to-transparent" />

      {/* Contenido */}
      <div className="absolute bottom-20 left-6 z-[2] max-w-[560px] max-md:bottom-14 md:left-12">
        {item.rating && (
          <p className="mb-4 flex items-center gap-2 text-[0.85rem] font-semibold text-spectral">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l1.6 5.9L19.5 8l-4.6 3.6L16.5 18 12 14.6 7.5 18l1.6-6.4L4.5 8l5.9-.1z" />
            </svg>
            Mejor valorado · ★ {item.rating}
          </p>
        )}
        <h1 className="mb-4 font-display text-[clamp(2rem,4.6vw,3.6rem)] font-extrabold leading-[1.03] tracking-tight [text-shadow:0_4px_30px_rgba(0,0,0,0.5)]">
          {item.title}
        </h1>
        {chips.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2.5">
            <span className="rounded-xl border border-spectral/25 bg-spectral/10 px-2.5 py-1 text-[0.78rem] text-spectral">
              SUB
            </span>
            {chips.map((c) => (
              <span
                key={c}
                className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-1 text-[0.78rem] text-dimtext"
              >
                {c}
              </span>
            ))}
          </div>
        )}
        {item.synopsis && (
          <p className="mb-6 line-clamp-3 max-w-[500px] text-[1rem] leading-relaxed text-[#C7CBD4]">
            {item.synopsis}
          </p>
        )}
        <div className="flex gap-3.5">
          <Link
            to={`/anime/${item.slug}/1`}
            className="inline-flex items-center gap-2.5 rounded-lg bg-[#E9ECF1] px-6 py-3 text-[0.95rem] font-semibold text-[#08090C] transition hover:bg-white hover:shadow-[0_0_24px_rgba(233,236,241,0.25)] active:scale-[0.97]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
            Ver episodio 1
          </Link>
          <Link
            to={`/anime/${item.slug}`}
            className="inline-flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/10 px-6 py-3 text-[0.95rem] font-semibold text-white transition hover:border-spectral/30 hover:bg-white/[0.13] active:scale-[0.97]"
          >
            Más información
          </Link>
        </div>
      </div>

      {/* Dots */}
      <div className="absolute bottom-20 right-6 z-[3] flex flex-col gap-3 max-md:hidden md:right-12">
        {items.map((s, i) => (
          <button
            key={s.slug}
            aria-label={`Ir a ${s.title}`}
            onClick={() => setCurrent(i)}
            className={`w-2 rounded transition-all duration-300 ${
              i === current % items.length
                ? 'h-[26px] bg-spectral shadow-[0_0_10px_rgba(127,231,212,0.35)]'
                : 'h-2 bg-white/25 hover:bg-white/50'
            }`}
          />
        ))}
      </div>
    </section>
  )
}
