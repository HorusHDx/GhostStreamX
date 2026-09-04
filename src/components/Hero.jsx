import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

const IMG = 'https://image.tmdb.org/t/p/w1280'

// Slider hero estilo cinehax: backdrop, título, sinopsis y "Ver ahora".
export default function Hero({ items }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)

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

  const go = (dir) =>
    setIndex((i) => (i + dir + list.length) % list.length)

  return (
    <div
      className="relative h-[60vh] min-h-[380px] w-full overflow-hidden bg-black md:h-[75vh]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Slides */}
      {list.map((item, i) => {
        const isMovie = item.media_type === 'movie' || item.title
        const type = isMovie ? 'movie' : 'tv'
        return (
          <div
            key={`${type}-${item.id}`}
            className={`absolute inset-0 transition-opacity duration-700 ${
              i === index ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {item.backdrop_path ? (
              <img
                src={item.backdrop_path}
                alt={item.title || item.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full bg-gray-900" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-transparent to-transparent" />
          </div>
        )
      })}

      {/* Contenido del slide activo */}
      <div className="absolute inset-x-0 bottom-0 z-10 flex items-end px-6 pb-16 md:px-14">
        {list[index] && (
          <div className="max-w-xl">
            <span className="mb-2 inline-block rounded bg-red-600 px-2 py-0.5 text-xs font-bold uppercase tracking-wide">
              {list[index].media_type === 'movie' || list[index].title
                ? 'Película'
                : 'Serie'}
            </span>
            <h2 className="mb-2 text-3xl font-black leading-tight drop-shadow-lg md:text-5xl">
              {list[index].title || list[index].name}
            </h2>
            <p className="mb-4 line-clamp-2 max-w-lg text-sm text-gray-200 md:text-base">
              {list[index].overview}
            </p>
            <div className="flex items-center gap-3">
              <Link
                to={`/${
                  list[index].media_type === 'movie' || list[index].title
                    ? 'movie'
                    : 'tv'
                }/${list[index].id}`}
                className="rounded bg-red-600 px-5 py-2 font-semibold text-white transition hover:bg-red-700"
              >
                Ver ahora
              </Link>
              <div className="flex items-center gap-1">
                <span className="text-yellow-400">★</span>
                <span className="text-sm font-semibold">
                  {(list[index].vote_average || 0).toFixed(1)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Controles */}
      {list.length > 1 && (
        <>
          <button
            onClick={() => go(-1)}
            aria-label="Anterior"
            className="absolute left-2 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white opacity-0 transition hover:bg-red-600 group-hover:opacity-100 md:opacity-40 md:hover:opacity-100"
          >
            ‹
          </button>
          <button
            onClick={() => go(1)}
            aria-label="Siguiente"
            className="absolute right-2 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white opacity-0 transition hover:bg-red-600 md:opacity-40 md:hover:opacity-100"
          >
            ›
          </button>
          <div className="absolute bottom-4 left-0 right-0 z-20 flex justify-center gap-1.5">
            {list.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? 'w-5 bg-red-600' : 'w-2.5 bg-white/40'
                }`}
                aria-label={`Ir a slide ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
