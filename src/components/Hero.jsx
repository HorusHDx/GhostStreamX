import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

// Slider hero estilo cinehax/diseño del amigo:
// backdrop a pantalla, tag, título (font-display), meta, descripción,
// botones Reproducir / Más información, y dots verticales a la derecha.
// En táctil se cambia de slide con swipe (los dots solo existen en desktop).
export default function Hero({ items }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const touchX = useRef(null)
  const list = (items || []).slice(0, 10)

  useEffect(() => {
    if (list.length === 0) return
    setIndex(0)
  }, [items])

  useEffect(() => {
    if (list.length === 0 || paused) return
    const t = setInterval(() => setIndex((i) => (i + 1) % list.length), 6000)
    return () => clearInterval(t)
  }, [list.length, paused])

  if (list.length === 0) return null

  const item = list[index]
  const isMovie = item.media_type === 'movie' || item.title
  const type = isMovie ? 'movie' : 'tv'
  // En series no hay S/E a mano: "Reproducir" lleva al detalle
  // (ahí el botón Play arranca en S1E1). En pelis va directo al player.
  const playTo = isMovie ? `/watch/movie/${item.id}` : `/tv/${item.id}`
  const pct = Math.min(99, Math.round(((item.vote_average || 0) / 10) * 100))
  const year = (item.release_date || item.first_air_date || '').slice(0, 4)

  const onTouchStart = (e) => {
    touchX.current = e.touches[0].clientX
  }
  const onTouchEnd = (e) => {
    if (touchX.current === null) return
    const dx = e.changedTouches[0].clientX - touchX.current
    touchX.current = null
    if (Math.abs(dx) < 40 || list.length < 2) return
    setIndex((i) => (i + (dx < 0 ? 1 : -1) + list.length) % list.length)
  }

  return (
    <section
      className="relative h-[82vh] max-h-[820px] min-h-[500px] w-full overflow-hidden md:h-[92vh] md:min-h-[560px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Bg del slide activo */}
      {list.map((it, i) => (
        <div
          key={`${it.media_type}-${it.id}`}
          className={`absolute inset-0 transition-opacity duration-1000 ${
            i === index ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ pointerEvents: i === index ? 'auto' : 'none' }}
        >
          {it.backdrop_path ? (
            <img
              src={it.backdrop_path}
              alt={it.title || it.name}
              className="h-full w-full object-cover"
              loading={i === 0 ? 'eager' : 'lazy'}
            />
          ) : (
            <div className="h-full w-full bg-[#101319]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#08090c] via-[rgba(8,9,12,0.45)] to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[rgba(8,9,12,0.8)] via-[rgba(8,9,12,0.2)] to-transparent" />
        </div>
      ))}

      {/* Contenido */}
      <div className="absolute left-5 right-5 bottom-20 z-10 max-w-[560px] md:left-12 md:right-auto md:bottom-28">
        <div className="mb-4 flex items-center gap-2 text-[0.85rem] font-semibold tracking-wide text-spectral">
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
            <path d="M12 2l1.6 5.9L19.5 8l-4.6 3.6L16.5 18 12 14.6 7.5 18l1.6-6.4L4.5 8l5.9-.1z" />
          </svg>
          {item.title || item.name}
        </div>

        <h1 className="mb-4 font-display text-[clamp(2.2rem,5vw,4rem)] font-extrabold leading-[1.02] tracking-tight drop-shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
          {item.title || item.name}
        </h1>

        <div className="mb-4 flex items-center gap-3.5 text-[0.9rem] text-dimtext">
          <span className="font-semibold text-spectral">{pct}% para ti</span>
          <span className="h-[3px] w-[3px] rounded-full bg-dimtext" />
          {year && <span>{year}</span>}
          {isMovie ? (
            <>
              <span className="h-[3px] w-[3px] rounded-full bg-dimtext" />
              <span>Película</span>
            </>
          ) : (
            <>
              <span className="h-[3px] w-[3px] rounded-full bg-dimtext" />
              <span>Serie</span>
            </>
          )}
          <span className="h-[3px] w-[3px] rounded-full bg-dimtext" />
          <span className="flex items-center gap-1 text-rating">
            ★ {item.vote_average?.toFixed(1)}
          </span>
        </div>

        {item.overview && (
          <p className="mb-6 max-w-[500px] text-base leading-relaxed text-[#C7CBD4] line-clamp-3">
            {item.overview}
          </p>
        )}

        <div className="flex flex-wrap gap-3.5">
          <Link
            to={playTo}
            className="inline-flex items-center gap-2.5 rounded-lg bg-[#E9ECF1] px-6 py-3 text-[0.95rem] font-semibold text-[#08090C] transition hover:bg-white hover:shadow-[0_0_24px_rgba(233,236,241,0.25)] active:scale-[0.97]"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
              <path d="M8 5v14l11-7z" />
            </svg>
            Reproducir
          </Link>
          <Link
            to={`/${type}/${item.id}`}
            className="inline-flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/10 px-6 py-3 text-[0.95rem] font-semibold transition hover:border-spectral-dim hover:bg-white/10 active:scale-[0.97]"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-5M12 8h.01" />
            </svg>
            Más información
          </Link>
        </div>
      </div>

      {/* Dots verticales a la derecha */}
      {list.length > 1 && (
        <div className="absolute bottom-28 right-4 z-20 hidden flex-col gap-3 md:right-12 md:flex">
          {list.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              aria-label={`Ir a slide ${i + 1}`}
              className={`rounded transition-all duration-300 ${
                i === index
                  ? 'h-[26px] w-2 rounded bg-spectral shadow-[0_0_10px_rgba(127,231,212,0.35)]'
                  : 'h-2 w-2 rounded-full bg-white/25 hover:bg-white/50'
              }`}
            />
          ))}
        </div>
      )}
    </section>
  )
}
