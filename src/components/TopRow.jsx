import { Link } from 'react-router-dom'

const IMG = 'https://image.tmdb.org/t/p/w500'

// Fila estilo "Top N" con número grande al frente (como el top 10 de Netflix).
export default function TopRow({ title, items, type }) {
  if (!items || items.length === 0) return null
  const list = items.slice(0, 10)

  return (
    <section className="mb-12">
      <h2 className="mb-3 px-6 text-2xl font-black md:px-14">{title}</h2>
      <div className="flex gap-2 overflow-x-auto px-6 pb-2 no-scrollbar md:gap-0 md:px-14">
        {list.map((item, i) => {
          const mediaType = type || item.media_type || (item.title ? 'movie' : 'tv')
          const poster = item.poster_path ? `${IMG}${item.poster_path}` : null
          return (
            <Link
              key={`${mediaType}-${item.id}`}
              to={`/${mediaType}/${item.id}`}
              className="group relative flex shrink-0 items-end"
            >
              {/* Número grande de ranking */}
              <span
                className="z-0 -mr-4 text-[5.5rem] font-black leading-none text-red-600 drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)] md:text-[9rem]"
                style={{ WebkitTextStroke: '2px rgba(255,255,255,0.25)' }}
              >
                {i + 1}
              </span>
              {/* Poster */}
              <div className="relative z-10 h-44 w-[7.5rem] shrink-0 overflow-hidden rounded-md bg-surface transition-transform group-hover:scale-105 md:h-56 md:w-40">
                {poster ? (
                  <img
                    src={poster}
                    alt={item.title || item.name}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center p-2 text-center text-xs text-gray-500">
                    {item.title || item.name}
                  </div>
                )}
                <span className="absolute right-0 top-0 m-1 rounded bg-black/60 px-1 text-[10px] font-semibold text-yellow-400">
                  ★ {(item.vote_average || 0).toFixed(1)}
                </span>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
